"""LLM Router — GPT-5 (primary) + Gemini (automatic fallback).

This is the SINGLE ENTRY POINT for all AI calls in the student backend.
Every plan generation and JD analysis call routes THROUGH this module.

Provider Resolution (controlled by settings.LLM_PROVIDER):
  1. LLM_PROVIDER=openai  → GPT-5 via openai_client.py
     - Falls back to Gemini automatically if OPENAI_API_KEY is missing
       or if GPT-5 call fails after retries
  2. LLM_PROVIDER=gemini  → Gemini as primary (legacy behaviour)

Exported symbols used by the rest of the codebase:
  - generate_learning_plan(prompt_or_context)  → str  (Gemini compat) | dict (OpenAI)
  - build_learning_plan_prompt(context)        → str  (Gemini-mode only)
  - analyze_target_jd(...)                     → dict
  - LLMTimeoutError
  - LLMValidationError

IMPORTANT: All Celery tasks (jobs.py) import from this module only.
Do NOT import openai_client or gemini internals directly in tasks.
"""
from pathlib import Path
import logging
import json
import concurrent.futures
from typing import Optional, Any

import google.generativeai as genai

from app.core.config import settings

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"
logger = logging.getLogger(__name__)

# Global cache for resolved Gemini model name
_resolved_generation_model: str | None = None


# ---------------------------------------------------------------------------
# Exceptions (kept for backward-compat — re-exported to callers)
# ---------------------------------------------------------------------------

class LLMTimeoutError(Exception):
    """Raised when an LLM API call exceeds timeout."""
    pass


class LLMValidationError(Exception):
    """Raised when LLM response fails JSON/schema validation."""
    pass


# ---------------------------------------------------------------------------
# Provider detection
# ---------------------------------------------------------------------------

def _use_openai() -> bool:
    """Return True when OpenAI should be used as the primary provider."""
    provider = getattr(settings, "LLM_PROVIDER", "openai").strip().lower()
    if provider == "gemini":
        return False
    # Even if provider=openai, check key is present
    key = getattr(settings, "OPENAI_API_KEY", "").strip()
    if not key:
        logger.warning(
            "[LLM-ROUTER] LLM_PROVIDER=openai but OPENAI_API_KEY is empty. "
            "Falling back to Gemini. Add your key to .env: OPENAI_API_KEY=sk-..."
        )
        return False
    return True


# ═══════════════════════════════════════════════════════════════════════════
# ─── OPENAI / GPT-5 path ──────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════

def _generate_plan_via_openai(context: dict) -> dict:
    """Route plan generation through GPT-5 (openai_client.py)."""
    from app.services.openai_client import (
        generate_learning_plan as _openai_generate,
        OpenAIProviderError,
        OpenAITimeoutError,
    )
    try:
        return _openai_generate(context)
    except OpenAITimeoutError as exc:
        raise LLMTimeoutError(str(exc)) from exc
    except OpenAIProviderError as exc:
        raise LLMValidationError(str(exc)) from exc


def _analyze_jd_via_openai(
    company_name: str,
    role: str,
    jd_text: str,
    company_context: str,
) -> dict:
    """Route JD analysis through GPT-5 (openai_client.py)."""
    from app.services.openai_client import analyze_target_jd_openai
    return analyze_target_jd_openai(company_name, role, jd_text, company_context)


# ═══════════════════════════════════════════════════════════════════════════
# ─── GEMINI path (legacy / fallback) ──────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════

def _get_generation_model_name() -> str:
    """Resolve and cache the Gemini model name."""
    genai.configure(api_key=settings.GEMINI_API_KEY)
    global _resolved_generation_model
    if _resolved_generation_model:
        return _resolved_generation_model

    configured = settings.GEMINI_GENERATION_MODEL.strip()
    preferred_candidates = [
        configured,
        "gemini-2.5-pro-preview-05-06",
        "gemini-2.5-flash-preview-05-20",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "models/gemini-1.5-flash",
        "models/gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    ]
    try:
        available = [
            m.name
            for m in genai.list_models()
            if "generateContent" in (m.supported_generation_methods or [])
        ]
    except Exception:
        available = []

    if available:
        selected = next((c for c in preferred_candidates if c in available), available[0])
    else:
        selected = configured

    _resolved_generation_model = selected
    logger.info("[LLM-GEMINI] Resolved model: %s", selected)
    return selected


def _repair_truncated_json(raw: str) -> str:
    """Attempt to repair truncated JSON from Gemini by closing open structures.

    Gemini sometimes hits its output token limit mid-JSON, leaving unclosed
    arrays/objects. This function tries to close them so json.loads() succeeds.
    Only the daily_plan array up to the last fully-formed day is kept.
    """
    # Find the last complete day object — look for the last '}' before a ',' or ']'
    # Strategy: truncate at the last valid complete day boundary
    # Find all positions of '"day":' to locate day boundaries
    import re as _re

    # Try to find the last position where a complete day object ends
    # A complete day ends with: ...}  (closing the tasks array and day object)
    # We look for the pattern: closing of tasks array + closing of day object
    day_end_pattern = _re.compile(r'\]\s*\}')  # closes tasks array + day object
    matches = list(day_end_pattern.finditer(raw))

    if not matches:
        raise json.JSONDecodeError("Cannot repair JSON — no complete day found", raw, 0)

    # Use the last complete day boundary
    last_end = matches[-1].end()
    truncated = raw[:last_end]

    # Now close the daily_plan array and the root object
    # Count open brackets to determine what needs closing
    open_brackets = truncated.count('[') - truncated.count(']')
    open_braces = truncated.count('{') - truncated.count('}')

    repaired = truncated
    repaired += ']' * max(0, open_brackets)
    repaired += '}' * max(0, open_braces)

    # Ensure resources array exists
    try:
        parsed = json.loads(repaired)
        if 'resources' not in parsed:
            parsed['resources'] = ["Review official documentation for the target role technologies."]
        return json.dumps(parsed)
    except json.JSONDecodeError:
        raise


def _generate_content_with_timeout(prompt: str, timeout_seconds: int = 60) -> tuple[str, dict]:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(_get_generation_model_name())

    def _call():
        generation_config = genai.types.GenerationConfig(
            max_output_tokens=32000,   # Increased from 16000 — Gemini 2.5 supports more
            temperature=0.4,
        )
        response = model.generate_content(prompt, generation_config=generation_config)
        raw_text = response.text
        usage = {
            "prompt_tokens": response.usage_metadata.prompt_token_count,
            "completion_tokens": response.usage_metadata.candidates_token_count,
            "total_tokens": response.usage_metadata.total_token_count,
            "model": _get_generation_model_name()
        }
        return raw_text, usage

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_call)
        try:
            return future.result(timeout=timeout_seconds)
        except concurrent.futures.TimeoutError as exc:
            raise LLMTimeoutError(
                f"Gemini API call exceeded {timeout_seconds}s timeout"
            ) from exc


# ═══════════════════════════════════════════════════════════════════════════
# ─── PUBLIC API (used by plan_service.py and jobs.py) ─────────────────────
# ═══════════════════════════════════════════════════════════════════════════

def build_learning_plan_prompt(context: dict) -> str:
    """
    Build the full Gemini-style prompt string.

    Only used when LLM_PROVIDER=gemini. OpenAI path builds its own
    user message internally in openai_client.py.

    Also injects cross-language transition context (Section 5).
    """
    prompt_path = PROMPTS_DIR / "system_prompt.txt"
    try:
        system_prompt = prompt_path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        system_prompt = "You are an expert technical interview preparation mentor."

    student_name    = context.get("student_name", "Student")
    primary_skill   = context.get("primary_skill", "Not specified")
    known_skills    = context.get("known_skills", [])
    days_available  = context.get("days_available", 7)
    support_mode    = context.get("support_mode", "Guided coaching")
    tone            = context.get("tone", "Supportive")
    coding_required = context.get("coding_required", True)

    company_name    = context.get("company_name", "Unknown")
    role            = context.get("role", "General")
    difficulty      = context.get("difficulty", "Unknown")
    round_structure = context.get("round_structure", "Standard")
    jd_text         = context.get("jd_text", "Not provided")

    ats_score       = context.get("ats_score", 0)
    missing_skills  = context.get("missing_skills", [])
    keyword_score   = context.get("keyword_score", 0)

    resume_context       = context.get("resume_context", "Not available")[:1500]  # Limit to 1500 chars
    profile_context      = context.get("profile_context", "Not available")[:800]
    company_intelligence = context.get("company_context", "No company interview intelligence available")[:1500]

    known_skills_limited = known_skills[:15] if isinstance(known_skills, list) else []
    skills_lines = []
    for item in known_skills_limited:
        if isinstance(item, dict):
            skills_lines.append(f"  - {item.get('skill', 'Unknown')} [{item.get('proficiency', 'Unknown')}]")
        elif isinstance(item, str):
            skills_lines.append(f"  - {item} [Unknown]")
    known_skills_str = "\n".join(skills_lines) if skills_lines else "  Not specified"
    missing_skills_str = ", ".join(missing_skills) if missing_skills else "None"
    jd_trimmed = jd_text[:800] if jd_text and len(jd_text) > 800 else jd_text

    # Cross-language transition block
    _PROG_LANGUAGES = {
        "javascript", "typescript", "python", "java", "kotlin", "c#", "csharp",
        "c++", "cpp", "c", "go", "golang", "rust", "swift", "ruby", "php",
        "scala", "dart",
    }
    proficient_langs = []
    for item in known_skills_limited:
        if isinstance(item, dict):
            name = item.get("skill", "").lower()
            prof = item.get("proficiency", "").lower()
            if name in _PROG_LANGUAGES and prof in ("advanced", "intermediate"):
                proficient_langs.append(item.get("skill", name))
    if primary_skill.lower() in _PROG_LANGUAGES and primary_skill not in proficient_langs:
        proficient_langs.insert(0, primary_skill)
    target_langs = [s for s in missing_skills if s.lower() in _PROG_LANGUAGES]

    lang_lines = ["LANGUAGE TRANSITION CONTEXT:"]
    lang_lines.append(f"* Proficient Languages: {', '.join(proficient_langs) or 'Not identified'}")
    lang_lines.append(f"* Required New Languages: {', '.join(target_langs) or 'None'}")
    
    # Heuristic: If target_langs is empty but role contains a language, add it
    if not target_langs:
        role_lower = role.lower()
        for lang in _PROG_LANGUAGES:
            if lang in role_lower and lang not in [p.lower() for p in proficient_langs]:
                target_langs.append(lang.capitalize())
                break

    if proficient_langs and target_langs:
        transitions = [f"{p} → {t}" for p in proficient_langs for t in target_langs if p.lower() != t.lower()]
        if transitions:
            lang_lines.append(f"* Active Transitions: {', '.join(transitions)} — Embed comparison study INLINE within relevant task descriptions on Day 1-2 only (see system prompt Section 5). Do NOT create a separate transition day or module.")
        else:
            lang_lines.append("* No transition needed.")
    else:
        lang_lines.append("* No language transition detected — skip Section 5.")
    lang_block = "\n".join(lang_lines)

    user_prompt = f"""STUDENT PROFILE:

* Name: {student_name}
* Primary Skill: {primary_skill}
* Known Skills (with proficiency levels):
{known_skills_str}
* Days Remaining: {days_available}
* Support Mode: {support_mode}
* Preferred Tone: {tone}
* Coding Tasks Required: {coding_required}

STUDENT PROFILE CONTEXT:
{profile_context}

MARKSHEETS (Academic Foundation):
{context.get("marksheet_context", "No marksheets uploaded.")}

{lang_block}

TARGET INTERVIEW:

* Company: {company_name}
* Role: {role}
* Difficulty: {difficulty}
* Interview Rounds: {round_structure}
* Job Description:
  {jd_trimmed}

RESUME GAP ANALYSIS:

* ATS Score: {ats_score}
* Missing Skills: {missing_skills_str}
* Keyword Match: {keyword_score}

RESUME CONTEXT:
{resume_context}

COMPANY INTERVIEW INTELLIGENCE:
{company_intelligence}

TASK:
Create a complete day-by-day interview preparation plan as JSON.

⚠️ CRITICAL: The plan MUST be built around the TARGET ROLE "{role}" at "{company_name}".
- Read the JD carefully. The plan topics, frameworks, and languages MUST match what the JD requires.
- If the JD requires Python → ALL tasks must cover Python, FastAPI/Django, Python async, etc.
- If the JD requires Java → ALL tasks must cover Java, Spring Boot, JPA, Maven, etc.
- The student's primary skill ({primary_skill}) determines BRIDGING NOTES only (Day 1-2 only).
- NEVER generate a Java plan for a Python role, or a Python plan for a Java role.
- Missing skills from the gap analysis MUST appear in Day 1-2 as the highest priority topics.
- Support Mode "{support_mode}": Guided = step-by-step explanations; Self-paced = concise tasks; Adaptive = mix based on gaps.
- Tone "{tone}": Supportive = encouraging language; Direct = no-fluff instructions; Neutral = balanced.
- Coding Required = {coding_required}: {"Include hands-on coding tasks every day." if coding_required else "Minimize coding tasks — focus on conceptual understanding and verbal explanations."}
- Difficulty "{difficulty}": {"Hard = include system design, advanced DSA, and deep-dive architecture tasks." if difficulty == "hard" else "Medium = balanced technical + behavioral." if difficulty == "medium" else "Easy = focus on fundamentals and communication."}
- Round Structure "{round_structure}": Tailor task types to match these exact rounds.

COMPULSORY REQUIREMENTS (strictly enforced — any violation is unacceptable):

1. EVERY TASK (all days, all task types) MUST include qa_pairs AND quiz:

   qa_pairs (3-5 items per task):
   - "question": A real interview-style question
   - "answer": A crisp 1-2 sentence answer
   - "explanation": EXACTLY 4+ separate paragraphs joined by \\n\\n. Format MUST be:
       "Heading: Topic Name\\n\\nParagraph 1: Core concept in 2-3 sentences.\\n\\nParagraph 2: How it works technically (2-3 sentences).\\n\\nParagraph 3: Real-world use case or code example (2-3 sentences).\\n\\nParagraph 4: Common interview trap or edge case."
     VIOLATION: Writing a single line or < 4 paragraphs. This is FORBIDDEN.
   - "transition_note": Compare student's background language to target. Null if same.

   quiz (2-3 MCQ per task — ALWAYS included):
   - 4 options each, correct_index (0-3), explanation (2 sentences minimum)

2. MODULE MASTERY QUIZ: The VERY LAST task of EVERY day MUST be:
   - title: "Module Mastery Quiz", task_type: "qa"
   - 5 qa_pairs covering the day's topics
   - 3 quiz questions testing the day's learning

3. CODING MOCK TEST MODULE (MANDATORY — SECOND-TO-LAST DAY):
   Day {days_available - 1} MUST be dedicated to "Coding Mock Tests" with:
   - First task MUST be task_type="code" with 2-3 real DSA problems relevant to the role
   - code_metadata MUST include ALL of the following (LeetCode-quality):
     * language: programming language
     * initial_code: proper boilerplate with function signature and input parsing
     * solution: complete working solution with comments
     * difficulty: "Easy", "Medium", or "Hard"
     * description: DETAILED problem statement (5-8 sentences) explaining the problem, constraints, and at least 2 approaches (brute force and optimal). Include time/space complexity analysis.
     * hint: A specific, actionable hint (2-3 sentences) that guides toward the optimal approach without giving away the solution
     * examples: array of 3 objects with {{input, output, explanation}} — use realistic values
     * constraints: array of 4-6 constraint strings (e.g., "2 <= nums.length <= 10⁴")
     * test_cases: array of 5+ objects with {{input, expected, label}} — include edge cases (empty, single element, all negative, duplicates)
   - This day MUST also end with a "Module Mastery Quiz" covering DSA concepts

4. BEHAVIORAL INTERVIEW MODULE (MANDATORY — LAST DAY):
   The VERY LAST day (day {days_available}) MUST have focus: "Behavioral Interview" and contain ONLY:
   - Task 1: "Tell Me About Yourself & Company Research" (task_type="qa") — STAR-structured answers for self-introduction, company research, and motivation questions
   - Task 2: "Behavioral Scenarios (STAR Method)" (task_type="qa") — challenge, conflict, leadership, teamwork stories using STAR framework
   - Task 3: "HR Round Questions" (task_type="qa") — salary expectations, career goals, strengths/weaknesses, notice period
   - Task 4: "Module Mastery Quiz" (task_type="qa") — 5 behavioral qa_pairs + 3 quiz questions
   - ALL tasks in this day MUST have task_type="qa" (NO code tasks)
   - transition_note for ALL behavioral tasks MUST be null

5. TRANSITION NOTES: Days 1-2 — every qa_pair transition_note MUST be non-null (if cross-language).

CRITICAL: The "explanation" field MUST have 4+ separate \\n\\n-separated paragraphs. Single-line explanations are UNACCEPTABLE.

Return JSON format:
{{
  "overview": "strategy summary",
  "daily_plan": [
    {{
      "day": 1,
      "focus": "Day 1 topic",
      "tasks": [
        {{
          "title": "task name",
          "description": "what to do",
          "duration_minutes": 60,
          "task_type": "qa",
          "qa_pairs": [
            {{
              "question": "Interview question?",
              "answer": "Direct 1-sentence answer.",
              "explanation": "Heading: Concept Name\\n\\nCore concept paragraph with 3 sentences.\\n\\nTechnical details paragraph with 3 sentences.\\n\\nReal-world use case with example.\\n\\nInterview trap: common mistake to avoid.",
              "transition_note": "In Java you use X, but in Python you use Y because Z."
            }}
          ],
          "quiz": [
            {{
              "question": "MCQ question?",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correct_index": 0,
              "explanation": "A is correct because X. B is wrong because Y."
            }}
          ],
          "code_metadata": null
        }},
        {{
          "title": "Module Mastery Quiz",
          "description": "Test your understanding of today's topics.",
          "duration_minutes": 20,
          "task_type": "qa",
          "qa_pairs": [],
          "quiz": [],
          "code_metadata": null
        }}
      ]
    }},
    {{
      "day": {days_available - 1},
      "focus": "Coding Mock Tests",
      "tasks": [
        {{
          "title": "DSA: Arrays & Strings",
          "description": "Solve 2-3 progressively harder DSA problems.",
          "duration_minutes": 90,
          "task_type": "code",
          "qa_pairs": [],
          "quiz": [],
          "code_metadata": {{
            "language": "Python",
            "initial_code": "# Write your solution here\\ndef solution(nums):\\n    pass",
            "solution": "# Optimal solution here",
            "difficulty": "Medium",
            "examples": [{{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]", "explanation": "nums[0] + nums[1] = 9"}}],
            "constraints": ["2 <= nums.length <= 10^4"],
            "test_cases": [{{"input": "[2,7,11,15]\\n9", "expected": "[0, 1]", "label": "Basic case"}}]
          }}
        }},
        {{
          "title": "Module Mastery Quiz",
          "description": "Test your DSA knowledge.",
          "duration_minutes": 20,
          "task_type": "qa",
          "qa_pairs": [],
          "quiz": [],
          "code_metadata": null
        }}
      ]
    }},
    {{
      "day": {days_available},
      "focus": "Behavioral Interview",
      "tasks": [
        {{
          "title": "Tell Me About Yourself & Company Research",
          "description": "Practice your self-introduction and company-specific answers.",
          "duration_minutes": 45,
          "task_type": "qa",
          "qa_pairs": [
            {{
              "question": "Tell me about yourself.",
              "answer": "Structure: Present, Past, Future. 60-90 seconds, professional focus.",
              "explanation": "Your Professional Elevator Pitch\\n\\nThis is almost always the opening question. The best structure is Present → Past → Future: start with who you are now, briefly mention relevant background, and end with what you're looking for.\\n\\nKeep it to 60-90 seconds. Every sentence should be intentional — avoid personal details unless they directly relate to the role. Focus on your technical identity.\\n\\nTailor your answer to the company and role. Research the company's tech stack and mirror it in your narrative.\\n\\nEnd with a bridge to the role: 'I'm excited about this position because it aligns with my expertise and career goals.'",
              "transition_note": null
            }}
          ],
          "quiz": [],
          "code_metadata": null
        }},
        {{
          "title": "Behavioral Scenarios (STAR Method)",
          "description": "Practice challenge, conflict, and leadership stories using STAR framework.",
          "duration_minutes": 45,
          "task_type": "qa",
          "qa_pairs": [],
          "quiz": [],
          "code_metadata": null
        }},
        {{
          "title": "HR Round Questions",
          "description": "Prepare for salary, career goals, strengths/weaknesses, and situational HR questions.",
          "duration_minutes": 30,
          "task_type": "qa",
          "qa_pairs": [],
          "quiz": [],
          "code_metadata": null
        }},
        {{
          "title": "Module Mastery Quiz",
          "description": "Test your behavioral interview readiness.",
          "duration_minutes": 20,
          "task_type": "qa",
          "qa_pairs": [],
          "quiz": [],
          "code_metadata": null
        }}
      ]
    }}
  ],
  "resources": ["resource 1"]
}}"""

    return f"{system_prompt}\n\n{user_prompt}"


def generate_learning_plan(prompt_or_context: str | dict) -> tuple[str, Optional[dict]]:
    """
    Generate a learning plan via the configured LLM provider.

    Accepts either:
    - A pre-built prompt string (Gemini compatibility mode)
    - A context dict (OpenAI mode — builds its own user message)

    When LLM_PROVIDER=openai:
      → Calls GPT-4o via openai_client.generate_learning_plan(context)
      → Returns JSON string of the plan dict for backward compatibility
      → Falls back to Gemini if OpenAI unavailable

    When LLM_PROVIDER=gemini:
      → Calls Gemini with the prompt string (legacy behaviour)
      → Returns raw text response
      → Falls back to OpenAI if Gemini fails with JSONDecodeError

    Jobs/workers parse the returned string with _parse_plan_json().
    """
    if _use_openai():
        # OpenAI path: context dict expected; if a string was passed wrap it
        if isinstance(prompt_or_context, str):
            logger.info("[LLM-ROUTER] OpenAI mode with raw string prompt (legacy call)")
            context = {"raw_prompt": prompt_or_context}
        else:
            context = prompt_or_context

        logger.info("[LLM-ROUTER] Using OpenAI (GPT-4o) for plan generation")
        try:
            plan_dict, usage = _generate_plan_via_openai(context)
            return json.dumps(plan_dict), usage
        except Exception as exc:
            logger.warning(
                "[LLM-ROUTER] GPT-4o failed (%s), falling back to Gemini. Error: %s",
                type(exc).__name__, exc,
            )
            # Fall through to Gemini below

    # Gemini path (primary when LLM_PROVIDER=gemini, or as fallback)
    if isinstance(prompt_or_context, dict):
        gemini_prompt = build_learning_plan_prompt(prompt_or_context)
    else:
        gemini_prompt = prompt_or_context

    logger.info("[LLM-ROUTER] Using Gemini for plan generation")
    try:
        res, usage = _generate_content_with_timeout(gemini_prompt, timeout_seconds=180)
        # Quick validation — if Gemini response is not valid JSON, try repair
        try:
            json.loads(res)
        except json.JSONDecodeError:
            logger.warning("[LLM-ROUTER] Gemini returned invalid JSON — attempting repair")
            res = _repair_truncated_json(res)
        return res, usage
    except Exception as gemini_exc:
        logger.warning("[LLM-ROUTER] Gemini failed: %s — trying OpenAI as last resort", gemini_exc)
        # Last resort: try OpenAI even if LLM_PROVIDER=gemini
        if isinstance(prompt_or_context, dict):
            try:
                plan_dict, usage = _generate_plan_via_openai(prompt_or_context)
                logger.info("[LLM-ROUTER] OpenAI last-resort succeeded")
                return json.dumps(plan_dict), usage
            except Exception as openai_exc:
                logger.error("[LLM-ROUTER] OpenAI last-resort also failed: %s", openai_exc)
        raise gemini_exc


def analyze_target_jd(
    company_name: str,
    role: str,
    jd_text: str,
    company_context: str,
) -> tuple[dict, Optional[dict]]:
    """
    Analyse a JD using the configured LLM provider.

    Returns:
        dict: {required_skills, difficulty, round_structure, summary}
    """
    if _use_openai():
        logger.info("[LLM-ROUTER] Using OpenAI (GPT-5) for JD analysis")
        try:
            return _analyze_jd_via_openai(company_name, role, jd_text, company_context)
        except Exception as exc:
            logger.warning(
                "[LLM-ROUTER] GPT-5 JD analysis failed (%s), falling back to Gemini.",
                type(exc).__name__,
            )

    # Gemini fallback
    logger.info("[LLM-ROUTER] Using Gemini for JD analysis")
    prompt = f"""You are an expert technical interview analyst who thinks like a hiring manager.

Analyse this target role and extract interview-relevant intelligence.
Focus on what actually gets asked in interviews, not just what's listed in the JD.

Company: {company_name}
Role: {role}

Job Description:
{jd_text}

Company Interview Intelligence:
{company_context or 'No additional company context available.'}

Based on the JD and any company context, determine:
- What skills will ACTUALLY be tested in the interview (not just listed as nice-to-have)
- The realistic difficulty level based on company reputation and role seniority
- The likely interview round structure for this type of role at this company
- A concise summary focused on what the candidate MUST demonstrate to get hired

Return strict JSON only with this exact shape:
{{
  "required_skills": ["skill1", "skill2"],
  "difficulty": "easy|medium|hard|unknown",
  "round_structure": "screen -> technical -> behavioral",
  "summary": "2-4 sentence concise summary focused on interview expectations"
}}
"""
    model = genai.GenerativeModel(_get_generation_model_name())
    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"},
        )
    except Exception:
        response = model.generate_content(prompt)

    raw = response.text
    usage = {
        "prompt_tokens": response.usage_metadata.prompt_token_count,
        "completion_tokens": response.usage_metadata.candidates_token_count,
        "total_tokens": response.usage_metadata.total_token_count,
        "model": _get_generation_model_name()
    }
    try:
        return json.loads(raw), usage
    except json.JSONDecodeError:
        start = raw.find("{")
        end   = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(raw[start: end + 1]), usage
        raise
