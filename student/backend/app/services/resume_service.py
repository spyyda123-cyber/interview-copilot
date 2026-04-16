"""Resume parsing and storage service.

Handles PDF resume extraction and section classification:
- Extracts raw text from PDF files
- Normalizes formatting (line endings, whitespace)
- Classifies content into sections (experience, education, skills, etc)
- Stores both raw and structured data in database

Used by:
- POST /resume/upload endpoint (via import)
- parse_resume_task Celery job for async processing
- Plan generation pipeline (retrieves resume context)

Integration points:
- Reading: pdfplumber for PDF extraction
- Database: Resume, ResumeSection models stored in PostgreSQL
"""
import re
from pathlib import Path
from typing import Dict

import pdfplumber
from sqlalchemy.orm import Session

from app.models import Resume, ResumeSection
from app.utils.text import extract_sections


def parse_resume_file(resume_id: int, file_path: str, db: Session) -> Dict[str, str]:
    """Parse PDF resume and store sections in database.
    
    Extracts text from PDF, normalizes formatting, classifies into sections,
    and persists both raw and structured data.
    
    Called by parse_resume_task Celery job (async processing).
    Results used by plan generation to understand student background.
    
    Args:
        resume_id: Resume object ID to process
        file_path: Absolute path to PDF file
        db: Database session
        
    Returns:
        Dict[str, str]: Sections classified (e.g., {"experience": "...", "education": "..."})
        
    Raises:
        ValueError: Resume not found in database
    """
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise ValueError("Resume not found")

    with pdfplumber.open(file_path) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]

    text = "\n".join(pages)
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
    
    Args:
        upload_dir: Directory path to create
    """
    Path(upload_dir).mkdir(parents=True, exist_ok=True)
