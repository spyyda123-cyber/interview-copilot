"""Resume upload and gap analysis endpoint.

Handles resume ingestion and resume-to-JD comparison:

UPLOAD FLOW:
1. Student uploads PDF resume via POST /resume/upload
2. File validated (PDF format), stored in AWS S3 (or local filesystem if S3 disabled)
3. Resume model created with S3 URL (or local path) in file_path field
4. parse_resume_task queued to Celery worker
5. Worker downloads file from S3, extracts text, classifies sections, stores in DB

DOWNLOAD FLOW:
1. GET /resume/{resume_id}/download
2. If file_path is an S3 URL → generate pre-signed URL (valid 1 hour)
3. If file_path is a local path → raise 404 (local files not served)

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
"""
import logging
import re
from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import RedirectResponse
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
from shared.storage import get_s3_service

router = APIRouter(prefix="/resume", tags=["resume"])
logger = logging.getLogger(__name__)


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
    2. Read file bytes
    3a. If S3 enabled: upload to S3 under resumes/<uuid>.pdf, store S3 URL
    3b. If S3 disabled: save to local filesystem
    4. Create Resume DB record with file_path (S3 URL or local path)
    5. Queue parse_resume_task to Celery worker (async PDF extraction)
    6. Extract resume skills and create ResumeGapAnalysis vs target JD

    Returns resume_id for tracking and polling parse status.
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

    # ── Read file bytes once (consumed from request body) ─────────────────────
    file_bytes = file.file.read()
    unique_id = uuid4().hex

    # ── Storage: S3 (preferred) or local fallback ──────────────────────────────
    s3 = get_s3_service()

    if s3:
        # Upload to S3 under resumes/ prefix
        s3_key = f"resumes/{unique_id}.pdf"
        try:
            file_path_str = s3.upload_file(
                file_bytes=file_bytes,
                key=s3_key,
                content_type="application/pdf",
            )
            logger.info("[RESUME-UPLOAD] Uploaded to S3 key=%s student_id=%s", s3_key, student_id)
        except Exception as exc:
            logger.error("[RESUME-UPLOAD] S3 upload failed: %s", exc)
            raise HTTPException(status_code=500, detail=f"File upload failed: {exc}")
    else:
        # Fallback: save to local filesystem
        ensure_upload_dir(settings.UPLOAD_DIR)
        local_path = Path(settings.UPLOAD_DIR) / f"{unique_id}.pdf"
        with local_path.open("wb") as buffer:
            buffer.write(file_bytes)
        file_path_str = str(local_path)
        logger.info("[RESUME-UPLOAD] Saved locally path=%s student_id=%s", file_path_str, student_id)

    # ── Persist Resume record ──────────────────────────────────────────────────
    resume = Resume(student_id=student.id, file_path=file_path_str)
    db.add(resume)
    db.commit()
    db.refresh(resume)

    sections = parse_resume_file(resume.id, file_path_str, db)
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
            logger.warning("Failed to enqueue plan generation during resume upload: %s", e)

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


@router.get("/{resume_id}/download")
def get_resume_download_url(
    resume_id: int,
    db: Session = Depends(get_db),
):
    """Generate a pre-signed S3 URL for secure resume download.

    Returns a 302 redirect to the pre-signed URL, valid for 1 hour.
    The URL is time-limited — students must re-request if it expires.

    If S3 is disabled (local storage mode), returns 404 (local files are not served).
    """
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    s3 = get_s3_service()

    if s3 and s3.is_s3_url(resume.file_path):
        key = s3.extract_key_from_url(resume.file_path)
        if not key:
            raise HTTPException(status_code=500, detail="Cannot parse S3 key from stored URL")
        presigned_url = s3.generate_presigned_url(key, expires_in=3600)
        logger.info(
            "[RESUME-DOWNLOAD] Pre-signed URL generated resume_id=%s key=%s",
            resume_id, key,
        )
        return RedirectResponse(url=presigned_url, status_code=302)

    # Local path stored — not served directly
    raise HTTPException(
        status_code=404,
        detail="Resume file is not available for download (local storage mode or S3 URL invalid).",
    )


@router.get("/{resume_id}/presigned-url")
def get_resume_presigned_url(
    resume_id: int,
    expires_in: int = 3600,
    db: Session = Depends(get_db),
):
    """Return a pre-signed S3 URL as a JSON response (no redirect).

    Useful when the frontend needs the URL for embedding in an <iframe>
    or opening in a new tab without triggering a redirect loop.

    Args:
        resume_id: Database ID of the resume.
        expires_in: URL lifetime in seconds (default 3600 = 1 hour, max 86400 = 24h).
    """
    if expires_in > 86400:
        expires_in = 86400  # cap at 24 hours for security

    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    s3 = get_s3_service()

    if s3 and s3.is_s3_url(resume.file_path):
        key = s3.extract_key_from_url(resume.file_path)
        if not key:
            raise HTTPException(status_code=500, detail="Cannot parse S3 key from stored URL")
        presigned_url = s3.generate_presigned_url(key, expires_in=expires_in)
        return {
            "resume_id": resume_id,
            "url": presigned_url,
            "expires_in_seconds": expires_in,
            "storage": "s3",
        }

    raise HTTPException(
        status_code=404,
        detail="Resume is not stored in S3. Pre-signed URL unavailable.",
    )
