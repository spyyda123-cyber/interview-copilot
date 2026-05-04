"""Target interview analysis endpoint.

Handles job description analysis for interview preparation:

FLOW:
1. Student uploads job description via POST /target/analyze
2. TargetInterview created with status='processing'
3. analyze_target_task queued to Celery worker
4. Worker calls llm_client to analyze JD (extracts required skills, difficulty, format)
5. Frontend polls GET /target/status until analysis_status='done'

ANALYSIS INCLUDES:
- Required skills extraction (parsed from JD keywords)
- Difficulty assessment (entry/mid/senior level inference)
- Round structure (phone screen, coding, system design, behavioral, etc.)
- Proper formatting for plan generation context

Used by:
- Plan generation (gets target details for context building)
- Resume gap analysis (compares resume against required skills)
- Interview prep dashboard (displays interview format expectations)
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Student, TargetInterview
from app.schemas.target import TargetAnalyzeRequest, TargetAnalyzeResponse, TargetStatusResponse
from app.services.activity_logger import log_activity
from app.tasks.jobs import analyze_target_task

router = APIRouter(prefix="/target", tags=["target"])
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=TargetAnalyzeResponse)
def analyze_target(payload: TargetAnalyzeRequest, db: Session = Depends(get_db)):
    """Upload and analyze job description for interview preparation.
    
    PROCESS:
    1. Validate student and license for company
    2. Create TargetInterview with status='processing'
    3. Enqueue analyze_target_task to Celery worker
    4. Worker calls Gemini to extract skills, difficulty, round structure
    5. Frontend polls /target/status until analysis_status='done'
    
    Response includes task/target ID for polling status.
    
    License validation ensures student can only analyze for licensed companies.
    """
    logger.info("[TARGET-TRACE] Entered /target/analyze student_id=%s company=%s", payload.student_id, payload.company_name)
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    target = TargetInterview(
        student_id=payload.student_id,
        company_name=payload.company_name,
        role=payload.role,
        required_skills=[],
        difficulty="unknown",
        round_structure="",
        analysis_status="processing",
        analysis_error=None,
        jd_text=payload.jd_text,
    )
    db.add(target)
    db.commit()
    db.refresh(target)

    async_result = analyze_target_task.delay(target.id)
    logger.info("[TARGET-TRACE] Enqueued analyze_target_task target_id=%s task_id=%s", target.id, async_result.id)

    try:
        if student.email:
            log_activity(db, student.email, "JD_ANALYSIS")
    except Exception:
        pass

    return TargetAnalyzeResponse(target_id=target.id, status="processing")


@router.get("/status", response_model=TargetStatusResponse)
def get_target_status(target_id: int, db: Session = Depends(get_db)):
    """Poll job description analysis status.
    
    Returns current analysis_status and results once available.
    
    Status values:
    - 'processing': Gemini still analyzing JD
    - 'done': Analysis complete, required_skills/difficulty/round_structure populated
    - 'error': Analysis failed, check error field
    
    Called by frontend polling loop after POST /target/analyze.
    """
    target = db.query(TargetInterview).filter(TargetInterview.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    status = target.analysis_status
    return TargetStatusResponse(
        target_id=target.id,
        status=status,
        error=target.analysis_error,
        required_skills=target.required_skills or [],
        difficulty=target.difficulty,
        round_structure=target.round_structure,
    )


@router.get("/list")
def list_targets(student_id: int, db: Session = Depends(get_db)):
    """List all target interviews for a student.

    Used by the plan page to auto-resolve the active target_id after
    activation, without requiring the user to re-upload a job description.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    targets = (
        db.query(TargetInterview)
        .filter(TargetInterview.student_id == student_id)
        .order_by(TargetInterview.created_at.desc())
        .all()
    )

    return {
        "targets": [
            {
                "id": t.id,
                "company_name": t.company_name,
                "role": t.role,
                "analysis_status": t.analysis_status,
            }
            for t in targets
        ]
    }
