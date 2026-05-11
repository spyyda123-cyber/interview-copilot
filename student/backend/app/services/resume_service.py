"""Resume parsing and storage service.

Handles PDF resume extraction and section classification:
- Extracts raw text from PDF files (local path OR S3 URL)
- Normalizes formatting (line endings, whitespace)
- Classifies content into sections (experience, education, skills, etc)
- Stores both raw and structured data in database

S3 SUPPORT:
- If file_path is an S3 URL (starts with "https://"), the service
  downloads the file to a temporary local file, parses it, then
  cleans up the temp file automatically.
- If file_path is a local path, it reads directly (local dev mode).

Used by:
- POST /resume/upload endpoint (via import)
- parse_resume_task Celery job for async processing
- Plan generation pipeline (retrieves resume context)

Integration points:
- Reading: pdfplumber for PDF extraction
- Storage: AWS S3 via shared.storage.get_s3_service()
- Database: Resume, ResumeSection models stored in PostgreSQL
"""
import logging
import os
import re
from pathlib import Path
from typing import Dict

from sqlalchemy.orm import Session

from app.models import Resume, ResumeSection
from app.utils.text import extract_sections

logger = logging.getLogger(__name__)


def parse_resume_file(resume_id: int, file_path: str, db: Session) -> Dict[str, str]:
    """Parse PDF resume and store sections in database.

    Supports both local file paths and S3 URLs.

    If file_path is an S3 URL (starts with "https://"), the file is
    downloaded to a temp location, parsed, and the temp file is
    cleaned up. This enables Celery workers running on any machine
    to process resumes stored in S3.

    Args:
        resume_id: Resume object ID to process.
        file_path: Absolute local path OR canonical S3 URL to the PDF.
        db: Database session.

    Returns:
        Dict[str, str]: Sections classified (e.g., {"experience": "...", "education": "..."}).

    Raises:
        ValueError: Resume not found in database.
        RuntimeError: S3 download failed.
    """
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise ValueError("Resume not found")

    tmp_path: str | None = None

    try:
        # ── Resolve the actual file path to read from ───────────────────────────
        if file_path.startswith("https://"):
            # S3 URL — download to temp file for pdfplumber
            from shared.storage import get_s3_service
            s3 = get_s3_service()
            if s3 is None:
                raise RuntimeError(
                    f"S3 URL stored but S3 is not configured: {file_path}. "
                    "Set USE_S3_STORAGE=True and provide AWS credentials."
                )
            key = s3.extract_key_from_url(file_path)
            if not key:
                raise RuntimeError(f"Cannot extract S3 key from URL: {file_path}")

            logger.info("[RESUME-PARSE] Downloading from S3 key=%s resume_id=%s", key, resume_id)
            tmp_path = s3.download_to_temp_file(key, suffix=".pdf")
            read_path = tmp_path
            logger.info("[RESUME-PARSE] Downloaded to temp file path=%s", tmp_path)
        else:
            # Local path — use directly
            read_path = file_path

        # ── Extract text from PDF using Gemini OCR ─────────────────────────────
        import google.generativeai as genai
        from app.core.config import settings
        from app.services.llm_client import _get_generation_model_name
        
        # Ensure REST transport for robustness on all environments
        genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")
        
        logger.info("[RESUME-OCR] Uploading file to Gemini... path=%s", read_path)
        gemini_file = genai.upload_file(path=read_path, display_name=f"resume_{resume_id}")
        
        import time
        max_wait = 60
        waited = 0
        while gemini_file.state.name == "PROCESSING" and waited < max_wait:
            time.sleep(2)
            waited += 2
            gemini_file = genai.get_file(gemini_file.name)
            
        if gemini_file.state.name == "FAILED":
            logger.error("[RESUME-OCR] Gemini file processing failed")
            raise ValueError("Gemini failed to process the resume document")

        if gemini_file.state.name == "PROCESSING":
            logger.error("[RESUME-OCR] Gemini file processing timed out")
            raise ValueError("Gemini file processing timed out")

        text = ""
        
        try:
            resolved_model = _get_generation_model_name()
            logger.info("[RESUME-OCR] Using model: %s", resolved_model)
            model = genai.GenerativeModel(resolved_model)
            prompt = "Extract all text from this resume accurately. Maintain the logical flow and sections (Experience, Education, Skills, etc.). Return only the raw text."
            response = model.generate_content([prompt, gemini_file])
            text = response.text
            
            # Optionally record usage if needed
            try:
                from app.services.usage_service import record_llm_usage
                usage = {
                    "prompt_tokens": response.usage_metadata.prompt_token_count,
                    "completion_tokens": response.usage_metadata.candidates_token_count,
                    "model": settings.GEMINI_GENERATION_MODEL
                }
                record_llm_usage(db, "gemini", usage["model"], "resume_ocr", usage["prompt_tokens"], usage["completion_tokens"], resume.student_id)
            except Exception as e:
                logger.warning("[RESUME-OCR] Failed to record usage: %s", e)
                
        finally:
            genai.delete_file(gemini_file.name)
            
    finally:
        # Always clean up temp file even if parsing fails
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
                logger.info("[RESUME-PARSE] Temp file cleaned up path=%s", tmp_path)
            except OSError as e:
                logger.warning("[RESUME-PARSE] Failed to clean up temp file path=%s error=%s", tmp_path, e)

    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text).strip()
    resume.raw_text = text

    sections = extract_sections(text)

    db.query(ResumeSection).filter(ResumeSection.resume_id == resume_id).delete()
    for section_type, content in sections.items():
        db.add(
            ResumeSection(
                resume_id=resume_id,
                section_type=section_type,
                content=content,
            )
        )

    db.commit()
    return sections


def ensure_upload_dir(upload_dir: str) -> None:
    """Create upload directory if it doesn't exist.

    Safe idempotent operation; no-op if directory already exists.
    Only needed when S3 is disabled (local storage fallback).

    Args:
        upload_dir: Directory path to create.
    """
    Path(upload_dir).mkdir(parents=True, exist_ok=True)
