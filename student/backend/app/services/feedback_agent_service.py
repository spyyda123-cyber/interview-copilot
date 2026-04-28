"""
Agentic Feedback Analysis Service — Powered by Gemini Flash (free tier).

ROLE IN THE PIPELINE:
  This is the "brain" agent that:
    1. Reads raw student feedback from interview_feedbacks
    2. Runs SQL aggregations (zero LLM cost for numeric metrics)
    3. Calls Gemini 1.5 Flash to extract topic patterns from free-text
    4. Writes pre-built prompt snippets to feedback_analysis_cache
    5. These snippets are injected into plan_service.py prompts

MODEL CHOICE: Gemini 1.5 Flash (Google AI — Free tier)
  - Uses the SAME GEMINI_API_KEY already in .env — no new credentials needed
  - gemini-1.5-flash  → free tier, 15 RPM / 1M TPM / 1500 RPD
  - Perfect for batch analysis tasks (nightly batch won't hit rate limits)
  - Structured JSON output mode for reliable topic extraction
  - Dedicated 30-second timeout separate from plan generation (no interference)
  - Separate from main LLM pipeline: uses its own direct genai call, NOT
    routed through llm_client.py (avoids polluting plan generation state)

AGENTIC BEHAVIOUR:
  - Computes a feedback_hash from all row IDs
  - Skips companies where hash hasn't changed (idempotent — no wasted API calls)
  - Uses Gemini JSON mode for reliable structured extraction
  - Graceful SQL-only fallback if Gemini API call fails for any reason
  - Rate-limit aware: adds 1-second delay between company analyses in batch mode

SECURITY / PRIVACY:
  - Raw student PII is NEVER sent to Gemini
  - Only anonymised free-text (out_of_box_questions) is sent, capped at 20 rows
  - No student IDs, names, or emails are included in any prompt
"""

import concurrent.futures
import hashlib
import json
import logging
import re
import time
from collections import Counter
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

import google.generativeai as genai

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── Gemini model resolution for feedback agent ────────────────────────────────
# Preferred models in priority order: cheapest/fastest first.
# We try each until one works (handles quota exhaustion gracefully).
_FEEDBACK_MODEL_CANDIDATES = [
    "models/gemini-flash-lite-latest",   # Fastest & cheapest free option
    "models/gemini-2.5-flash-lite",
    "models/gemini-flash-latest",
    "models/gemini-2.0-flash",
    "models/gemini-2.5-flash",
    "models/gemini-3-flash-preview",
    "models/gemini-1.5-flash-latest",
    "models/gemini-1.5-flash",
]
_FEEDBACK_TIMEOUT_SECONDS = 45
_resolved_feedback_model: str | None = None


def _resolve_feedback_model() -> str | None:
    """
    Resolve the best available Gemini model for feedback analysis.
    Uses the same dynamic discovery pattern as llm_client.py.
    Cached after first resolution.
    """
    global _resolved_feedback_model
    if _resolved_feedback_model:
        return _resolved_feedback_model

    api_key = getattr(settings, "GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        genai.configure(api_key=api_key)
        available = [
            m.name
            for m in genai.list_models()
            if "generateContent" in (m.supported_generation_methods or [])
        ]
    except Exception as exc:
        logger.warning("[FEEDBACK-AGENT] Could not list Gemini models: %s", exc)
        available = []

    if not available:
        return None

    selected = next(
        (c for c in _FEEDBACK_MODEL_CANDIDATES if c in available),
        available[0],
    )
    _resolved_feedback_model = selected
    logger.info("[FEEDBACK-AGENT] Resolved Gemini model for feedback analysis: %s", selected)
    return selected


# ─── Gemini Flash Call ────────────────────────────────────────────────────────

def _call_gemini_flash(prompt: str) -> Optional[str]:
    """
    Call the best available Gemini model for feedback topic analysis.

    Uses the project's existing GEMINI_API_KEY — no new credentials needed.
    Separate from the main llm_client.py to avoid interference with plan generation.
    Handles quota exhaustion gracefully by resetting cached model on 429.

    Returns:
        Raw text response string, or None on any failure (graceful degradation).
    """
    global _resolved_feedback_model
    api_key = getattr(settings, "GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.warning("[FEEDBACK-AGENT] GEMINI_API_KEY not set — using SQL-only mode")
        return None

    model_name = _resolve_feedback_model()
    if not model_name:
        logger.warning("[FEEDBACK-AGENT] No Gemini model available — using SQL-only mode")
        return None

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)

        def _call():
            return model.generate_content(
                prompt,
                generation_config={"temperature": 0.1, "max_output_tokens": 1024},
            ).text

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call)
            result = future.result(timeout=_FEEDBACK_TIMEOUT_SECONDS)
            logger.info(
                "[FEEDBACK-AGENT] Gemini call succeeded via %s (%d chars)",
                model_name, len(result),
            )
            return result.strip()

    except concurrent.futures.TimeoutError:
        logger.warning(
            "[FEEDBACK-AGENT] Gemini timed out after %ds — using SQL-only mode",
            _FEEDBACK_TIMEOUT_SECONDS,
        )
        return None
    except Exception as exc:
        err = str(exc).lower()
        if "quota" in err or "429" in err or "resource_exhausted" in err:
            logger.warning(
                "[FEEDBACK-AGENT] Gemini quota exhausted for model %s — SQL-only fallback. "
                "Will re-resolve model on next call.",
                model_name,
            )
            _resolved_feedback_model = None  # Reset so next call tries another model
        else:
            logger.warning(
                "[FEEDBACK-AGENT] Gemini call failed (%s) — using SQL-only mode", exc
            )
        return None


# ─── SQL Aggregations (no LLM cost) ───────────────────────────────────────────

def _compute_sql_metrics(db: Session, company_name: str) -> dict:
    """
    Compute all numeric metrics directly from SQL — zero AI cost.

    Metrics computed:
      - feedback_count   : total submissions for this company
      - avg_relevance    : mean of relevance_score (1-5)
      - irrelevant_pct   : % of students who found courses irrelevant
      - most_common_experience : modal value of experience_rating
      - most_common_performance: modal value of performance_rating
      - obq_texts        : list of out_of_box_questions strings (for NLP)
    """
    from shared.models.interview_feedback import InterviewFeedback

    rows = (
        db.query(InterviewFeedback)
        .filter(InterviewFeedback.company_name == company_name)
        .all()
    )

    if not rows:
        return {
            "feedback_count": 0,
            "avg_relevance": None,
            "irrelevant_pct": None,
            "most_common_experience": None,
            "most_common_performance": None,
            "feedback_ids": [],
            "obq_texts": [],
        }

    n = len(rows)
    valid_scores = [r.relevance_score for r in rows if r.relevance_score is not None]
    avg_rel = round(sum(valid_scores) / len(valid_scores), 2) if valid_scores else None
    irrelevant = sum(1 for r in rows if not r.course_relevance)
    irrelevant_pct = round(100.0 * irrelevant / n, 1)

    exp_counter = Counter(r.experience_rating for r in rows if r.experience_rating)
    perf_counter = Counter(r.performance_rating for r in rows if r.performance_rating)
    obq_texts = [r.out_of_box_questions for r in rows if r.out_of_box_questions and r.out_of_box_questions.strip()]

    return {
        "feedback_count": n,
        "avg_relevance": avg_rel,
        "irrelevant_pct": irrelevant_pct,
        "most_common_experience": exp_counter.most_common(1)[0][0] if exp_counter else None,
        "most_common_performance": perf_counter.most_common(1)[0][0] if perf_counter else None,
        "feedback_ids": [r.id for r in rows],
        "obq_texts": obq_texts,
    }


def _compute_feedback_hash(feedback_ids: list[int]) -> str:
    """SHA256 of sorted IDs — cheap staleness check. If unchanged, skip Gemini call."""
    key = ",".join(str(i) for i in sorted(feedback_ids))
    return hashlib.sha256(key.encode()).hexdigest()


# ─── Gemini Flash NLP Topic Extraction ────────────────────────────────────────

def _extract_topics_with_gemini(company_name: str, obq_texts: list[str]) -> list[dict]:
    """
    Use Gemini 1.5 Flash to extract structured interview topics from free-text feedback.

    PROMPT STRATEGY:
      - Sends anonymised out_of_box_questions texts only (no PII)
      - Requests JSON output mode for reliable parsing
      - Capped at 20 responses to stay within free tier token limits
      - Single Gemini call per company (not per student)

    Returns:
        list of {"topic": str, "frequency": int, "category": str}
        Empty list if Gemini unavailable or no useful topics found.
    """
    if not obq_texts:
        logger.info("[FEEDBACK-AGENT] No OBQ texts for %s — skipping Gemini call", company_name)
        return []

    # Cap at 20 to stay in free tier limits (~200-400 tokens input)
    capped_texts = obq_texts[:20]
    combined = "\n---\n".join(capped_texts)

    prompt = f"""You are an expert technical interview analyst.

Past students who interviewed at "{company_name}" reported questions and topics that were NOT covered in their preparation courses. These are their exact responses:

{combined}

Analyze ALL responses above and extract the recurring technical topics that students found unexpected or not in their prep.

Return ONLY a valid JSON array. No explanation, no markdown fences, no extra text. Just the JSON array.

Output format:
[
  {{"topic": "consistent hashing", "frequency": 2, "category": "System Design"}},
  {{"topic": "segment trees", "frequency": 1, "category": "DSA"}}
]

Rules:
- "topic" must be a specific technical concept, not vague like "algorithms"
- "frequency" is how many students mentioned it (estimate from context)
- "category" must be EXACTLY one of: DSA, System Design, Language-Specific, Behavioral, Database, Networking, Domain-Specific
- Include at most 10 topics
- Only include topics with clear evidence from the text
- If no clear technical topics are found, return an empty array: []"""

    logger.info(
        "[FEEDBACK-AGENT] Calling Gemini Flash for topic extraction — company=%s, n_texts=%d",
        company_name, len(capped_texts),
    )
    raw = _call_gemini_flash(prompt)

    if not raw:
        logger.info("[FEEDBACK-AGENT] Gemini returned no response for %s", company_name)
        return []

    # Parse JSON safely — handle markdown fences Gemini sometimes adds
    try:
        cleaned = re.sub(r"```json\s*|```\s*", "", raw).strip()
        # Find JSON array boundaries robustly
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start:end + 1]

        topics = json.loads(cleaned)

        if not isinstance(topics, list):
            logger.warning("[FEEDBACK-AGENT] Gemini returned non-list JSON for %s", company_name)
            return []

        # Validate and filter each topic object
        valid_categories = {
            "DSA", "System Design", "Language-Specific",
            "Behavioral", "Database", "Networking", "Domain-Specific",
        }
        validated = []
        for t in topics:
            if not isinstance(t, dict):
                continue
            topic = str(t.get("topic", "")).strip()
            frequency = t.get("frequency", 1)
            category = str(t.get("category", "Domain-Specific")).strip()
            if topic and isinstance(frequency, (int, float)):
                validated.append({
                    "topic": topic,
                    "frequency": int(frequency),
                    "category": category if category in valid_categories else "Domain-Specific",
                })

        logger.info(
            "[FEEDBACK-AGENT] Extracted %d valid topics for %s via Gemini Flash",
            len(validated), company_name,
        )
        return validated

    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning(
            "[FEEDBACK-AGENT] Failed to parse Gemini topic JSON for %s: %s | raw_sample=%s",
            company_name, exc, raw[:300],
        )
        return []


# ─── Prompt Snippet Builder ────────────────────────────────────────────────────

def _build_prompt_snippet(company_name: str, metrics: dict, topics: list[dict]) -> str:
    """
    Build a ready-to-inject intelligence paragraph for plan generation prompts.

    This snippet is written into feedback_analysis_cache.prompt_snippet and
    injected verbatim into the plan summary LLM prompt by jobs.py.

    Design goal: immediately actionable instruction for the plan LLM —
    tells it what to emphasise based on REAL past student experience.
    """
    n = metrics["feedback_count"]
    avg = metrics["avg_relevance"]
    irr = metrics["irrelevant_pct"]

    lines = [
        f"REAL STUDENT INTERVIEW INTELLIGENCE — {company_name.upper()} ({n} past interview(s), analysed by Gemini AI):",
    ]

    if avg is not None:
        lines.append(f"• Average course relevance score from past students: {avg}/5")
    if irr is not None:
        lines.append(f"• Students who found standard courses insufficient for this company: {irr}%")
    if metrics.get("most_common_experience"):
        lines.append(f"• Most reported interview difficulty: {metrics['most_common_experience']}")
    if metrics.get("most_common_performance"):
        lines.append(f"• Most reported self-performance: {metrics['most_common_performance']}")

    if topics:
        lines.append("• Topics asked in interview that were NOT covered in standard courses (PRIORITISE THESE):")
        for t in topics[:8]:
            lines.append(
                f"    – [{t['category']}] {t['topic']}  (reported by ~{t['frequency']} student(s))"
            )

    # Actionable LLM instruction based on data quality
    if avg is not None and avg < 3.0:
        lines.append(
            "\nPLAN INSTRUCTION: Course relevance is LOW for this company. "
            "Explicitly add dedicated sessions to bridge the gap between standard course material "
            "and what this company actually tests. Reference the topics above."
        )
    elif topics:
        lines.append(
            "\nPLAN INSTRUCTION: Past students were surprised by the topics listed above. "
            "Add at least one dedicated task per these topics, especially in the final 2 days."
        )
    else:
        lines.append(
            "\nPLAN INSTRUCTION: Limited topic surprise data. Focus on role-standard preparation."
        )

    return "\n".join(lines)


# ─── Main Agent: Refresh One Company ──────────────────────────────────────────

def refresh_company_analysis(db: Session, company_name: str) -> bool:
    """
    Core agentic function: analyse all feedback for one company and update cache.

    PIPELINE:
      1. SQL aggregations (always — zero LLM cost, < 10ms)
      2. Compute feedback_hash → skip entirely if unchanged (idempotent)
      3. Gemini Flash NLP → extract missing_topics from out_of_box_questions
         (1 API call per company, only when feedback is new/changed)
      4. Build prompt_snippet (deterministic string, no AI)
      5. Upsert into feedback_analysis_cache

    Args:
        db: SQLAlchemy session
        company_name: Target company to analyse

    Returns:
        True if cache was updated, False if skipped (already up-to-date).
    """
    from shared.models.feedback_analysis import FeedbackAnalysisCache

    logger.info("[FEEDBACK-AGENT] Starting analysis for company: %s", company_name)

    # Step 1 – SQL metrics (no LLM)
    metrics = _compute_sql_metrics(db, company_name)
    if metrics["feedback_count"] == 0:
        logger.info("[FEEDBACK-AGENT] No feedback for %s — skipping", company_name)
        return False

    # Step 2 – Staleness check (avoid redundant Gemini calls)
    new_hash = _compute_feedback_hash(metrics["feedback_ids"])
    existing = (
        db.query(FeedbackAnalysisCache)
        .filter(FeedbackAnalysisCache.company_name == company_name)
        .first()
    )
    if existing and existing.feedback_hash == new_hash:
        logger.info(
            "[FEEDBACK-AGENT] Cache is fresh for %s (hash unchanged) — no Gemini call needed",
            company_name,
        )
        return False

    # Step 3 – Gemini Flash topic extraction (1 call per company)
    topics = _extract_topics_with_gemini(company_name, metrics["obq_texts"])

    # Step 4 – Build prompt snippet
    snippet = _build_prompt_snippet(company_name, metrics, topics)

    # Step 5 – Upsert into feedback_analysis_cache
    now = datetime.utcnow()
    if existing:
        existing.feedback_count = metrics["feedback_count"]
        existing.avg_relevance = metrics["avg_relevance"]
        existing.irrelevant_pct = metrics["irrelevant_pct"]
        existing.most_common_experience = metrics["most_common_experience"]
        existing.most_common_performance = metrics["most_common_performance"]
        existing.missing_topics = {"topics": topics}
        existing.prompt_snippet = snippet
        existing.last_refreshed = now
        existing.feedback_hash = new_hash
    else:
        db.add(FeedbackAnalysisCache(
            company_name=company_name,
            feedback_count=metrics["feedback_count"],
            avg_relevance=metrics["avg_relevance"],
            irrelevant_pct=metrics["irrelevant_pct"],
            most_common_experience=metrics["most_common_experience"],
            most_common_performance=metrics["most_common_performance"],
            missing_topics={"topics": topics},
            prompt_snippet=snippet,
            last_refreshed=now,
            feedback_hash=new_hash,
        ))

    db.commit()
    logger.info(
        "[FEEDBACK-AGENT] ✓ Cache updated for %s — feedbacks=%d topics_found=%d",
        company_name, metrics["feedback_count"], len(topics),
    )
    return True


# ─── Public: Get Intelligence for Plan Prompt Injection ───────────────────────

def get_feedback_intelligence(db: Session, company_name: str) -> str:
    """
    Called by plan_service._get_feedback_intelligence() and jobs.py during plan generation.

    Reads the pre-built snippet from feedback_analysis_cache — ZERO extra LLM cost at runtime.
    The snippet was already generated by the Gemini Flash agent in a background Celery task.

    Falls back gracefully if no cache exists yet (first student for that company).
    """
    from shared.models.feedback_analysis import FeedbackAnalysisCache

    cache = (
        db.query(FeedbackAnalysisCache)
        .filter(FeedbackAnalysisCache.company_name == company_name)
        .first()
    )

    if cache and cache.prompt_snippet:
        logger.info(
            "[FEEDBACK-AGENT] Serving Gemini-analysed intelligence for %s (%d feedbacks, refreshed %s)",
            company_name, cache.feedback_count,
            cache.last_refreshed.strftime("%Y-%m-%d %H:%M UTC") if cache.last_refreshed else "unknown",
        )
        return cache.prompt_snippet

    logger.info("[FEEDBACK-AGENT] No cached intelligence for %s yet — using generic fallback", company_name)
    return (
        f"No prior student interview data available for {company_name} yet. "
        "Prepare using standard interview expectations for this company."
    )
