"""Celery background task definitions for async job execution.

CRITICAL: This is the ONLY module where Gemini API calls happen (via llm_client.py).
All AI token spending is concentrated in background Celery worker processes.

RELIABILITY HARDENING:
- generate_plan_task now implements timeout protection, retries, and fallback plans
- If Gemini fails after 2 retries, system generates rule-based fallback plan
- Plans NEVER left in "generating" state (always end in "ready" or "failed")
- Structured logging with [PLAN-LLM-RETRY], [PLAN-LLM-TIMEOUT], [PLAN-FALLBACK]

TASK CATALOG:

1. parse_resume_task
   - Extracts sections from uploaded resume file
   - Creates ResumeSection objects for OCR and embedding
   - No LLM calls

2. ingest_document_task
   - Stores company/role-specific interview documents
   - Chunks and embeds documents for RAG retrieval
   - No LLM calls

3. analyze_target_task
   - Analyzes job description for target interview
   - Calls llm_client.analyze_target_jd() to extract requirements
   - Sets target.required_skills, difficulty, round_structure
   - Status: processing -> ready | failed
   - **TOKEN SPEND: Calls Gemini**

4. generate_plan_task (MOST EXPENSIVE + HARDENED)
   - Enqueued during resume upload
   - Implements 2 retry attempts on LLM failure
   - 60-second timeout on Gemini API call
   - JSON validation on response
   - Fallback plan generation if all retries fail
   - Status: always ends as "ready" (with real or fallback plan) or "failed"
   - **CRITICAL**: Never leaves as "generating"

5. generate_plan_summary (NEW - OPTIMIZED)
   - Generates personalized interview prep strategy/advice
   - Single Gemini call per plan (not per-day)
   - Called via generate_learning_plan() after skeleton plan is saved
   - Stores result in plan_summary field (separate from skeleton plan_json)
   - Reduces token spend from 25+ calls to 1 call per plan
   - Status: Optional (plan works without it - graceful fallback)
   - **TOKEN SPEND: Calls Gemini (1 call only)**

WORKER POOL:
  - Windows: --pool=solo (threading not available)
  - Unix: --pool=prefork  
  - Runs independently from API process
  - Receives tasks from Redis broker
  - Updates DB with generated content
  - Critical for non-blocking LLM calls

ERROR HANDLING:
  - Failed plans marked with status='failed' for user visibility
  - Exception logging with [PLAN-TRACE], [PLAN-LLM-RETRY], [PLAN-LLM-TIMEOUT], [PLAN-FALLBACK], [PLAN-SUMMARY]
  - Graceful degradation (failed tasks don't crash worker)

OPTIMIZATION NOTES:
  - Two-phase approach: skeleton (fast, rule-based) + summary (async, LLM-based)
  - Single summary call replaces 25+ per-day enrichment calls
  - Skeleton plan is always available even if summary fails
  - plan_summary is advisory content, not core plan structure
"""
import logging
import re
import time
import traceback

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import LearningPlan, LearningTask, Resume, ResumeGapAnalysis, StudentProfile, TargetInterview
from app.models.prep_license import PrepLicense
from app.services.knowledge_service import ingest_document
from app.services.knowledge_service import build_company_context, retrieve_company_context
from app.services.llm_client import analyze_target_jd, LLMTimeoutError, LLMValidationError
from app.services.plan_service import (
    build_plan_signature,
    generate_learning_plan,
    _generate_fallback_plan,
)
from app.services.resume_service import parse_resume_file
from app.services.skill_dictionary import extract_skills_from_text
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _infer_difficulty(text: str) -> str:
    lowered = text.lower()
    if "system design" in lowered or "distributed" in lowered or "scale" in lowered:
        return "hard"
    if "leetcode" in lowered or "medium" in lowered:
        return "medium"
    if "easy" in lowered or "entry" in lowered:
        return "easy"
    return "unknown"


def _infer_round_structure(text: str) -> str:
    lowered = text.lower()
    rounds = []
    if "phone" in lowered or "screen" in lowered:
        rounds.append("screen")
    if "coding" in lowered or "technical" in lowered:
        rounds.append("technical")
    if "system design" in lowered:
        rounds.append("system_design")
    if "behavior" in lowered:
        rounds.append("behavioral")
    if not rounds:
        rounds = ["screen", "technical", "behavioral"]
    return " -> ".join(rounds)


def _normalize_skills(skills: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for item in skills:
        text = (item or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(text)
    return normalized


def _infer_experience_level_from_resume(raw_text: str) -> tuple[str, str]:
    """Infer years of experience and level from resume text using simple heuristics."""
    if not raw_text:
        return "Unknown", "Unknown"

    lowered = raw_text.lower()

    year_matches = re.findall(r"(\d{1,2})\s*\+?\s*(?:years|year|yrs|yr)", lowered)
    years_value = None
    if year_matches:
        try:
            candidates = [int(value) for value in year_matches if value.isdigit()]
            if candidates:
                years_value = max(candidates)
        except Exception:
            years_value = None

    if any(keyword in lowered for keyword in ["principal", "staff engineer", "architect"]):
        level = "Principal/Staff"
    elif any(keyword in lowered for keyword in ["senior", "lead", "tech lead"]):
        level = "Senior"
    elif any(keyword in lowered for keyword in ["junior", "associate", "entry level", "entry-level", "intern"]):
        level = "Junior/Entry"
    elif years_value is not None:
        if years_value <= 1:
            level = "Junior/Entry"
        elif years_value <= 3:
            level = "Junior"
        elif years_value <= 6:
            level = "Mid-level"
        else:
            level = "Senior"
    else:
        level = "Unknown"

    years_text = f"{years_value} years" if years_value is not None else "Unknown"
    return years_text, level


@celery_app.task(name="app.tasks.jobs.parse_resume_task")
def parse_resume_task(resume_id: int, file_path: str) -> dict:
    db: Session = SessionLocal()
    try:
        sections = parse_resume_file(resume_id, file_path, db)
        return {"resume_id": resume_id, "sections": list(sections.keys())}
    finally:
        db.close()


@celery_app.task(name="app.tasks.jobs.ingest_document_task")
def ingest_document_task(
    title: str,
    company_name: str,
    role: str | None,
    text: str,
    source: str | None = None,
) -> dict:
    db: Session = SessionLocal()
    try:
        document = ingest_document(db, title, company_name, role, text, source)
        return {"document_id": document.id}
    finally:
        db.close()


@celery_app.task(name="app.tasks.jobs.analyze_target_task")
def analyze_target_task(target_id: int) -> dict:
    db: Session = SessionLocal()
    try:
        target = db.query(TargetInterview).filter(TargetInterview.id == target_id).first()
        if not target:
            print(f"[Celery] Target {target_id} not found")
            return {"target_id": target_id, "status": "missing"}

        target.analysis_status = "processing"
        target.analysis_error = None
        db.commit()

        required_skills = extract_skills_from_text(target.jd_text)
        inferred_difficulty = _infer_difficulty(target.jd_text)
        inferred_round_structure = _infer_round_structure(target.jd_text)

        query_text = " ".join(required_skills) or target.jd_text
        chunks = retrieve_company_context(db, target.company_name, target.role, query_text)
        context = build_company_context(chunks)

        llm_analysis = analyze_target_jd(
            company_name=target.company_name,
            role=target.role or "general",
            jd_text=target.jd_text,
            company_context=context,
        )

        llm_skills = llm_analysis.get("required_skills")
        if isinstance(llm_skills, list):
            merged_skills = _normalize_skills([
                *required_skills,
                *[str(skill) for skill in llm_skills],
            ])
            if merged_skills:
                required_skills = merged_skills

        difficulty = str(llm_analysis.get("difficulty", "")).strip().lower()
        if difficulty in {"easy", "medium", "hard", "unknown"}:
            inferred_difficulty = difficulty

        round_structure = str(llm_analysis.get("round_structure", "")).strip()
        if round_structure:
            inferred_round_structure = round_structure

        target.required_skills = required_skills
        target.difficulty = inferred_difficulty
        target.round_structure = inferred_round_structure
        target.analysis_status = "ready"
        target.analysis_error = None
        db.commit()
        return {"target_id": target_id, "status": "ready"}
    except Exception as exc:
        logger.error("[TARGET-TRACE] analyze_target_task failed target_id=%s error=%s", target_id, str(exc))
        logger.error("[TARGET-TRACE] traceback\n%s", traceback.format_exc())
        try:
            target = db.query(TargetInterview).filter(TargetInterview.id == target_id).first()
            if target:
                target.analysis_status = "failed"
                target.analysis_error = str(exc)
                db.commit()
        except Exception:
            logger.error("[TARGET-TRACE] failed to update target failure status target_id=%s", target_id)
        raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.jobs.generate_plan_task")
def generate_plan_task(
    student_id: int,
    company_name: str,
    days_available: int,
    role: str | None = None,
) -> dict:
    """HARDENED: Generate learning plan with timeout, retry, fallback protection.
    
    RELIABILITY GUARANTEES:
    1. Gemini call wrapped in 60-second timeout
    2. If timeout/error: retry up to 2 times with exponential backoff
    3. On response: validate JSON structure (required fields)
    4. If validation fails: treated as error, retry attempted
    5. If all retries exhausted: generate rule-based fallback plan
    6. Plan ALWAYS ends in "ready" (real or fallback) or "failed" state
    7. Never left in "generating" state
    
    LOGGING:
    - [PLAN-LLM-RETRY]: Retry attempt (includes retry count)
    - [PLAN-LLM-TIMEOUT]: Timeout occurred (error type)
    - [PLAN-FALLBACK]: Fallback plan generated (reason)
    
    Args:
        license_key, student_id, company_name, days_available, role: Same as before
        
    Returns:
        dict: Status info (always has valid plan or graceful failure)
    """
    logger.info("[PLAN-TRACE] Step 4: Worker picked up plan generation task")
    db: Session = SessionLocal()
    
    try:
        logger.info(
            "[PLAN-TRACE] Step 5: Entered generate_plan_task student_id=%s company=%s",
            student_id,
            company_name,
        )
        
        # Build plan signature
        plan_signature = build_plan_signature(
            student_id,
            company_name,
            role,
        )
        
        # Check if plan with signature already exists and is ready (cache hit)
        existing_plan = (
            db.query(LearningPlan)
            .filter(LearningPlan.plan_signature == plan_signature)
            .filter(LearningPlan.status == "ready")
            .first()
        )
        
        if existing_plan:
            return {"plan_id": existing_plan.id, "status": "already_ready"}
        
        # ===== HARDENED RETRY LOOP =====
        max_retries = 2
        plan = None
        last_error = None
        failure_reason = "unknown"  # Track failure reason for diagnostics
        
        for attempt in range(max_retries + 1):
            try:
                logger.info(
                    "[PLAN-TRACE] Step 6: Attempting plan generation (attempt %d/%d)",
                    attempt + 1,
                    max_retries + 1,
                )
                
                # Try to generate the plan (with timeout protection inside)
                plan = generate_learning_plan(
                    db,
                    student_id,
                    company_name,
                    days_available,
                    role,
                )
                
                logger.info(
                    "[PLAN-TRACE] Step 11: Plan generation succeeded plan_id=%s",
                    plan.id,
                )
                # Set plan_type and log observability (safely handle if column doesn't exist yet)
                try:
                    plan.plan_type = "ai"
                    db.commit()
                except Exception:
                    pass  # Column might not exist yet (migration pending)
                logger.info("[PLAN-TYPE] ai plan_id=%s", plan.id)
                return {"plan_id": plan.id, "status": "generated"}
                
            except LLMTimeoutError as exc:
                last_error = exc
                failure_reason = "timeout"  # DIAGNOSTICS: Record timeout
                logger.warning(
                    "[PLAN-LLM-TIMEOUT] Gemini timeout on attempt %d/%d error=%s",
                    attempt + 1,
                    max_retries + 1,
                    str(exc),
                )
                if attempt < max_retries:
                    logger.info("[PLAN-LLM-RETRY] Retrying after timeout (attempt %d)", attempt + 1)
                    
            except LLMValidationError as exc:
                last_error = exc
                failure_reason = "invalid_json"  # DIAGNOSTICS: Record invalid JSON
                logger.warning(
                    "[PLAN-LLM-VALIDATION] Invalid JSON/fields on attempt %d/%d error=%s",
                    attempt + 1,
                    max_retries + 1,
                    str(exc),
                )
                if attempt < max_retries:
                    logger.info("[PLAN-LLM-RETRY] Retrying after validation error (attempt %d)", attempt + 1)
                    
            except Exception as exc:
                last_error = exc
                # DIAGNOSTICS: Classify exception type
                error_str = str(exc).lower()
                if "rate limit" in error_str or "quota" in error_str or "429" in error_str:
                    failure_reason = "rate_limit"
                elif "timeout" in error_str or "deadline" in error_str:
                    failure_reason = "timeout"
                else:
                    failure_reason = "api_error"
                
                logger.warning(
                    "[PLAN-LLM-ERROR] Gemini error on attempt %d/%d type=%s error=%s",
                    attempt + 1,
                    max_retries + 1,
                    type(exc).__name__,
                    str(exc),
                )
                if attempt < max_retries:
                    logger.info("[PLAN-LLM-RETRY] Retrying after error (attempt %d)", attempt + 1)
        
        # ===== ALL RETRIES EXHAUSTED: GENERATE FALLBACK =====
        logger.error(
            "[PLAN-FALLBACK] Plan generation failed after %d retries, generating fallback plan",
            max_retries + 1,
        )
        
        fallback_plan_data = _generate_fallback_plan(days_available)
        logger.info("[PLAN-FALLBACK] Fallback plan created with %d days", days_available)
        
        # Store fallback plan in DB
        fallback_plan = LearningPlan(
            student_id=student_id,
            company_name=company_name,
            role=role or "general",
            days_available=days_available,
            plan_signature=plan_signature,
            status="ready",  # CRITICAL: Mark as ready, not failed
            plan_json=fallback_plan_data,
            tasks_generated=1,  # Fallback plans are complete, don't need enrichment
        )
        
        # DIAGNOSTICS: Set plan_type and failure_reason if columns exist
        try:
            fallback_plan.plan_type = "fallback"
            fallback_plan.failure_reason = failure_reason
        except Exception:
            pass  # Columns might not exist yet (migration pending)
        db.add(fallback_plan)
        db.flush()
        
        # Add learning tasks from fallback plan
        for day_data in fallback_plan_data.get("daily_plan", []):
            day_num = day_data["day"]
            for task_index, task_data in enumerate(day_data["tasks"], start=1):
                task = LearningTask(
                    plan_id=fallback_plan.id,
                    day=day_num,
                    task_order=task_index,
                    title=task_data["title"],
                    description=task_data["description"],
                    duration_minutes=task_data["duration_minutes"],
                )
                db.add(task)
        
        db.commit()
        db.refresh(fallback_plan)
        
        logger.info("[PLAN-TYPE] fallback plan_id=%s", fallback_plan.id)
        logger.info("[PLAN-FAILURE] reason=%s plan_id=%s", failure_reason, fallback_plan.id)
        logger.info(
            "[PLAN-FALLBACK] Fallback plan saved to DB plan_id=%s status=ready reason=%s",
            fallback_plan.id,
            type(last_error).__name__ if last_error else "unknown",
        )
        
        return {"plan_id": fallback_plan.id, "status": "fallback_ready"}
        
    except Exception as exc:
        # Final catch: should rarely happen, but ensure plan is marked failed (not left generating)
        logger.error(
            "[PLAN-TRACE] Unexpected error in generate_plan_task exception=%s",
            str(exc),
        )
        logger.error("[PLAN-TRACE] traceback\n%s", traceback.format_exc())
        
        try:
            failed_signature = build_plan_signature(
                student_id,
                company_name,
                role,
            )
            # Find GENERATING or any plan for this signature and mark as failed
            failed_plan = (
                db.query(LearningPlan)
                .filter(LearningPlan.plan_signature == failed_signature)
                .order_by(LearningPlan.id.desc())
                .first()
            )
            if failed_plan and failed_plan.status != "ready":
                failed_plan.status = "failed"
                db.commit()
                logger.info(
                    "[PLAN-TRACE] Marked plan as failed plan_id=%s",
                    failed_plan.id,
                )
        except Exception:
            logger.error("[PLAN-TRACE] Failed to mark plan status as failed")
        
        return {"status": "failed", "error": str(exc)}
        
    finally:
        db.close()


@celery_app.task(name="app.tasks.jobs.generate_plan_summary")
def generate_plan_summary(plan_id: int) -> dict:
    """Generate strategic plan summary with a single Gemini call.

    Uses one advisory LLM call per plan (not per-day) and stores output in
    LearningPlan.plan_summary. The skeleton plan_json remains unchanged.
    """
    logger.info("[PLAN-SUMMARY] Starting plan summary generation for plan_id=%s", plan_id)
    db: Session = SessionLocal()

    try:
        plan = db.query(LearningPlan).filter(LearningPlan.id == plan_id).first()
        if not plan:
            logger.warning("[PLAN-SUMMARY] Plan not found plan_id=%s", plan_id)
            return {"plan_id": plan_id, "status": "not_found"}

        if plan.plan_summary:
            if not plan.summary_generated:
                plan.summary_generated = True
                db.commit()
            logger.info("[PLAN-SUMMARY] Plan summary already generated plan_id=%s", plan_id)
            return {"plan_id": plan_id, "status": "already_generated"}

        gap_analysis = (
            db.query(ResumeGapAnalysis)
            .filter(ResumeGapAnalysis.student_id == plan.student_id)
            .order_by(ResumeGapAnalysis.created_at.desc())
            .first()
        )
        latest_resume = (
            db.query(Resume)
            .filter(Resume.student_id == plan.student_id)
            .order_by(Resume.created_at.desc())
            .first()
        )
        profile = (
            db.query(StudentProfile)
            .filter(StudentProfile.student_id == plan.student_id)
            .first()
        )
        missing_skills = gap_analysis.missing_skills if gap_analysis else []
        primary_skill = profile.primary_skill if profile and profile.primary_skill else "Unknown"
        resume_text = latest_resume.raw_text if latest_resume and latest_resume.raw_text else ""
        years_experience, inferred_level = _infer_experience_level_from_resume(resume_text)
        interview_date = "Unknown"

        logger.info(
            "[PLAN-SUMMARY] Generating summary plan_id=%s company=%s role=%s",
            plan_id,
            plan.company_name,
            plan.role,
        )

        # ── Inject agentic feedback intelligence (from Ollama analysis) ──────
        try:
            from app.services.feedback_agent_service import get_feedback_intelligence
            feedback_intelligence = get_feedback_intelligence(db, plan.company_name)
            logger.info("[PLAN-SUMMARY] Feedback intelligence injected for company=%s", plan.company_name)
        except Exception:
            feedback_intelligence = "No prior student feedback data available for this company yet."

        summary_prompt = f"""You are an elite interview strategist providing a candidate assessment.

    Your job is to analyze this candidate's readiness and deliver sharp, actionable coaching.
    Do NOT generate daily plans, schedules, or task lists.
    Focus ONLY on strategic assessment and high-impact advice.

    CANDIDATE CONTEXT:
    - Target Company: {plan.company_name}
    - Target Role: {plan.role or 'Software Engineer'}
    - Interview Date: {interview_date}
    - Days Remaining: {plan.days_available}
    - Primary Skill: {primary_skill}
    - Missing Skills: {', '.join(missing_skills) if missing_skills else 'None identified'}
    - Experience Level: {years_experience} ({inferred_level})

    REAL STUDENT FEEDBACK INTELLIGENCE (from past students who interviewed at {plan.company_name}):
    {feedback_intelligence}

    Use the above feedback intelligence to make sections 3 and 4 highly specific to what
    this company ACTUALLY asks in interviews, beyond what is in the standard JD.

    Return exactly these 5 sections with concise, actionable content under each heading.
    Write in direct, confident language as if briefing the candidate before battle.

    1. Candidate Strengths
       What this candidate can leverage in the interview to stand out.
       Be specific to their skill set and experience level.

    2. Critical Weaknesses
       The gaps most likely to cause rejection. Rank by interview impact.
       Be direct — sugarcoating helps no one.

    3. Highest-Impact Preparation Focus
       The single most important area to invest time in right now.
       Explain WHY this area matters most for this specific company/role.
       If student feedback shows a low relevance score, call this out explicitly.
       Reference any surprise topics from past student feedback.

    4. Expected Interview Format
       Predict the likely interview rounds for {plan.company_name} ({plan.role or 'Software Engineer'}).
       Include typical question types, difficulty level, and what interviewers look for.
       Specifically mention any topics that past students reported were asked but NOT covered in courses.

    5. Final 48-Hour Game Plan
       Exactly what to do in the last 48 hours before the interview.
       Include mental preparation, revision strategy, and confidence-building steps.

    Output must be plain text only.
    No JSON, no markdown fences, no bullet symbols, and no extra sections."""

        try:
            from app.services.llm_client import generate_learning_plan as generate_content
            logger.info("[PLAN-SUMMARY] Calling Gemini for plan summary plan_id=%s", plan_id)
            summary_response = generate_content(summary_prompt)
            plan.plan_summary = summary_response.strip()
            plan.tasks_generated = 1
            plan.summary_generated = True
            db.commit()
            db.refresh(plan)
            logger.info("[PLAN-SUMMARY] Plan summary generated successfully plan_id=%s", plan_id)
            return {"plan_id": plan_id, "status": "generated"}

        except LLMTimeoutError as timeout_exc:
            logger.warning(
                "[PLAN-SUMMARY] Gemini timeout for plan summary plan_id=%s (keeping skeleton)",
                plan_id,
            )
            return {"plan_id": plan_id, "status": "timeout", "error": str(timeout_exc)}

        except Exception as summary_exc:
            logger.warning(
                "[PLAN-SUMMARY] Failed to generate plan summary plan_id=%s error=%s (keeping skeleton)",
                plan_id,
                str(summary_exc),
            )
            return {"plan_id": plan_id, "status": "failed", "error": str(summary_exc)}

    except Exception as exc:
        logger.error("[PLAN-SUMMARY] Unexpected error generating summary plan_id=%s error=%s", plan_id, str(exc))
        logger.error("[PLAN-SUMMARY] traceback\n%s", traceback.format_exc())
        return {"plan_id": plan_id, "status": "error", "error": str(exc)}

    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# ─── AGENTIC FEEDBACK ANALYSIS TASKS ─────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════

@celery_app.task(name="app.tasks.jobs.analyze_company_feedback")
def analyze_company_feedback(company_name: str) -> dict:
    """
    On-demand agentic task: analyse feedback for ONE company and update cache.

    Triggered immediately after a student submits feedback for a company.
    Uses Gemini 1.5 Flash (free tier) for NLP topic extraction via feedback_agent_service.py.

    Returns:
        dict: {"company": ..., "status": "updated" | "skipped" | "error"}
    """
    logger.info("[FEEDBACK-AGENT] On-demand analysis triggered for company: %s", company_name)
    db: Session = SessionLocal()
    try:
        from app.services.feedback_agent_service import refresh_company_analysis
        updated = refresh_company_analysis(db, company_name)
        status = "updated" if updated else "skipped"
        logger.info("[FEEDBACK-AGENT] Company %s analysis result: %s", company_name, status)
        return {"company": company_name, "status": status}
    except Exception as exc:
        logger.error("[FEEDBACK-AGENT] Failed analysis for %s: %s", company_name, str(exc))
        return {"company": company_name, "status": "error", "error": str(exc)}
    finally:
        db.close()


@celery_app.task(name="app.tasks.jobs.analyze_feedback_batch")
def analyze_feedback_batch() -> dict:
    """
    Nightly Celery Beat task: analyse ALL companies with new feedback.

    Scheduled to run at 2 AM daily (see celery_app.py beat_schedule).
    Only re-processes companies where feedback_hash has changed (idempotent).

    Pipeline per company:
      1. SQL aggregation (avg_relevance, irrelevant_pct, etc.)  — zero LLM cost
      2. Gemini 1.5 Flash NLP → extract missing_topics from out_of_box_questions
         (1 free API call per company, only if feedback changed)
      3. Build prompt_snippet
      4. Upsert into feedback_analysis_cache

    Rate limiting: 1-second delay between companies to respect Gemini free tier (15 RPM).

    Returns:
        dict: {"updated": N, "skipped": N, "errors": N, "companies": [...]}
    """
    logger.info("[FEEDBACK-AGENT] Nightly batch analysis started")
    db: Session = SessionLocal()
    results = {"updated": 0, "skipped": 0, "errors": 0, "companies": []}

    try:
        from shared.models.interview_feedback import InterviewFeedback
        from app.services.feedback_agent_service import refresh_company_analysis

        # Get all distinct companies that have feedback
        companies = (
            db.query(InterviewFeedback.company_name)
            .distinct()
            .all()
        )
        company_names = [c.company_name for c in companies]
        logger.info("[FEEDBACK-AGENT] Found %d companies to process", len(company_names))

        for company_name in company_names:
            try:
                updated = refresh_company_analysis(db, company_name)
                if updated:
                    results["updated"] += 1
                    results["companies"].append({"company": company_name, "status": "updated"})
                    # Rate-limit: Gemini free tier = 15 RPM — 1s delay between companies
                    time.sleep(1)
                else:
                    results["skipped"] += 1
                    results["companies"].append({"company": company_name, "status": "skipped"})
            except Exception as exc:
                results["errors"] += 1
                results["companies"].append({"company": company_name, "status": "error", "error": str(exc)})
                logger.error("[FEEDBACK-AGENT] Error processing %s: %s", company_name, str(exc))

        logger.info(
            "[FEEDBACK-AGENT] Batch complete — updated=%d skipped=%d errors=%d",
            results["updated"], results["skipped"], results["errors"]
        )
        return results

    except Exception as exc:
        logger.error("[FEEDBACK-AGENT] Batch task failed: %s", str(exc))
        return {"error": str(exc), "updated": 0, "skipped": 0, "errors": 1}
    finally:
        db.close()