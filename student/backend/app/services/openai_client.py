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
                                },
                                "required": ["title", "description", "duration_minutes"],
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

    resume_context      = context.get("resume_context", "Not available")[:1500]  # Limit to 1500 chars
    profile_context     = context.get("profile_context", "Not available")[:800]
    company_intelligence = context.get("company_context", "No company interview intelligence available")[:1500]

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
    jd_trimmed = jd_text[:800] if jd_text and len(jd_text) > 800 else jd_text

    # Cross-language transition block (activates system prompt Section 5)
    lang_block = _build_language_transition_block(context)
    lang_section = f"\n{lang_block}\n" if lang_block else ""

    return f"""STUDENT PROFILE:

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
{lang_section}
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
Create a day-by-day interview preparation strategy following ALL sections of the system prompt.
If a language transition is detected above, embed comparison study INLINE within relevant task descriptions on Day 1-2 only (see system prompt Section 5). Do NOT create a separate transition day or module.

Rules:
* Prioritize missing skills and Beginner-proficiency required skills FIRST (disqualifiers)
* Treat Advanced skills as strengths to polish, not rebuild
* Include coding tasks only if coding_required is True
* Include "explain out loud" tasks daily
* Include behavioral STAR story preparation from resume projects
* Include at least one full mock interview simulation
* Last day = revision + interview simulation ONLY (no new topics)
* Adapt difficulty to the student's proficiency level per skill
* Reference actual resume projects and experiences when possible
* Do NOT invent skills, projects, or experience not in the data above

Return ONLY valid JSON matching the schema. No markdown, no explanations."""


# ---------------------------------------------------------------------------
# Core API call with timeout
# ---------------------------------------------------------------------------

def _call_openai_with_timeout(
    system_prompt: str,
    user_message: str,
    model: str,
    response_schema: Dict[str, Any],
    timeout_seconds: int = 90,
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
            temperature=0.3,
            max_tokens=2500,
        )
        content = response.choices[0].message.content or "{}"
        usage = response.usage
        if usage:
            logger.info(
                "[GPT5-CLIENT] Tokens used → prompt=%s completion=%s total=%s",
                usage.prompt_tokens, usage.completion_tokens, usage.total_tokens,
            )
        return content

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
                raw_json = _call_openai_with_timeout(
                    system_prompt, user_message, model, PLAN_SCHEMA
                )
                plan_data = json.loads(raw_json)

                # Basic validation
                if not isinstance(plan_data.get("daily_plan"), list):
                    logger.warning("[GPT5-PLAN] daily_plan missing, retrying…")
                    continue

                logger.info("[GPT5-PLAN] Plan generated successfully model=%s", model)
                return plan_data

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
    return _create_fallback_plan(context)


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
            raw_json = _call_openai_with_timeout(
                system_prompt, user_message, model, JD_ANALYSIS_SCHEMA, timeout_seconds=60
            )
            return json.loads(raw_json)
        except (OpenAITimeoutError, json.JSONDecodeError, Exception) as exc:
            logger.warning("[GPT5-JD] %s failed model=%s – %s", type(exc).__name__, model, exc)

    # Fallback result
    return {
        "required_skills": [],
        "difficulty": "unknown",
        "round_structure": "screen -> technical -> behavioral",
        "summary": f"Could not analyse JD for {company_name} ({role}). Prepare broadly.",
    }


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
            raw_json = _call_openai_with_timeout(
                system_prompt, user_message, model, CODE_REPORT_SCHEMA, timeout_seconds=60
            )
            return json.loads(raw_json)
        except (OpenAITimeoutError, json.JSONDecodeError, Exception) as exc:
            logger.warning("[GPT5-CODE-REPORT] %s failed model=%s – %s", type(exc).__name__, model, exc)

    # Fallback result
    return {
        "analysis": "Could not generate AI analysis due to an error. Please review your code manually.",
        "lagging_skills": [],
    }


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
