from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.company import CompanyAnalyzeRequest, CompanyAnalyzeResponse
from app.services.knowledge_service import build_company_context, retrieve_company_context

router = APIRouter(prefix="/company", tags=["company"])


@router.post("/analyze", response_model=CompanyAnalyzeResponse)
def analyze_company(payload: CompanyAnalyzeRequest, db: Session = Depends(get_db)):
    query_text = f"{payload.company_name} {payload.role or ''} interview questions"
    try:
        chunks = retrieve_company_context(db, payload.company_name, payload.role, query_text)
        context = build_company_context(chunks)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CompanyAnalyzeResponse(
        company_name=payload.company_name,
        role=payload.role,
        context=context,
    )
