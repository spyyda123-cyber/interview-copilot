from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.token import TokenAllocateRequest, TokenOverviewResponse, TokenUsageResponse
from app.services import token_service
from shared.auth.dependencies import require_super_admin
from shared.db.session import get_db
from shared.models.admin_models import User


router = APIRouter(tags=["Tokens"], dependencies=[Depends(require_super_admin)])


@router.get("/colleges/{college_id}/tokens", response_model=TokenOverviewResponse)
def get_college_tokens(college_id: UUID, db: Session = Depends(get_db)):
    return token_service.get_college_token_overview(db, college_id)


@router.post("/colleges/{college_id}/tokens/allocate", response_model=TokenOverviewResponse)
def allocate_college_tokens(
    college_id: UUID,
    payload: TokenAllocateRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    return token_service.allocate_tokens(
        db,
        college_id=college_id,
        amount=payload.amount,
        note=payload.note,
        new_expiry_date=payload.new_expiry_date,
        actor_id=current_user.id,
    )


@router.get("/colleges/{college_id}/token-usage", response_model=TokenUsageResponse)
def get_college_token_usage(college_id: UUID, db: Session = Depends(get_db)):
    return token_service.get_college_token_usage(db, college_id)
