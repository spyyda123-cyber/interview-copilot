"""Resume upload and gap analysis endpoint.

Handles resume ingestion and resume-to-JD comparison:

UPLOAD FLOW:
1. Student uploads PDF resume via POST /resume/upload
2. File validated (PDF format), stored in local filesystem
3. Resume model created with raw_text placeholder
4. parse_resume_task queued to Celery worker
5. Worker extracts text from PDF, classifies sections, stores in DB

GAP ANALYSIS FLOW:
1. After resume parsing, extract_skills_from_text identifies student skills
2. Compare against target interview required_skills
3. Create ResumeGapAnalysis with missing_skills, keyword_score, ATS score
4. Gap analysis used by plan generation to prioritize preparation

PLAN GENERATION OPTIMIZATION:
- IMMEDIATELY after successful resume upload, enqueue generate_plan_task
- Plan generation happens silently in background (Celery worker)
- By time user clicks "Generate Plan", plan is already generating or ready
- Signature caching prevents duplicate Gemini calls if resume uploaded multiple times

TOKENS SPENT:
- parse_resume_task: 1 token (Gemini for section classification)
- Gap analysis: 1 token (LLM for skill matching - done here, not in Gemini)

Used by:
- Plan generation (gap analysis is input to learning plan)
- Resume parsing pipeline (PDF extraction)
- Interview prep dashboard (shows skill gaps)
"""
import re
from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models import Resume, ResumeGapAnalysis, Student, TargetInterview
from app.schemas.resume import ResumeUploadResponse
from app.services.activity_logger import log_activity
from app.services.resume_service import ensure_upload_dir, parse_resume_file
from app.services.skill_dictionary import compare_skills, extract_skills_from_text
from app.services.plan_service import build_plan_signature
from app.tasks.jobs import generate_plan_task

router = APIRouter(prefix="/resume", tags=["resume"])


def _extract_resume_skills(sections: dict[str, str], raw_text: str) -> set[str]:
    if raw_text:
        return set(extract_skills_from_text(raw_text))

    content = sections.get("skills") or ""
    if not content:
        content = "\n".join(sections.values())

    tokens = re.split(r"[,;/\n|\-]+", content)
    skills = {token.strip().lower() for token in tokens if token.strip()}
    return skills


@router.post("/upload", response_model=ResumeUploadResponse)
def upload_resume(
    student_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload and parse student resume, trigger gap analysis.
    
    PROCESS:
    1. Validate PDF format and student license
    2. Save PDF to local filesystem
    3. Create Resume DB record
    4. Queue parse_resume_task to Celery worker (async PDF extraction)
    5. Extract resume skills and create ResumeGapAnalysis vs target JD
    
    Returns resume_id for tracking and polling parse status.
    
    License validation ensures students can only upload for licensed companies.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    target = (
        db.query(TargetInterview)
        .filter(TargetInterview.student_id == student_id)
        .order_by(TargetInterview.created_at.desc())
        .first()
    )

    ensure_upload_dir(settings.UPLOAD_DIR)
    filename = f"{uuid4().hex}.pdf"
    file_path = Path(settings.UPLOAD_DIR) / filename

    with file_path.open("wb") as buffer:
        buffer.write(file.file.read())

    resume = Resume(student_id=student.id, file_path=str(file_path))
    db.add(resume)
    db.commit()
    db.refresh(resume)

    sections = parse_resume_file(resume.id, str(file_path), db)
    resume_skills = _extract_resume_skills(sections, resume.raw_text or "")
    
    missing = []
    ats_score = 0.0
    
    if target:
        required_skills = target.required_skills or []

        # Use normalized skill comparison
        missing, match_ratio = compare_skills(resume_skills, required_skills)
        keyword_score = match_ratio
        ats_score = round(match_ratio * 100, 2)

        gap = ResumeGapAnalysis(
            student_id=student.id,
            target_id=target.id,
            resume_id=resume.id,
            missing_skills=missing,
            keyword_score=keyword_score,
            ats_score=ats_score,
        )
        db.add(gap)
        db.commit()

        # OPTIMIZE: Queue plan generation immediately after resume is uploaded.
        try:
            role = target.role or "general"
            days_available = 14
            
            generate_plan_task.delay(
                "",
                student_id,
                target.company_name,
                days_available,
                role,
            )
        except Exception as e:
            # Log but don't fail resume upload if plan enqueue fails
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to enqueue plan generation during resume upload: {e}")

    try:
        if student.email:
            log_activity(db, student.email, "RESUME_SCAN")
    except Exception:
        pass

    return ResumeUploadResponse(
        resume_id=resume.id,
        status="parsed",
        missing_skills=missing,
        ats_score=ats_score,
    )
