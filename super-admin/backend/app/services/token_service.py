from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from shared.models.admin_models import College, CollegeToken, TokenTransaction, User
from shared.models.enums import TokenTransactionType, UserRole


def _get_or_create_college_tokens(db: Session, college_id: UUID) -> CollegeToken:
    college = db.query(College).filter(College.id == college_id).first()
    if not college:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="College not found")

    tokens = db.query(CollegeToken).filter(CollegeToken.college_id == college_id).first()
    if not tokens:
        tokens = CollegeToken(college_id=college_id, total_allocated=0, total_consumed=0, balance=0)
        db.add(tokens)
        db.commit()
        db.refresh(tokens)
    return tokens


def get_college_token_overview(db: Session, college_id: UUID):
    tokens = _get_or_create_college_tokens(db, college_id)
    return {
        "college_id": college_id,
        "total_allocated": int(tokens.total_allocated),
        "total_consumed": int(tokens.total_consumed),
        "balance": int(tokens.balance),
        "expiry_date": tokens.expiry_date,
    }


def allocate_tokens(
    db: Session,
    college_id: UUID,
    amount: int,
    note: str | None,
    new_expiry_date,
    actor_id: UUID,
):
    tokens = _get_or_create_college_tokens(db, college_id)

    tokens.total_allocated = int(tokens.total_allocated) + int(amount)
    tokens.balance = int(tokens.balance) + int(amount)
    if new_expiry_date:
        tokens.expiry_date = new_expiry_date

    db.add(tokens)
    db.add(
        TokenTransaction(
            college_id=college_id,
            student_id=None,
            type=TokenTransactionType.ALLOCATION,
            action=None,
            amount=int(amount),
            actor_id=actor_id,
            note=note,
        )
    )
    db.commit()

    return get_college_token_overview(db, college_id)


def get_college_token_usage(db: Session, college_id: UUID):
    tokens = _get_or_create_college_tokens(db, college_id)

    action_rows = (
        db.query(
            TokenTransaction.action,
            func.coalesce(func.sum(func.abs(TokenTransaction.amount)), 0).label("total"),
        )
        .filter(
            TokenTransaction.college_id == college_id,
            TokenTransaction.type == TokenTransactionType.CONSUMPTION,
            TokenTransaction.action.isnot(None),
        )
        .group_by(TokenTransaction.action)
        .all()
    )

    per_action_breakdown = {
        str(row.action): int(row.total or 0)
        for row in action_rows
        if row.action
    }

    student_rows = (
        db.query(
            User.id.label("student_id"),
            User.full_name.label("name"),
            User.email.label("email"),
            func.coalesce(func.count(TokenTransaction.id), 0).label("invites_consumed"),
        )
        .filter(User.college_id == college_id, User.role == UserRole.STUDENT)
        .outerjoin(
            TokenTransaction,
            and_(
                TokenTransaction.college_id == college_id,
                TokenTransaction.student_id == User.id,
                TokenTransaction.action == "STUDENT_INVITE",
            ),
        )
        .group_by(User.id, User.full_name, User.email)
        .order_by(User.created_at.desc())
        .all()
    )

    student_usage = [
        {
            "student_id": row.student_id,
            "name": row.name,
            "email": row.email,
            "allocated": int(row.invites_consumed),
            "consumed": int(row.invites_consumed),
            "balance": 0,
        }
        for row in student_rows
    ]

    return {
        "college_id": college_id,
        "total_allocated": int(tokens.total_allocated),
        "total_consumed": int(tokens.total_consumed),
        "balance": int(tokens.balance),
        "expiry_date": tokens.expiry_date,
        "per_action_breakdown": per_action_breakdown,
        "student_usage": student_usage,
    }
