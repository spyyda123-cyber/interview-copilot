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
    Build the prompt for Prompt 1 (Roadmap Engine) in the new curriculum format.
    """
    prompt_path = PROMPTS_DIR / "plan_prompt.txt"
    try:
        system_prompt = prompt_path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        system_prompt = "You are an elite interview strategist. Analyze the student's profile, resume, gap analysis, and target JD to generate a personalized interview prep curriculum."

    from app.services.openai_client import _build_user_message
    user_message = _build_user_message(context)
    return f"{system_prompt}\n\nStudent Profile and Target Interview JSON:\n{user_message}"


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
