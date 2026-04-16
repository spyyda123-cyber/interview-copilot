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
        "models/gemini-1.5-flash",
        "models/gemini-1.5-pro",
        "models/gemini-1.0-pro",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-1.0-pro",
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


def _generate_content_with_timeout(prompt: str, timeout_seconds: int = 60) -> str:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(_get_generation_model_name())

    def _call():
        return model.generate_content(prompt).text

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

    Also injects cross-language transition context (Section 9).
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

    resume_context       = context.get("resume_context", "Not available")
    profile_context      = context.get("profile_context", "Not available")
    company_intelligence = context.get("company_context", "No company interview intelligence available")

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
    if proficient_langs and target_langs:
        transitions = [f"{p} → {t}" for p in proficient_langs for t in target_langs if p.lower() != t.lower()]
        if transitions:
            lang_lines.append(f"* Active Transitions: {', '.join(transitions)} — Apply Section 9.")
        else:
            lang_lines.append("* No transition needed.")
    else:
        lang_lines.append("* No transition detected — skip Section 9.")
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
Create a day-by-day interview preparation strategy.
If a language transition is detected above, apply Section 9 cross-language analogy teaching.

Rules:
* Prioritize missing skills and Beginner-proficiency required skills FIRST (disqualifiers)
* Treat Advanced skills as strengths to polish, not rebuild
* Include coding tasks only if coding_required is True
* Include explanation practice ("explain out loud") tasks daily
* Include behavioral STAR story preparation from resume projects
* Include at least one mock interview simulation
* Last day = revision + interview simulation only (NO new topics)
* Adapt task difficulty to the student's proficiency level for each skill
* Reference actual resume projects and experiences in task descriptions when possible
* Do NOT invent skills, projects, or experience not present in the data above

Return JSON format:
{{
"overview": "strategy summary",
"daily_plan": [
{{
"day": 1,
"focus": "topic",
"tasks": [
{{
"title": "task name",
"description": "what to do",
"duration_minutes": 60
}}
]
}}
],
"resources": ["resource 1", "resource 2"]
}}"""

    return f"{system_prompt}\n\n{user_prompt}"


def generate_learning_plan(prompt_or_context) -> str:
    """
    Generate a learning plan via the configured LLM provider.

    Accepts either:
    - A pre-built prompt string (Gemini compatibility mode)
    - A context dict (OpenAI mode — builds its own user message)

    When LLM_PROVIDER=openai:
      → Calls GPT-5 via openai_client.generate_learning_plan(context)
      → Returns JSON string of the plan dict for backward compatibility
      → Falls back to Gemini if OpenAI unavailable

    When LLM_PROVIDER=gemini:
      → Calls Gemini with the prompt string (legacy behaviour)
      → Returns raw text response

    Jobs/workers parse the returned string with _parse_plan_json().
    """
    if _use_openai():
        # OpenAI path: context dict expected; if a string was passed wrap it
        if isinstance(prompt_or_context, str):
            # Legacy string prompt — pass as raw context with minimal fields
            logger.info("[LLM-ROUTER] OpenAI mode with raw string prompt (legacy call)")
            context = {"raw_prompt": prompt_or_context}
        else:
            context = prompt_or_context

        logger.info("[LLM-ROUTER] Using OpenAI (GPT-5) for plan generation")
        try:
            plan_dict = _generate_plan_via_openai(context)
            # Return JSON string for backward compat with _parse_plan_json() callers
            return json.dumps(plan_dict)
        except Exception as exc:
            logger.warning(
                "[LLM-ROUTER] GPT-5 failed (%s), falling back to Gemini. Error: %s",
                type(exc).__name__, exc,
            )
            # Fall through to Gemini below

    # Gemini path (primary when LLM_PROVIDER=gemini, or as fallback)
    logger.info("[LLM-ROUTER] Using Gemini for plan generation")
    if isinstance(prompt_or_context, dict):
        prompt = build_learning_plan_prompt(prompt_or_context)
    else:
        prompt = prompt_or_context

    return _generate_content_with_timeout(prompt, timeout_seconds=60)


def analyze_target_jd(
    company_name: str,
    role: str,
    jd_text: str,
    company_context: str,
) -> dict:
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
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end   = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(raw[start: end + 1])
        raise
