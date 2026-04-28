"""Knowledge base ingestion endpoints.

Handles company interview material ingestion for RAG retrieval.

ENDPOINTS:
- POST /knowledge/ingest-file   (existing) — ingest from a local file path
- POST /knowledge/upload        (NEW)       — upload file directly, store in S3, ingest
- POST /knowledge/ingest-text   (NEW)       — ingest raw text body directly

UPLOAD FLOW (POST /knowledge/upload):
1. Admin uploads PDF or TXT file
2. File uploaded to S3 under knowledge/<uuid>.<ext>
3. File content extracted (PDF via pdfplumber, TXT via UTF-8 decode)
4. Ingested into knowledge base (chunked, embedded, stored in PostgreSQL)
5. Returns document_id and S3 URL

LOCAL FILE FLOW (POST /knowledge/ingest-file):
1. Admin provides a local file path on the server
2. File resolved relative to backend root if not absolute
3. Ingested directly from disk (no S3 involved)
"""
import logging
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.knowledge import KnowledgeIngestFileRequest, KnowledgeIngestResponse
from app.services.knowledge_service import ingest_document
from shared.storage import get_s3_service

router = APIRouter(prefix="/knowledge", tags=["knowledge"])
logger = logging.getLogger(__name__)


def _resolve_data_path(file_path: str) -> Path:
    base_dir = Path(__file__).resolve().parent.parent.parent
    requested = Path(file_path)
    if not requested.is_absolute():
        requested = (base_dir / requested).resolve()
    if not requested.exists():
        raise FileNotFoundError(f"Resolved path does not exist: {requested}")
    return requested


def _extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    """Extract text from uploaded file bytes.

    Supports PDF (via pdfplumber) and plain text files (UTF-8).

    Args:
        file_bytes: Raw file content.
        filename: Original filename (used to determine format).

    Returns:
        str: Extracted text content.

    Raises:
        ValueError: Unsupported file type or extraction error.
    """
    fname_lower = filename.lower()

    if fname_lower.endswith(".pdf"):
        try:
            import io
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                pages = [page.extract_text() or "" for page in pdf.pages]
            return "\n".join(pages).strip()
        except Exception as exc:
            raise ValueError(f"Failed to extract text from PDF: {exc}") from exc

    elif fname_lower.endswith((".txt", ".md", ".rst")):
        try:
            return file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError as exc:
            raise ValueError(f"File is not valid UTF-8 text: {exc}") from exc

    else:
        raise ValueError(
            f"Unsupported file type: '{filename}'. "
            "Supported formats: PDF (.pdf), plain text (.txt, .md, .rst)"
        )


# ──────────────────────────────────────────────────────────────────────────────
#  POST /knowledge/upload  (NEW — S3-backed file upload)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=KnowledgeIngestResponse)
async def upload_knowledge_file(
    title: str = Form(..., description="Document title, e.g. 'Google Backend Interview Guide'"),
    company_name: str = Form(..., description="Company name for filtering during retrieval"),
    role: str | None = Form(None, description="Optional role, e.g. 'backend engineer'"),
    file: UploadFile = File(..., description="PDF or TXT file to ingest"),
    db: Session = Depends(get_db),
):
    """Upload a company knowledge base file, store in S3, and ingest into RAG pipeline.

    PROCESS:
    1. Read uploaded file bytes
    2. Upload to S3 under knowledge/<uuid>.<ext> (or log a warning if S3 disabled)
    3. Extract text from file (PDF or TXT)
    4. Chunk + embed + store in PostgreSQL for vector similarity search

    Returns document_id, status, and the S3 URL of the stored file.

    Used by admins to add company-specific interview materials for student RAG.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    allowed_extensions = (".pdf", ".txt", ".md", ".rst")
    if not any(file.filename.lower().endswith(ext) for ext in allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # ── Extract text from file ─────────────────────────────────────────────────
    try:
        text = _extract_text_from_bytes(file_bytes, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Could not extract any text from the uploaded file.",
        )

    # ── Upload to S3 ───────────────────────────────────────────────────────────
    s3_url: str | None = None
    ext = Path(file.filename).suffix.lower()
    s3_key = f"knowledge/{uuid4().hex}{ext}"

    s3 = get_s3_service()
    if s3:
        content_type = "application/pdf" if ext == ".pdf" else "text/plain"
        try:
            s3_url = s3.upload_file(
                file_bytes=file_bytes,
                key=s3_key,
                content_type=content_type,
            )
            logger.info(
                "[KNOWLEDGE-UPLOAD] Uploaded to S3 key=%s title='%s' company='%s'",
                s3_key, title, company_name,
            )
        except Exception as exc:
            logger.error("[KNOWLEDGE-UPLOAD] S3 upload failed: %s (continuing with ingestion)", exc)
            # Don't fail ingestion if S3 upload fails — text is already extracted
    else:
        logger.info(
            "[KNOWLEDGE-UPLOAD] S3 not enabled — file will not be stored persistently "
            "(USE_S3_STORAGE=False)"
        )

    # ── Ingest into knowledge base ─────────────────────────────────────────────
    try:
        document = ingest_document(
            db=db,
            title=title,
            company_name=company_name,
            role=role,
            text=text,
            source=s3_url or f"upload:{file.filename}",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("[KNOWLEDGE-UPLOAD] Ingestion failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return KnowledgeIngestResponse(document_id=document.id, status="ingested")


# ──────────────────────────────────────────────────────────────────────────────
#  POST /knowledge/ingest-file  (existing — local path)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/ingest-file", response_model=KnowledgeIngestResponse)
def ingest_knowledge_file(
    payload: KnowledgeIngestFileRequest,
    db: Session = Depends(get_db),
):
    """Ingest a knowledge document from a local server file path.

    Kept for backward compatibility and server-side automation scripts.
    For new integrations, prefer POST /knowledge/upload which supports
    direct file upload and S3 storage.
    """
    try:
        file_path = _resolve_data_path(payload.file_path)
        text = file_path.read_text(encoding="utf-8")
    except (ValueError, FileNotFoundError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    try:
        document = ingest_document(
            db=db,
            title=payload.title,
            company_name=payload.company_name,
            role=payload.role,
            text=text,
            source=payload.source or str(file_path),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return KnowledgeIngestResponse(document_id=document.id, status="ingested")
