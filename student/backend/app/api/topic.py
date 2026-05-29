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
    fallback_model = "gemini-2.0-flash"  # gemini-1.5-flash deprecated on v1beta

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

    # ── Old SDK (google-generativeai, v1beta) — safety net for gemini-2.0-flash ──
    def _call_old_sdk_flash() -> dict:
        import google.generativeai as genai_old

        model_name = "gemini-2.0-flash"  # gemini-1.5-flash deprecated on v1beta
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
                # Also try to match by replacing slashes and special chars
                legacy_id_clean = focus.lower().replace(" ", "-").replace("/", "-").replace("&", "and")
                if legacy_id == topic_id or focus == topic_id or legacy_id_clean == topic_id:
                    topic_data = {"title": focus, "mastery_time_minutes": 60}
                    sub_topics = [
                        {"id": f"{legacy_id}-concept-1", "title": f"Core {focus} Concepts"},
                        {"id": f"{legacy_id}-concept-2", "title": f"Advanced {focus} Patterns"},
                        {"id": f"{legacy_id}-concept-3", "title": f"{focus} in Production"}
                    ]
                    difficulty = "medium"
                    break

    # ── Graceful fallback: topic_id is a default behavioral/foundation/leadership topic ──
    # Instead of 404, generate content from the topic slug (handles defaultBehavioralTopics,
    # defaultFoundationTopics etc. that may not exist in legacy daily_plan format)
    if not topic_data:
        logger.warning(
            "[TOPIC] '%s' not in plan curriculum/daily_plan — attempting graceful AI generation from slug",
            topic_id
        )
        # Derive a human-readable title from the slug
        slug_title = topic_id.replace("-", " ").replace("_", " ").title()

        # Detect topic category from the slug to build context-aware sub_topics
        slug_lower = topic_id.lower()
        is_behavioral = any(k in slug_lower for k in [
            "conflict", "leadership", "culture", "ethical", "pressure",
            "feedback", "adapt", "stakeholder", "goal", "failure", "team",
            "behavioral", "star", "hr", "communication"
        ])
        is_dsa = any(k in slug_lower for k in [
            "array", "linked", "tree", "graph", "dynamic", "sorting",
            "search", "stack", "queue", "hash", "recursion"
        ])

        if is_behavioral:
            sub_topics = [
                {"id": f"{topic_id}-star", "title": f"STAR Method for {slug_title}"},
                {"id": f"{topic_id}-examples", "title": f"Example Scenarios: {slug_title}"},
                {"id": f"{topic_id}-pitfalls", "title": f"Common Mistakes in {slug_title} Interviews"},
            ]
            difficulty = "medium"
        elif is_dsa:
            sub_topics = [
                {"id": f"{topic_id}-fundamentals", "title": f"{slug_title} Fundamentals"},
                {"id": f"{topic_id}-patterns", "title": f"Common {slug_title} Patterns"},
                {"id": f"{topic_id}-practice", "title": f"{slug_title} Practice Problems"},
            ]
            difficulty = "medium"
        else:
            sub_topics = [
                {"id": f"{topic_id}-core", "title": f"Core {slug_title} Concepts"},
                {"id": f"{topic_id}-advanced", "title": f"Advanced {slug_title} Patterns"},
                {"id": f"{topic_id}-interview", "title": f"{slug_title} in Interviews"},
            ]
            difficulty = "medium"

        topic_data = {
            "title": slug_title,
            "mastery_time_minutes": 45,
            "difficulty": difficulty,
        }

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
    
    # Check if the topic is behavioral based on ID or category
    is_topic_behavioral = False
    if topic_data:
        topic_lower = topic_id.lower()
        title_lower = topic_data.get("title", "").lower()
        stage_id = topic_data.get("stage_id", "").lower()
        if "behavioral" in stage_id or "leadership" in stage_id:
            is_topic_behavioral = True
        elif any(k in topic_lower or k in title_lower for k in [
            "conflict", "leadership", "culture", "ethical", "pressure",
            "feedback", "adapt", "stakeholder", "goal", "failure", "team",
            "behavioral", "star", "hr", "communication", "tell me about yourself",
            "research", "company research"
        ]):
            is_topic_behavioral = True

    # 5. Generate content via Prompt 2 (v1.1)
    mastery_time_minutes = topic_data.get("mastery_time_minutes", 60)
    coding_required = False if is_topic_behavioral else (profile.coding_required if profile else True)

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


# ─────────────────────────────────────────────────────────
# STAR Method Evaluator  
# ─────────────────────────────────────────────────────────

class STARRequest(dict):
    pass

from pydantic import BaseModel
from typing import Optional

class STAREvaluateRequest(BaseModel):
    topic_id: str
    behavioral_question: str
    student_answer: str
    target_role: Optional[str] = "General"
    company: Optional[str] = ""

class STAREvaluateResponse(BaseModel):
    overall_score: int  # 0-100
    grade: str          # "Excellent", "Good", "Needs Work", "Incomplete"
    situation_feedback: str
    task_feedback: str
    action_feedback: str
    result_feedback: str
    strengths: list[str]
    improvements: list[str]
    improved_answer_hint: str
    is_behavioral: bool


@router.post("/star-evaluate", response_model=STAREvaluateResponse)
def evaluate_star_response(
    payload: STAREvaluateRequest,
    db: Session = Depends(get_db),
):
    """
    Evaluate a student's STAR behavioral answer using AI.
    Returns structured feedback on each STAR component.
    """
    from app.core.config import settings

    gemini_api_key = getattr(settings, "GEMINI_API_KEY", "").strip()
    if not gemini_api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    system_prompt = """
You are an expert behavioral interview coach specializing in the STAR method.
Evaluate the student's behavioral answer and respond with a JSON object.

STAR Components:
- Situation: Sets context (when, where, what was happening)
- Task: Student's specific responsibility
- Action: Specific steps the student personally took (use "I" not "we")
- Result: Measurable, quantified outcome

Return JSON with exactly these fields:
{
  "overall_score": <integer 0-100>,
  "grade": "Excellent" | "Good" | "Needs Work" | "Incomplete",
  "situation_feedback": "<feedback on Situation component>",
  "task_feedback": "<feedback on Task component>",
  "action_feedback": "<feedback on Action component>",
  "result_feedback": "<feedback on Result component>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<area to improve 1>", "<area to improve 2>"],
  "improved_answer_hint": "<one concrete tip to make the answer stronger>",
  "is_behavioral": true
}

Scoring guide:
- 80-100 (Excellent): Clear S/T/A/R with measurable result
- 60-79 (Good): Most components present but result not quantified
- 40-59 (Needs Work): Missing key component or too vague
- 0-39 (Incomplete): Answer does not follow STAR structure
"""

    user_message = json.dumps({
        "behavioral_question": payload.behavioral_question,
        "student_answer": payload.student_answer,
        "target_role": payload.target_role,
        "company": payload.company,
        "topic": payload.topic_id,
    }, ensure_ascii=False)

    full_prompt = f"{system_prompt}\n\nStudent response to evaluate:\n{user_message}"

    try:
        from google import genai as new_genai
        from google.genai import types as genai_types

        client = new_genai.Client(api_key=gemini_api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_prompt,
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
                max_output_tokens=2048,
            ),
        )
        raw = response.text or "{}"
        # Strip markdown fences if present
        stripped = raw.strip()
        if stripped.startswith("```"):
            stripped = stripped.split("\n", 1)[-1]
            stripped = stripped.rsplit("```", 1)[0].strip()
        result = json.loads(stripped)
        return STAREvaluateResponse(
            overall_score=result.get("overall_score", 50),
            grade=result.get("grade", "Needs Work"),
            situation_feedback=result.get("situation_feedback", "No feedback available."),
            task_feedback=result.get("task_feedback", "No feedback available."),
            action_feedback=result.get("action_feedback", "No feedback available."),
            result_feedback=result.get("result_feedback", "No feedback available."),
            strengths=result.get("strengths", []),
            improvements=result.get("improvements", []),
            improved_answer_hint=result.get("improved_answer_hint", ""),
            is_behavioral=True,
        )
    except Exception as exc:
        logger.error("[STAR] AI evaluation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"STAR evaluation failed: {str(exc)}")
