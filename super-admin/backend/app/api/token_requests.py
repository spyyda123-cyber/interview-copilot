"""Super-admin token requests management - view and fulfill token requests from college admins."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from shared.auth.dependencies import require_super_admin, get_current_user
from shared.db.session import get_db
from shared.models.admin_models import College, User, CollegeToken, TokenTransaction
from shared.models.enums import TokenTransactionType
from shared.models.token_request import TokenRequest

router = APIRouter(tags=["Token Requests"], dependencies=[Depends(require_super_admin)])


class TokenRequestItem(BaseModel):
    id: str
    college_id: str
    college_name: str
    admin_name: str | None
    admin_email: str | None
    count: int
    note: str | None
    status: str
    created_at: str


class TokenRequestListResponse(BaseModel):
    items: list[TokenRequestItem]
    total: int
    page: int
    per_page: int


@router.get("/token-requests", response_model=TokenRequestListResponse)
def list_all_token_requests(
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List all token requests from all college admins."""
    query = db.query(TokenRequest).order_by(TokenRequest.created_at.desc())

    if status and status.upper() in ("PENDING", "FULFILLED", "REJECTED"):
        query = query.filter(TokenRequest.status == status.upper())

    total = query.count()
    requests = query.offset((page - 1) * per_page).limit(per_page).all()

    items = []
    for r in requests:
        college = db.query(College).filter(College.id == r.college_id).first()
        requester = db.query(User).filter(User.id == r.requested_by_id).first()
        items.append(
            TokenRequestItem(
                id=str(r.id),
                college_id=str(r.college_id),
                college_name=college.name if college else "Unknown",
                admin_name=requester.full_name if requester else None,
                admin_email=requester.email if requester else None,
                count=r.count,
                note=r.note,
                status=r.status,
                created_at=r.created_at.isoformat(),
            )
        )

    return TokenRequestListResponse(items=items, total=total, page=page, per_page=per_page)


@router.post("/token-requests/{request_id}/fulfill")
def fulfill_token_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Fulfill a pending token request - allocate tokens to the college."""
    req = db.query(TokenRequest).filter(TokenRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Token request not found")
    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Request is already {req.status}")

    # Allocate tokens to college pool
    tokens = db.query(CollegeToken).filter(CollegeToken.college_id == req.college_id).first()
    if not tokens:
        tokens = CollegeToken(
            college_id=req.college_id,
            total_allocated=0,
            total_consumed=0,
            balance=0,
        )
        db.add(tokens)
        db.flush()

    tokens.total_allocated = int(tokens.total_allocated) + int(req.count)
    tokens.balance = int(tokens.balance) + int(req.count)

    # Record transaction
    db.add(
        TokenTransaction(
            college_id=req.college_id,
            student_id=None,
            type=TokenTransactionType.ALLOCATION,
            action="TOKEN_REQUEST_FULFILLED",
            amount=int(req.count),
            actor_id=current_user.id,
            note=f"Fulfilled request {req.id}: {req.note or ''}",
        )
    )

    req.status = "FULFILLED"
    db.commit()
    db.refresh(req)

    return {
        "status": "fulfilled",
        "request_id": str(req.id),
        "college_id": str(req.college_id),
        "tokens_allocated": req.count,
    }


@router.post("/token-requests/{request_id}/reject")
def reject_token_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Reject a pending token request."""
    req = db.query(TokenRequest).filter(TokenRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Token request not found")
    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Request is already {req.status}")

    req.status = "REJECTED"
    db.commit()

    return {"status": "rejected", "request_id": str(req.id)}
