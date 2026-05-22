"""Topic Learning Engine — Prompt 2 API endpoint.

Called when a student clicks a topic for the first time.
Generates deep study content: core concepts, interview traps, practice tasks, quiz.

CACHING:
- Cache key: student_id:topic_id
- Cache hit → return stored JSON immediately (no API call)
- Cache miss → fire Prompt 2, store result, return

FLOW:
1. Check Redis/DB cache for student_id:topic_id
2. Cache hit → return immediately
3. Cache miss → assemble user message from Prompt 1 output + student session
4. Call GPT-4o with system_prompt_topic.txt
5. Store result in topic_content table
6. Return to frontend
"""
import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import get_db
from app.models import Student, StudentProfile, TargetInterview, LearningPlan
from app.services.plan_service import build_plan_signature

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/topic", tags=["topic"])

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"


def _load_topic_prompt() -> str:
    prompt_path = PROMPTS_DIR / "system_prompt_topic.txt"
    try:
        content = prompt_path.read_text(encoding="utf-8").strip()
        logger.info("[TOPIC] Loaded system_prompt_topic.txt length=%d path=%s", len(content), prompt_path)
        return content
    except FileNotFoundError:
        logger.warning("[TOPIC] system_prompt_topic.txt not found at %s — using fallback", prompt_path)
        return "You are an expert technical educator. Generate deep interview-focused study content for the given topic as JSON with fields: topic_id, topic_name, difficulty, frequency_label, mastery_time_minutes, strategic_insights, core_concepts (array with id, title, summary, content fields), interview_traps (array with title, description), practice_tasks, quiz, visual_explanation, communication_tips."


def _get_cached_topic(db: Session, student_id: int, topic_id: str) -> dict | None:
    """Check DB cache for topic content."""
    try:
        result = db.execute(
            text("SELECT content FROM topic_content WHERE student_id=:sid AND topic_id=:tid"),
            {"sid": student_id, "tid": topic_id}
        ).fetchone()
        if result:
            return json.loads(result[0]) if isinstance(result[0], str) else result[0]
    except Exception as e:
        logger.warning("[TOPIC] Cache read failed: %s", e)
        db.rollback()
    return None


def _cache_topic(db: Session, student_id: int, topic_id: str, content: dict) -> None:
    """Store topic content in DB cache."""
    try:
        content_str = json.dumps(content)
        # Upsert
        db.execute(
            text("""
                INSERT INTO topic_content (student_id, topic_id, content, created_at)
                VALUES (:sid, :tid, CAST(:content AS json), NOW())
                ON CONFLICT (student_id, topic_id)
                DO UPDATE SET content = CAST(:content AS json), created_at = NOW()
            """),
            {"sid": student_id, "tid": topic_id, "content": content_str}
        )
        db.commit()
    except Exception as e:
        logger.warning("[TOPIC] Failed to cache topic content: %s", e)
        try:
            db.rollback()
        except Exception:
            pass


def _generate_topic_content(
    topic_id: str,
    topic_name: str,
    sub_topics: list,
    difficulty: str,
    mastery_time_minutes: int,
    target_role: str,
    company: str,
    target_language: str,
    interview_round_type: str,
    coding_required: bool,
    student_known_skills: list,
) -> dict:
    """Generate topic content via Gemini (new SDK v1 API) with multi-tier fallback.

    Tier 1 (Primary):  GEMINI_GENERATION_MODEL env var (default: gemini-2.5-pro) — new SDK v1
    Tier 2 (Fallback): GEMINI_FALLBACK_MODEL env var (default: gemini-2.5-flash) — new SDK v1
    Tier 3 (Safety):   gemini-1.5-flash — old SDK v1beta (maximum compatibility)
    """
    import concurrent.futures
    from app.core.config import settings

    system_prompt = _load_topic_prompt()

    user_payload = json.dumps({
        "topic_id": topic_id,
        "topic_name": topic_name,
        "sub_topics": sub_topics,
        "difficulty": difficulty,
        "mastery_time_minutes": mastery_time_minutes,
        "target_role": target_role,
        "company": company,
        "target_language": target_language,
        "interview_round_type": interview_round_type,
        "coding_required": coding_required,
        "student_known_skills": student_known_skills,
    }, ensure_ascii=False)

    full_prompt = f"{system_prompt}\n\nStudent topic request (JSON):\n{user_payload}"

    gemini_api_key = getattr(settings, "GEMINI_API_KEY", "").strip()
    if not gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set — add it to .env.prod")

    # Force gemini-2.5-flash for topic generation to ensure lightning-fast real-time load times (3-8 seconds vs 40+ seconds)
    primary_model = "gemini-2.5-flash"
    fallback_model = "gemini-1.5-flash"

    # Normalise model names: strip "models/" prefix for new SDK (it uses bare names)
    def _normalise_for_new_sdk(name: str) -> str:
        return name.removeprefix("models/")

    def _parse_raw(raw: str) -> dict:
        """Strip markdown fences and parse JSON."""
        stripped = raw.strip()
        if stripped.startswith("```"):
            stripped = stripped.split("\n", 1)[-1]
            stripped = stripped.rsplit("```", 1)[0].strip()
        return json.loads(stripped)

    # ── New SDK (google-genai, v1 API) — used for primary and fallback ────────
    def _call_new_sdk(model_name: str) -> dict:
        from google import genai as new_genai
        from google.genai import types as genai_types

        normalised = _normalise_for_new_sdk(model_name)
        client = new_genai.Client(api_key=gemini_api_key)
        logger.info("[TOPIC] Calling Gemini (new SDK) model=%s topic=%s", normalised, topic_id)
        response = client.models.generate_content(
            model=normalised,
            contents=full_prompt,
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.4,
                max_output_tokens=16000,
            ),
        )
        raw = response.text or "{}"
        logger.info("[TOPIC] Raw response length=%d model=%s", len(raw), normalised)
        parsed = _parse_raw(raw)
        logger.info("[TOPIC] Parsed keys=%s", list(parsed.keys())[:10])
        return parsed

    # ── Old SDK (google-generativeai, v1beta) — safety net for gemini-1.5-flash ──
    def _call_old_sdk_flash() -> dict:
        import google.generativeai as genai_old

        model_name = "gemini-1.5-flash"
        genai_old.configure(api_key=gemini_api_key)
        logger.info("[TOPIC] Calling Gemini safety-net (old SDK) model=%s topic=%s", model_name, topic_id)
        model = genai_old.GenerativeModel(
            model_name,
            generation_config=genai_old.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.4,
                max_output_tokens=8192,
            ),
        )
        response = model.generate_content(full_prompt)
        raw = response.text or "{}"
        logger.info("[TOPIC] Raw response length=%d model=%s", len(raw), model_name)
        parsed = _parse_raw(raw)
        logger.info("[TOPIC] Parsed keys=%s", list(parsed.keys())[:10])
        return parsed

    # ── Tier 1: Primary model ─────────────────────────────────────────────────
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call_new_sdk, primary_model)
            result = future.result(timeout=240)
        if result.get("strategic_insights") or result.get("core_concepts"):
            logger.info("[TOPIC] Tier 1 succeeded model=%s topic=%s", primary_model, topic_id)
            return result
        logger.warning("[TOPIC] Empty response from tier-1 %s keys=%s", primary_model, list(result.keys()))
    except Exception as exc:
        logger.warning("[TOPIC] Tier 1 %s failed for topic=%s: %s", primary_model, topic_id, exc)

    # ── Tier 2: Fallback model (new SDK) ──────────────────────────────────────
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call_new_sdk, fallback_model)
            result = future.result(timeout=180)
        if result.get("strategic_insights") or result.get("core_concepts"):
            logger.info("[TOPIC] Tier 2 succeeded model=%s topic=%s", fallback_model, topic_id)
            return result
        logger.warning("[TOPIC] Empty response from tier-2 %s keys=%s", fallback_model, list(result.keys()))
    except Exception as exc:
        logger.warning("[TOPIC] Tier 2 %s failed for topic=%s: %s", fallback_model, topic_id, exc)

    # ── Tier 3: Safety net (old SDK, gemini-1.5-flash) ────────────────────────
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call_old_sdk_flash)
            result = future.result(timeout=180)
        if result.get("strategic_insights") or result.get("core_concepts"):
            logger.info("[TOPIC] Tier 3 safety-net succeeded topic=%s", topic_id)
            return result
        logger.warning("[TOPIC] Empty response from tier-3 safety-net keys=%s", list(result.keys()))
    except Exception as exc:
        logger.warning("[TOPIC] Tier 3 safety-net failed for topic=%s: %s", topic_id, exc)

    raise RuntimeError(f"All models failed for topic {topic_id}")



@router.get("/{student_id}/{topic_id}")
def get_topic_content(
    student_id: int,
    topic_id: str,
    target_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Get deep study content for a topic (Prompt 2 — Topic Learning Engine).

    Returns cached content if available, otherwise generates via GPT-4o.
    """
    logger.error("============= GET TOPIC CALLED =============")
    logger.error("student_id=%s, topic_id=%s, target_id=%s", student_id, topic_id, target_id)

    # 1. Check cache
    cached = _get_cached_topic(db, student_id, topic_id)
    if cached:
        logger.info("[TOPIC] Cache hit student_id=%s topic_id=%s", student_id, topic_id)
        return cached

    # 2. Load student profile and target
    profile = db.query(StudentProfile).filter(StudentProfile.student_id == student_id).first()
    target = db.query(TargetInterview).filter(
        TargetInterview.id == target_id,
        TargetInterview.student_id == student_id
    ).first()

    if not target:
        logger.error("Target NOT FOUND for target_id=%s student_id=%s", target_id, student_id)
        raise HTTPException(status_code=404, detail="Target interview not found")

    # 3. Load Prompt 1 output to get sub_topics and difficulty for this topic
    plan_signature = build_plan_signature(student_id, target.company_name, target.role)
    plan = db.query(LearningPlan).filter(
        LearningPlan.plan_signature == plan_signature,
        LearningPlan.status == "ready"
    ).first()

    topic_data = None
    sub_topics = []
    difficulty = "medium"

    if plan and plan.plan_json:
        if plan.plan_json.get("curriculum"):
            for category in plan.plan_json["curriculum"]:
                for topic in category.get("topics", []):
                    if topic["id"] == topic_id:
                        topic_data = topic
                        sub_topics = topic.get("sub_topics", [])
                        difficulty = topic.get("difficulty", "medium")
                        break
        elif plan.plan_json.get("daily_plan"):
            for day in plan.plan_json["daily_plan"]:
                focus = day.get("focus", "")
                legacy_id = focus.lower().replace(" ", "-")
                if legacy_id == topic_id or focus == topic_id:
                    topic_data = {"title": focus, "mastery_time_minutes": 60}
                    sub_topics = [
                        {"id": f"{legacy_id}-concept-1", "title": f"Core {focus} Concepts"},
                        {"id": f"{legacy_id}-concept-2", "title": f"Advanced {focus} Patterns"},
                        {"id": f"{legacy_id}-concept-3", "title": f"{focus} in Production"}
                    ]
                    difficulty = "medium"
                    break

    if not topic_data:
        logger.error("Topic '%s' NOT FOUND in curriculum! Available topics: %s", topic_id, 
                     [t.get('id') for c in plan.plan_json.get("curriculum", []) for t in c.get("topics", [])] if plan and plan.plan_json else "None/No Plan")
        raise HTTPException(status_code=404, detail=f"Topic '{topic_id}' not found in curriculum")

    # 4. Build context for Prompt 2
    known_skills = []
    target_language = "Python"  # default
    if profile:
        known_skills = [
            {"skill": s.get("skill", ""), "proficiency": s.get("proficiency", "beginner")}
            for s in (profile.known_skills or [])
            if isinstance(s, dict)
        ]
        if profile.primary_skill:
            target_language = profile.primary_skill

    # Derive target language from role if not set
    role_lower = (target.role or "").lower()
    if "java" in role_lower:
        target_language = "Java"
    elif "python" in role_lower:
        target_language = "Python"
    elif "javascript" in role_lower or "node" in role_lower:
        target_language = "JavaScript"

    interview_round_type = target.round_structure or "mixed"

    # 5. Generate content via Prompt 2 (v1.1)
    mastery_time_minutes = topic_data.get("mastery_time_minutes", 60)
    coding_required = profile.coding_required if profile else True

    logger.info("[TOPIC] Cache miss — generating content for student_id=%s topic_id=%s", student_id, topic_id)
    try:
        content = _generate_topic_content(
            topic_id=topic_id,
            topic_name=topic_data["title"],
            sub_topics=sub_topics,
            difficulty=difficulty,
            mastery_time_minutes=mastery_time_minutes,
            target_role=target.role or "General",
            company=target.company_name,
            target_language=target_language,
            interview_round_type=interview_round_type,
            coding_required=coding_required,
            student_known_skills=known_skills,
        )
    except Exception as exc:
        logger.error("[TOPIC] Generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Topic content generation failed: {str(exc)}")

    # 6. Cache and return
    _cache_topic(db, student_id, topic_id, content)
    return content


@router.delete("/{student_id}/{topic_id}")
def reset_topic_content(
    student_id: int,
    topic_id: str,
    db: Session = Depends(get_db),
):
    """Clear cached topic content to force regeneration."""
    try:
        db.execute(
            text("DELETE FROM topic_content WHERE student_id=:sid AND topic_id=:tid"),
            {"sid": student_id, "tid": topic_id}
        )
        db.commit()
    except Exception:
        db.rollback()
    return {"status": "cleared", "topic_id": topic_id}
