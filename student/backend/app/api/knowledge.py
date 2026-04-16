from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.knowledge import KnowledgeIngestFileRequest, KnowledgeIngestResponse
from app.services.knowledge_service import ingest_document

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


def _resolve_data_path(file_path: str) -> Path:
    base_dir = Path(__file__).resolve().parent.parent.parent
    requested = Path(file_path)
    if not requested.is_absolute():
        requested = (base_dir / requested).resolve()
    if not requested.exists():
        raise FileNotFoundError(f"Resolved path does not exist: {requested}")
    return requested


@router.post("/ingest-file", response_model=KnowledgeIngestResponse)
def ingest_knowledge_file(
    payload: KnowledgeIngestFileRequest,
    db: Session = Depends(get_db),
):
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
