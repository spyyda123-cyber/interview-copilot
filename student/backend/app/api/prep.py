"""Preparation endpoint for learning plan generation and retrieval.

FRONTEND FLOW:
1. Student navigates to /prep page
2. Page calls GET /prep/status?license_key=...&target_id=...
3. If status='ready': display plan; else show spinner
4. Spinner polls GET /prep/status every 2-3 seconds
5. Once status='ready': fetch plan via GET /prep/latest/...

POLLING ARCHITECTURE:
- No WebSocket; frontend uses simple HTTP polling
- Plan generation happens in background Celery worker
- API immediately returns 'generating' status without blocking
- Worker updates plan.status='ready' when Gemini API completes

CACHING VIA SIGNATURE:
- Plan signature: deterministic hash of (student_id, company, role, interview_date)
- Same signature = same plan cached; avoids duplicate Gemini calls
- Frontend polls same endpoint repeatedly; gets instant cached response once ready

LICENSE VALIDATION:
- Every prep endpoint validates license_key, student_id, company_name match
- License must be active status
- Interview date must not be expired (auto-expires if expired)
- plan_generated flag checked to control one-time Gemini spending
"""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import LearningPlan, Student, StudentProfile, TargetInterview
from app.schemas.plan import PlanDetailResponse
from app.schemas.prep import CodeReportRequest, CodeReportResponse, PrepGenerateRequest, PrepGenerateResponse
from app.services.activity_logger import log_activity
from app.services.openai_client import analyze_code_result
from app.services.plan_service import build_plan_signature
from app.tasks.jobs import generate_plan_task

router = APIRouter(prefix="/prep", tags=["prep"])
# Stale plans (status='generating' for > 10 min) auto-marked as failed to prevent infinite polling
STALE_GENERATING_MINUTES = 10
TERMINAL_FAILURE_STATUSES = {"failed", "failure", "error", "unknown"}


def _mark_stale_generating_as_failed(db: Session, plan: LearningPlan) -> LearningPlan:
    """Auto-fail plans stuck in 'generating' status for too long.
    
    Prevents infinite polling if worker crashed.
    Frontend can retry after seeing 'failed' status.
    """
    if plan.status == "generating":
        stale_cutoff = datetime.utcnow() - timedelta(minutes=STALE_GENERATING_MINUTES)
        if plan.created_at < stale_cutoff:
            plan.status = "failed"
            db.commit()
            db.refresh(plan)
    return plan


def _enqueue_plan_generation(
    payload: PrepGenerateRequest,
    target: TargetInterview,
    days_available: int,
    role: str,
) -> str:
    """Queue a plan generation task in Celery.
    
    Returns task ID for frontend polling. Worker will call llm_client.generate_learning_plan.
    """
    async_result = generate_plan_task.delay(
        payload.student_id,
        target.company_name,
        days_available,
        role,
    )
    return str(async_result.id)


def _resolve_plan_for_active_target(
    db: Session,
    student_id: int,
) -> tuple[LearningPlan | None, TargetInterview | None]:
    target = (
        db.query(TargetInterview)
        .filter(TargetInterview.student_id == student_id)
        .order_by(TargetInterview.created_at.desc())
        .first()
    )
    if not target:
        return None, None

    role = target.role or "general"
    plan_signature = build_plan_signature(
        student_id,
        target.company_name,
        role,
    )

    plan = (
        db.query(LearningPlan)
        .filter(LearningPlan.plan_signature == plan_signature)
        .order_by(LearningPlan.created_at.desc())
        .first()
    )
    return plan, target


def _resolve_plan_for_target_id(
    db: Session,
    student_id: int,
    target_id: int,
) -> tuple[LearningPlan | None, TargetInterview | None]:
    target = (
        db.query(TargetInterview)
        .filter(TargetInterview.id == target_id)
        .filter(TargetInterview.student_id == student_id)
        .first()
    )
    if not target:
        return None, None

    role = target.role or "general"
    plan_signature = build_plan_signature(
        student_id,
        target.company_name,
        role,
    )

    plan = (
        db.query(LearningPlan)
        .filter(LearningPlan.plan_signature == plan_signature)
        .order_by(LearningPlan.created_at.desc())
        .first()
    )
    return plan, target


@router.post("/generate", response_model=PrepGenerateResponse)
def generate_prep(payload: PrepGenerateRequest, db: Session = Depends(get_db)):
    """Query current learning plan generation status.
    
    OPTIMIZATION: Plan generation now starts during resume upload (fire-and-forget).
    This endpoint is now status-only and returns current plan state.
    
    Returns JSON:
    { "task_id": "<plan_id_or_task_id>", "status": "generating|ready|failed|missing" }
    
    Behavior:
    - If plan exists: return current status (generating/ready/failed/other)
    - If plan missing: create stub with status='generating' and enqueue (fallback for edge cases)
    - Frontend polls this same endpoint repeatedly until status='ready'
    - If status='failed': plan generation crashed, try /generate again to re-queue
    
    License must be active and interview_date not expired.
    """
    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.student_id == payload.student_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")

    target = (
        db.query(TargetInterview)
        .filter(TargetInterview.student_id == payload.student_id)
        .order_by(TargetInterview.created_at.desc())
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Target interview not found")

    # Calculate days_available based on default 14 days
    days_available = 14
    
    # Extract role from target
    role = target.role or "general"

    plan_signature = build_plan_signature(
        payload.student_id,
        target.company_name,
        role,
    )

    # Find the latest plan for this student
    plan = (
        db.query(LearningPlan)
        .filter(LearningPlan.plan_signature == plan_signature)
        .order_by(LearningPlan.created_at.desc())
        .first()
    )

    # Plan should exist from resume upload, but handle edge case where it doesn't
    if not plan:
        generating_plan = LearningPlan(
            student_id=payload.student_id,
            company_name=target.company_name,
            role=role,
            days_available=days_available,
            plan_signature=plan_signature,
            status="generating",
            plan_json={},
        )
        db.add(generating_plan)
        db.commit()
        # Fallback: enqueue generation if plan wasn't created during resume upload
        task_id = _enqueue_plan_generation(payload, target, days_available, role)
        student = db.query(Student).filter(Student.id == payload.student_id).first()
        if student and student.email:
            try:
                log_activity(db, student.email, "STUDY_PLAN_GENERATION")
            except Exception:
                pass
        return PrepGenerateResponse(task_id=task_id, status="generating")

    # Plan exists: normalize stale state and allow retry for terminal failures
    plan = _mark_stale_generating_as_failed(db, plan)

    if plan.status in TERMINAL_FAILURE_STATUSES:
        plan.status = "generating"
        db.commit()
        task_id = _enqueue_plan_generation(payload, target, days_available, role)
        student = db.query(Student).filter(Student.id == payload.student_id).first()
        if student and student.email:
            try:
                log_activity(db, student.email, "STUDY_PLAN_GENERATION")
            except Exception:
                pass
        return PrepGenerateResponse(task_id=task_id, status="generating")

    return PrepGenerateResponse(task_id=str(plan.id), status=plan.status)


@router.get("/latest/{student_id}", response_model=PlanDetailResponse)
def get_latest_prep_plan(
    student_id: int,
    target_id: int = Query(...),
    db: Session = Depends(get_db),
):
    plan, target = _resolve_plan_for_target_id(db, student_id, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target interview not found")
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    return PlanDetailResponse(
        plan_id=plan.id,
        student_id=plan.student_id,
        company_name=plan.company_name,
        role=plan.role,
        days_available=plan.days_available,
        plan_json=plan.plan_json,
        summary_generated=bool(plan.summary_generated),
    )


@router.get("/status/{student_id}", response_model=PrepGenerateResponse)
def get_prep_status(
    student_id: int,
    target_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Get the status of learning plan generation for a student.
    Returns: generating | ready | missing
    Frontend can poll this endpoint instead of Celery task ID.
    """
    plan, target = _resolve_plan_for_target_id(db, student_id, target_id)
    if not target:
        return PrepGenerateResponse(task_id="", status="missing")

    if not plan:
        return PrepGenerateResponse(task_id="", status="generating")

    plan = _mark_stale_generating_as_failed(db, plan)
    
    return PrepGenerateResponse(task_id=str(plan.id), status=plan.status)


@router.post("/code-report", response_model=CodeReportResponse)
def get_code_report(
    payload: CodeReportRequest,
    db: Session = Depends(get_db)
):
    """
    Generate an AI report analysing failed code testcases against course concepts.
    """
    try:
        result = analyze_code_result(
            question=payload.question,
            code=payload.code,
            language=payload.language,
            test_results=payload.test_results,
            concepts_in_course=payload.concepts_in_course
        )
        return CodeReportResponse(
            analysis=result.get("analysis", "Error analyzing code."),
            lagging_skills=result.get("lagging_skills", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
