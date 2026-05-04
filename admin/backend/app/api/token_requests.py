"""Token request endpoints for college admin to request tokens from super admin."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from shared.auth.dependencies import get_college_scope, get_current_user, require_college_admin
from shared.db.session import get_db
from shared.models.token_request import TokenRequest

router = APIRouter(tags=["Token Requests"], dependencies=[Depends(require_college_admin)])


class TokenRequestCreate(BaseModel):
    count: int
    note: str | None = None


class TokenRequestResponse(BaseModel):
    id: str
    college_id: str
    count: int
    note: str | None
    status: str
    created_at: str

    class Config:
        from_attributes = True


@router.post("/token-requests", response_model=TokenRequestResponse)
def create_token_request(
    payload: TokenRequestCreate,
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
    current_user=Depends(get_current_user),
):
    """College admin submits a token request to super admin."""
    if payload.count <= 0:
        raise HTTPException(status_code=400, detail="Count must be positive")

    req = TokenRequest(
        college_id=college_id,
        requested_by_id=current_user.id,
        count=payload.count,
        note=payload.note,
        status="PENDING",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return TokenRequestResponse(
        id=str(req.id),
        college_id=str(req.college_id),
        count=req.count,
        note=req.note,
        status=req.status,
        created_at=req.created_at.isoformat(),
    )


@router.get("/token-requests")
def list_token_requests(
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    """List token requests for this college admin."""
    offset = (page - 1) * per_page
    query = (
        db.query(TokenRequest)
        .filter(TokenRequest.college_id == college_id)
        .order_by(TokenRequest.created_at.desc())
    )
    total = query.count()
    requests = query.offset(offset).limit(per_page).all()

    items = [
        {
            "id": str(r.id),
            "college_id": str(r.college_id),
            "count": r.count,
            "note": r.note,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in requests
    ]
    return {"items": items, "total": total, "page": page, "per_page": per_page}
