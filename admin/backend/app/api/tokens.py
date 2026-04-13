from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.token import TokenPoolResponse
from app.services import token_service
from shared.auth.dependencies import get_college_scope, require_college_admin
from shared.db.session import get_db


router = APIRouter(tags=["Tokens"], dependencies=[Depends(require_college_admin)])


@router.get("/tokens", response_model=TokenPoolResponse)
def token_overview(
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    return token_service.get_college_token_pool(db, college_id)


@router.get("/tokens/pool/balance")
def pool_balance(
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    return token_service.get_pool_balance(db, college_id)
