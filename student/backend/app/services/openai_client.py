"""OpenAI GPT-5 integration service.

This module provides all GPT-5 (and GPT-5-mini) powered features:
- Learning plan generation  (generate_learning_plan)
- Target JD analysis        (analyze_target_jd_openai)

Key Design Principles:
- 90-second timeout protection around every API call
- Automatic fallback to gpt-5-mini if gpt-5 quota/rate limit hit
- JSON schema enforcement via response_format (structured output)
- Full retry logic: up to 2 retries on timeout or rate-limit errors
- System prompt loaded from file (prompts/system_prompt.txt)
- Cross-language transition context injected into every user message

Model Resolution Order:
  1. settings.OPENAI_GENERATION_MODEL  (default: gpt-5)
  2. settings.OPENAI_FALLBACK_MODEL    (default: gpt-5-mini)
  3. gpt-5-mini                        (hardcoded last resort)

Billing:
  All calls are billed to the OPENAI_API_KEY set in .env.
  GPT-5 pricing: ~$15/M input tokens, ~$60/M output tokens.
  GPT-5-mini pricing: ~$1.50/M input, ~$6/M output.
  Typical plan generation: ~2-3K tokens total ≈ $0.05-$0.15 per plan.
"""

import json
import logging
import concurrent.futures
from pathlib import Path
from typing import Any, Dict

try:
    from openai import OpenAI, APIStatusError, APITimeoutError, RateLimitError
except ImportError:
    OpenAI = None  # type: ignore[assignment,misc]
    APIStatusError = Exception  # type: ignore[assignment,misc]
    APITimeoutError = Exception  # type: ignore[assignment,misc]
    RateLimitError = Exception  # type: ignore[assignment,misc]

from app.core.config import settings

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"

# ---------------------------------------------------------------------------
# Programming languages — used for cross-language transition detection
# ---------------------------------------------------------------------------
_PROG_LANGUAGES = {
    "javascript", "typescript", "python", "java", "kotlin", "c#", "csharp",
    "c++", "cpp", "c", "go", "golang", "rust", "swift", "ruby", "php",
    "scala", "dart", "r", "matlab", "perl",
}

# Client singleton
_client: "OpenAI | None" = None


class OpenAITimeoutError(Exception):
    """Raised when GPT-5 API exceeds timeout."""


class OpenAIProviderError(Exception):
    """Raised when GPT-5 SDK is not installed."""


# ---------------------------------------------------------------------------
# JSON schema for structured plan output
# ---------------------------------------------------------------------------
PLAN_SCHEMA: Dict[str, Any] = {
    "name": "learning_plan",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "overview": {"type": "string"},
            "daily_plan": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "day": {"type": "integer"},
                        "focus": {"type": "string"},
                        "tasks": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title": {"type": "string"},
                                    "description": {"type": "string"},
                                    "duration_minutes": {"type": "integer"},
                                    "task_type": {"type": "string", "enum": ["text", "qa", "code"]},
                                    "qa_pairs": {
                                        "type": "array",
                                        "minItems": 3,
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "question": {"type": "string"},
                                                "answer": {"type": "string"},
                                                "explanation": {"type": "string"},
                                                "transition_note": {"type": ["string", "null"]}
                                            },
                                            "required": ["question", "answer", "explanation", "transition_note"],
                                            "additionalProperties": False
                                        }
                                    },
                                    "quiz": {
                                        "type": "array",
                                        "minItems": 2,
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "question": {"type": "string"},
                                                "options": {
                                                    "type": "array",
                                                    "items": {"type": "string"},
                                                    "minItems": 4,
                                                    "maxItems": 4
                                                },
                                                "correct_index": {"type": "integer", "minimum": 0, "maximum": 3},
                                                "explanation": {"type": "string"}
                                            },
                                            "required": ["question", "options", "correct_index", "explanation"],
                                            "additionalProperties": False
                                        }
                                    },
                                    "code_metadata": {
                                        "type": ["object", "null"],
                                        "properties": {
                                            "language": {"type": "string"},
                                            "initial_code": {"type": "string"},
                                            "solution": {"type": "string"},
                                            "difficulty": {"type": "string", "enum": ["Easy", "Medium", "Hard"]},
                                            "examples": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "input": {"type": "string"},
                                                        "output": {"type": "string"},
                                                        "explanation": {"type": "string"}
                                                    },
                                                    "required": ["input", "output", "explanation"],
                                                    "additionalProperties": False
                                                }
                                            },
                                            "constraints": {"type": "array", "items": {"type": "string"}},
                                            "test_cases": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "input": {"type": "string"},
                                                        "expected": {"type": "string"},
                                                        "label": {"type": "string"}
                                                    },
                                                    "required": ["input", "expected", "label"],
                                                    "additionalProperties": False
                                                }
                                            }
                                        },
                                        "required": ["language", "initial_code", "solution", "difficulty", "examples", "constraints", "test_cases"],
                                        "additionalProperties": False
                                    }
                                },
                                 "required": ["title", "description", "duration_minutes", "task_type", "qa_pairs", "quiz", "code_metadata"],
                                 "additionalProperties": False,
                             },
                         },
                     },
                     "required": ["day", "focus", "tasks"],
                     "additionalProperties": False,
                 },
             },
             "resources": {"type": "array", "items": {"type": "string"}},
         },
         "required": ["overview", "daily_plan", "resources"],
         "additionalProperties": False,
     },
 }

# JSON schema for JD analysis output
JD_ANALYSIS_SCHEMA: Dict[str, Any] = {
    "name": "jd_analysis",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "required_skills": {"type": "array", "items": {"type": "string"}},
            "difficulty": {"type": "string", "enum": ["easy", "medium", "hard", "unknown"]},
            "round_structure": {"type": "string"},
            "summary": {"type": "string"},
        },
        "required": ["required_skills", "difficulty", "round_structure", "summary"],
        "additionalProperties": False,
    },
}

# JSON schema for code report output
CODE_REPORT_SCHEMA: Dict[str, Any] = {
    "name": "code_report",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "analysis": {"type": "string"},
            "lagging_skills": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "skill": {"type": "string"},
                        "in_course": {"type": "boolean"},
                        "explanation": {"type": "string"},
                    },
                    "required": ["skill", "in_course", "explanation"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["analysis", "lagging_skills"],
        "additionalProperties": False,
    },
}

# ---------------------------------------------------------------------------
# Client helpers
# ---------------------------------------------------------------------------

def _get_client() -> "OpenAI":
    global _client
    if OpenAI is None:
        raise OpenAIProviderError(
            "openai SDK not installed. Run: pip install 'openai>=1.75.0'"
        )
    if not settings.OPENAI_API_KEY:
        raise OpenAIProviderError(
            "OPENAI_API_KEY is not set in .env. "
            "Get your key at https://platform.openai.com/api-keys"
        )
    if _client is None:
        masked = f"{settings.OPENAI_API_KEY[:8]}******"
        logger.info("[GPT5-CLIENT] Initialising OpenAI client. Key prefix: %s", masked)
        _client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=90.0,       # 90 s hard socket timeout
            max_retries=0,      # We implement our own retry logic
        )
    return _client


def _load_system_prompt() -> str:
    prompt_path = PROMPTS_DIR / "system_prompt.txt"
    try:
        return prompt_path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        logger.warning("[GPT5-CLIENT] system_prompt.txt not found, using inline fallback.")
        return (
            "You are an elite technical interview strategist. "
            "Generate a personalised, day-by-day interview preparation plan as JSON."
        )


# ---------------------------------------------------------------------------
# Language-transition helpers
# ---------------------------------------------------------------------------

def _extract_prog_languages(skills: list) -> set[str]:
    """Return lower-case programming language names from a known_skills list."""
    found: set[str] = set()
    for item in skills:
        if isinstance(item, dict):
            name = item.get("skill", "").lower()
        else:
            name = str(item).lower()
        if name in _PROG_LANGUAGES:
            found.add(name)
    return found


def _get_proficient_languages(known_skills: list) -> list[str]:
    """Return languages where the student is Advanced or Intermediate."""
    result = []
    for item in known_skills:
        if isinstance(item, dict):
            name = item.get("skill", "").lower()
            prof = item.get("proficiency", "").lower()
            if name in _PROG_LANGUAGES and prof in ("advanced", "intermediate"):
                result.append(item.get("skill", name))
    return result


def _build_language_transition_block(context: dict) -> str:
    """
    Build a short LANGUAGE TRANSITION CONTEXT block injected into the user message.
    This activates Section 5 of the system prompt with concrete data.
    """
    known_skills = context.get("known_skills", [])
    primary_skill = context.get("primary_skill", "")
    missing_skills = context.get("missing_skills", [])

    proficient_langs = _get_proficient_languages(known_skills)
    if primary_skill and primary_skill.lower() in _PROG_LANGUAGES:
        if primary_skill not in proficient_langs:
            proficient_langs.insert(0, primary_skill)

    # Detect target languages in missing skills or required skills
    required_skills = context.get("required_skills", [])
    all_required = list(missing_skills) + list(required_skills)
    target_langs = [s for s in all_required if s.lower() in _PROG_LANGUAGES]

    if not proficient_langs and not target_langs:
        return ""  # No language context to add

    lines = ["LANGUAGE TRANSITION CONTEXT:"]
    if proficient_langs:
        lines.append(f"* Student's Proficient Programming Languages: {', '.join(proficient_langs)}")
    else:
        lines.append("* Student's Proficient Programming Languages: Not identified")

    if target_langs:
        lines.append(f"* New Language(s) Required by JD: {', '.join(target_langs)}")
    else:
        lines.append("* New Language(s) Required by JD: None identified")

    if proficient_langs and target_langs:
        transitions = [
            f"{pl} → {tl}"
            for pl in proficient_langs
            for tl in target_langs
            if pl.lower() != tl.lower()
        ]
        if transitions:
            lines.append(
                f"* Active Transition(s): {', '.join(transitions)}"
                " — Embed comparison study INLINE within relevant task descriptions (see system prompt Section 5). Do NOT create a separate transition day or module."
            )
        else:
            lines.append("* No language transition needed (student already knows required languages).")
    else:
        lines.append("* No language transition detected — skip Section 5.")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# User message builder
# ---------------------------------------------------------------------------

def _build_user_message(context: dict) -> str:
    student_name     = context.get("student_name", "Student")
    primary_skill    = context.get("primary_skill", "Not specified")
    known_skills     = context.get("known_skills", [])
    days_available   = context.get("days_available", 7)
    support_mode     = context.get("support_mode", "Guided coaching")
    tone             = context.get("tone", "Supportive")
    coding_required  = context.get("coding_required", True)

    company_name     = context.get("company_name", "Unknown")
    role             = context.get("role", "General")
    difficulty       = context.get("difficulty", "Unknown")
    round_structure  = context.get("round_structure", "Standard")
    jd_text          = context.get("jd_text", "Not provided")

    ats_score        = context.get("ats_score", 0)
    missing_skills   = context.get("missing_skills", [])
    keyword_score    = context.get("keyword_score", 0)

    resume_context      = context.get("resume_context", "Not available")[:800]   # Trimmed for speed
    profile_context     = context.get("profile_context", "Not available")[:400]
    company_intelligence = context.get("company_context", "No company interview intelligence available")[:600]

    # Format known_skills
    known_skills_limited = known_skills[:15] if isinstance(known_skills, list) else []
    skills_lines = []
    for item in known_skills_limited:
        if isinstance(item, dict):
            skills_lines.append(f"  - {item.get('skill', 'Unknown')} [{item.get('proficiency', 'Unknown')}]")
        else:
            skills_lines.append(f"  - {item} [Unknown]")
    known_skills_str = "\n".join(skills_lines) or "  Not specified"

    missing_skills_str = ", ".join(missing_skills) if missing_skills else "None"

    # Truncate JD
    jd_trimmed = jd_text[:500] if jd_text and len(jd_text) > 500 else jd_text

    # Cross-language transition block (activates system prompt Section 5)
    lang_block = _build_language_transition_block(context)
    lang_section = f"\n{lang_block}\n" if lang_block else ""
    marksheet_context = context.get("marksheet_context", "No marksheets uploaded.")

    return f"""STUDENT PROFILE:
* Name: {student_name}
* Primary Skill: {primary_skill}
* Known Skills (with proficiency):
{known_skills_str}
* Days Remaining Until Interview: {days_available}
* Support Mode: {support_mode}
* Preferred Tone: {tone}
* Coding Tasks Required: {coding_required}

STUDENT PROFILE CONTEXT:
{profile_context}

MARKSHEETS (Academic Foundation):
{marksheet_context}

TARGET INTERVIEW — BUILD THE ENTIRE PLAN AROUND THIS:
* Company: {company_name}
* Role: {role}
* Difficulty Level: {difficulty}
* Interview Round Structure: {round_structure}
* Job Description:
{jd_trimmed}

RESUME GAP ANALYSIS — PRIORITIZE THESE IN DAY 1-2:
* ATS Score: {ats_score}%
* Missing Skills: {missing_skills_str}
* Keyword Match Score: {keyword_score}%

RESUME CONTEXT (use for STAR stories):
{resume_context}

COMPANY INTERVIEW INTELLIGENCE:
{company_intelligence}
{lang_section}

GENERATE A {days_available}-DAY PERSONALIZED STUDY PLAN FOR:
→ Student: {student_name} (background: {primary_skill})
→ Target: {role} at {company_name}
→ Time available: {days_available} days
→ Missing skills to fix first: {missing_skills_str}

⚠️ MANDATORY RULES — VIOLATION = REJECTED PLAN:

RULE 1 — ROLE-SPECIFIC CONTENT (MOST IMPORTANT):
The plan MUST cover topics required for "{role}" at "{company_name}".
Read the JD above carefully. Use ONLY the technologies and skills mentioned in the JD.
- Machine Learning Engineer → Python, ML algorithms, scikit-learn, pandas, model evaluation, statistics, feature engineering
- Java Backend Developer → Java, Spring Boot, JPA, REST APIs, Maven, microservices
- Python Developer → Python OOP, FastAPI/Django, async, decorators, testing
- Data Scientist → Python, SQL, statistics, ML, data visualization, EDA
- Frontend Developer → JavaScript/TypeScript, React, CSS, performance
- NEVER generate Java content for a Python/ML role. NEVER generate Python content for a Java role.

RULE 2 — COMPANY-SPECIFIC TASKS:
- Every behavioral task MUST reference "{company_name}" specifically
- "Why {company_name}?" prep task is MANDATORY
- Reference the company's domain in technical tasks

RULE 3 — STUDENT-SPECIFIC TASKS:
- Day 1-2: Address missing skills from gap analysis first (disqualifiers)
- Use resume projects for STAR story tasks
- Support Mode "{support_mode}": Guided = step-by-step; Self-paced = concise; Adaptive = gap-based
- Tone "{tone}": Supportive = encouraging; Direct = no-fluff; Neutral = balanced

RULE 4 — TIME ADAPTATION ({days_available} days):
{"SURVIVAL: Top 5 topics only, rapid Q&A, 3 STAR stories, mental prep" if days_available <= 1 else "SPRINT: High-probability topics, one mock, one behavioral session" if days_available <= 3 else "STRUCTURED: Full JD coverage, mock on day " + str(max(1, days_available - 2)) + ", revision on last day" if days_available <= 7 else "FULL ROADMAP: Week 1 fixes disqualifiers, Week 2+ builds depth and mock interviews"}

RULE 5 — EVERY TASK MUST HAVE qa_pairs AND quiz:
- qa_pairs: 3-5 items per task, each with question + answer + explanation (4+ paragraphs) + transition_note
- quiz: 2-3 MCQs with 4 options, correct_index, explanation
- Last task of EVERY day: "Module Mastery Quiz" (5 qa_pairs + 3 quiz questions)

RULE 6 — SECOND-TO-LAST DAY = CODING MOCK TESTS:
- task_type="code" with real DSA problems relevant to {role}
- Full code_metadata: language, initial_code, solution, difficulty, description, hint, examples, constraints, test_cases (5+)

RULE 7 — LAST DAY = BEHAVIORAL INTERVIEW:
- Focus: "Behavioral Interview"
- Tasks: Tell Me About Yourself, STAR Scenarios, HR Questions, Module Mastery Quiz
- All task_type="qa", NO code tasks

Return ONLY valid JSON. No markdown, no code fences, no explanation text."""


# ---------------------------------------------------------------------------
# Core API call with timeout
# ---------------------------------------------------------------------------

def _call_openai_with_timeout(
    system_prompt: str,
    user_message: str,
    model: str,
    response_schema: Dict[str, Any],
    timeout_seconds: int = 180,
) -> str:
    """
    Call OpenAI chat completions with a hard thread-based timeout.
    Uses structured output (json_schema) to guarantee valid JSON.
    Returns the raw JSON string from the model.
    """
    client = _get_client()

    def _call():
        logger.info("[GPT5-CLIENT] Sending request → model=%s", model)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": response_schema,
            },
            temperature=0.4,
            max_tokens=16000,
        )
        content = response.choices[0].message.content or "{}"
        usage = response.usage
        usage_data = {
            "prompt_tokens": usage.prompt_tokens,
            "completion_tokens": usage.completion_tokens,
            "total_tokens": usage.total_tokens,
            "model": response.model
        } if usage else None
        return content, usage_data

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_call)
        try:
            return future.result(timeout=timeout_seconds)
        except concurrent.futures.TimeoutError as exc:
            raise OpenAITimeoutError(
                f"GPT-5 API call exceeded {timeout_seconds}s timeout"
            ) from exc


# ---------------------------------------------------------------------------
# generate_learning_plan  (public API)
# ---------------------------------------------------------------------------

def generate_learning_plan(context: dict) -> dict:
    """
    Generate a structured learning plan using GPT-5.

    Automatically falls back to gpt-5-mini if the primary model
    hits a rate-limit or quota error.

    Args:
        context: Dict with student profile, target interview, resume gap,
                 company context, and all other plan generation inputs.

    Returns:
        dict: Learning plan — {overview, daily_plan, resources}

    Raises:
        OpenAIProviderError: OpenAI SDK not installed or API key missing.
        OpenAITimeoutError:  Both model attempts timed out.
    """
    system_prompt = _load_system_prompt()
    user_message  = _build_user_message(context)

    primary_model  = getattr(settings, "OPENAI_GENERATION_MODEL", "gpt-5")
    fallback_model = getattr(settings, "OPENAI_FALLBACK_MODEL",   "gpt-5-mini")

    models_to_try = [primary_model]
    if fallback_model and fallback_model != primary_model:
        models_to_try.append(fallback_model)

    last_error: Exception | None = None

    for model in models_to_try:
        for attempt in range(1, 3):          # up to 2 attempts per model
            try:
                logger.info(
                    "[GPT5-PLAN] Attempt %d/%d model=%s", attempt, 2, model
                )
                raw_json, usage = _call_openai_with_timeout(
                    system_prompt, user_message, model, PLAN_SCHEMA
                )
                plan_data = json.loads(raw_json)

                # Basic validation
                if not isinstance(plan_data.get("daily_plan"), list):
                    logger.warning("[GPT5-PLAN] daily_plan missing, retrying…")
                    continue

                logger.info("[GPT5-PLAN] Plan generated successfully model=%s", model)
                return plan_data, usage

            except OpenAITimeoutError as exc:
                last_error = exc
                logger.warning(
                    "[GPT5-PLAN] Timeout on attempt %d model=%s – %s", attempt, model, exc
                )
            except (RateLimitError, APIStatusError) as exc:          # type: ignore[misc]
                last_error = exc
                logger.warning(
                    "[GPT5-PLAN] API error attempt %d model=%s – %s", attempt, model, exc
                )
                # Rate-limit: skip remaining attempts for this model, try fallback
                break
            except json.JSONDecodeError as exc:
                last_error = exc
                logger.warning("[GPT5-PLAN] JSON decode error attempt %d – %s", attempt, exc)
            except Exception as exc:
                last_error = exc
                logger.error("[GPT5-PLAN] Unexpected error attempt %d – %s", attempt, exc)

    # All attempts failed — return fallback plan
    logger.error(
        "[GPT5-PLAN] All GPT-5 attempts failed. last_error=%s. Returning fallback.",
        last_error,
    )
    return _create_fallback_plan(context), None


# ---------------------------------------------------------------------------
# analyze_target_jd  (public API)
# ---------------------------------------------------------------------------

def analyze_target_jd_openai(
    company_name: str,
    role: str,
    jd_text: str,
    company_context: str,
) -> dict:
    """
    Analyse a job description using GPT-5 to extract interview intelligence.

    Returns:
        dict: {required_skills, difficulty, round_structure, summary}
    """
    system_prompt = (
        "You are an expert technical interview analyst who thinks like a hiring manager. "
        "Analyse the target role and extract structured, interview-relevant intelligence. "
        "Focus on what actually gets tested in interviews, not just what is listed in the JD."
    )

    user_message = f"""Company: {company_name}
Role: {role}

Job Description:
{jd_text}

Company Interview Intelligence:
{company_context or 'No additional company context available.'}

Based on the JD and company context determine:
- What skills will ACTUALLY be tested (not just listed as nice-to-have)
- The realistic difficulty level based on company reputation and role seniority
- The likely interview round structure for this type of role
- A concise summary focused on what the candidate MUST demonstrate to get hired

Return structured JSON only."""

    primary_model  = getattr(settings, "OPENAI_GENERATION_MODEL", "gpt-5")
    fallback_model = getattr(settings, "OPENAI_FALLBACK_MODEL",   "gpt-5-mini")
    models_to_try  = [primary_model]
    if fallback_model != primary_model:
        models_to_try.append(fallback_model)

    for model in models_to_try:
        try:
            raw_json, usage = _call_openai_with_timeout(
                system_prompt, user_message, model, JD_ANALYSIS_SCHEMA, timeout_seconds=60
            )
            return json.loads(raw_json), usage
        except (OpenAITimeoutError, json.JSONDecodeError, Exception) as exc:
            logger.warning("[GPT5-JD] %s failed model=%s – %s", type(exc).__name__, model, exc)

    # Fallback result
    return {
        "required_skills": [],
        "difficulty": "unknown",
        "round_structure": "screen -> technical -> behavioral",
        "summary": f"Could not analyse JD for {company_name} ({role}). Prepare broadly.",
    }, None


# ---------------------------------------------------------------------------
# analyze_code_result  (public API)
# ---------------------------------------------------------------------------

def analyze_code_result(
    question: str,
    code: str,
    language: str,
    test_results: list,
    concepts_in_course: list,
) -> dict:
    """
    Analyse submitted code and test cases using GPT-5 to extract a skills report.

    Args:
        question: The description of the coding challenge.
        code: The student's code.
        language: The programming language.
        test_results: A list of dictionaries detailing which tests passed or failed.
        concepts_in_course: The list of concepts covered in the course for this topic.

    Returns:
        dict: { analysis, lagging_skills }
    """
    system_prompt = (
        "You are an expert computer science tutor. "
        "Analyze the student's code and test case results for a coding challenge. "
        "Identify the core reasons why the code failed (e.g., Space Complexity, Edge Cases, Syntax, Logic). "
        "Map these reasons to 'lagging_skills'. Check if each lagging skill is conceptually related "
        "to the 'Concepts in Course'. If it is not covered, set 'in_course' to false so we can inform the student. "
        "Keep the 'analysis' encouraging but technically precise."
    )

    # Format test results for the prompt
    tests_summary = json.dumps(test_results, indent=2)

    user_message = f"""Coding Challenge:
{question}

Concepts in Course:
{json.dumps(concepts_in_course)}

Language: {language}

Student's Code:
```
{code}
```

Test Results:
{tests_summary}

Analyze the student's code and test results. Identify where the student is lagging.
Return structured JSON only matching the code_report schema."""

    primary_model  = getattr(settings, "OPENAI_GENERATION_MODEL", "gpt-5")
    fallback_model = getattr(settings, "OPENAI_FALLBACK_MODEL",   "gpt-5-mini")
    models_to_try  = [primary_model]
    if fallback_model != primary_model:
        models_to_try.append(fallback_model)

    for model in models_to_try:
        try:
            raw_json, usage = _call_openai_with_timeout(
                system_prompt, user_message, model, CODE_REPORT_SCHEMA, timeout_seconds=60
            )
            return json.loads(raw_json), usage
        except (OpenAITimeoutError, json.JSONDecodeError, Exception) as exc:
            logger.warning("[GPT5-CODE-REPORT] %s failed model=%s – %s", type(exc).__name__, model, exc)

    # Fallback result
    return {
        "analysis": "Could not generate AI analysis due to an error. Please review your code manually.",
        "lagging_skills": [],
    }, None


# ---------------------------------------------------------------------------
# Fallback plan (no LLM)
# ---------------------------------------------------------------------------

def _create_fallback_plan(context: dict) -> dict:
    """Rule-based fallback when GPT-5 is unavailable."""
    days    = context.get("days_available", 7)
    company = context.get("company_name",   "Target Company")
    role    = context.get("role",           "the role")

    daily_plan = []
    for day in range(1, days + 1):
        if day == days:
            focus = "Final Revision & Mock Interview"
            tasks = [{
                "title":            "Full Mock Interview Simulation",
                "description":      f"End-to-end interview simulation for {role} at {company}. "
                                    "Cover technical, behavioral, and system-design rounds.",
                "duration_minutes": 120,
            }]
        elif day == 1:
            focus = "Foundation & Gap Assessment"
            tasks = [
                {
                    "title":            "Review Missing Skills",
                    "description":      "Identify and prioritise skill gaps from resume analysis. "
                                        "Create a priority list of what to tackle first.",
                    "duration_minutes": 60,
                },
                {
                    "title":            "Study Core Concepts",
                    "description":      f"Review fundamental concepts required for the {role} role.",
                    "duration_minutes": 90,
                },
            ]
        else:
            focus = f"Skill Building — Day {day}"
            tasks = [
                {
                    "title":            "Technical Practice",
                    "description":      f"Practice key technical skills for {company}.",
                    "duration_minutes": 90,
                },
                {
                    "title":            "Mock Q&A",
                    "description":      f"Solve practice problems relevant to {role}.",
                    "duration_minutes": 60,
                },
            ]
        daily_plan.append({"day": day, "focus": focus, "tasks": tasks})

    return {
        "overview": (
            f"Structured {days}-day preparation plan for {role} at {company}. "
            "Focus on identified skill gaps and interview readiness."
        ),
        "daily_plan": daily_plan,
        "resources": [
            "LeetCode — coding practice",
            "System Design Primer — architecture concepts",
            "Glassdoor — company interview experiences",
        ],
    }
