from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from shared.models import CollegeToken, TokenTransaction, User, UserRole


def _get_college_pool(db: Session, college_id: UUID) -> CollegeToken:
    pool = db.query(CollegeToken).filter(CollegeToken.college_id == college_id).first()
    if not pool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="College token pool not found")
    return pool


def get_college_token_pool(db: Session, college_id: UUID) -> dict:
    pool = _get_college_pool(db, college_id)

    student_rows = (
        db.query(
            User.id.label("student_id"),
            User.full_name.label("name"),
            User.email.label("email"),
            User.status.label("status"),
            User.created_at.label("invited_date"),
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
        .group_by(User.id, User.full_name, User.email, User.status, User.created_at)
        .order_by(User.created_at.desc())
        .all()
    )

    return {
        "total_allocated": int(pool.total_allocated),
        "total_consumed": int(pool.total_consumed),
        "balance": int(pool.balance),
        "expiry_date": pool.expiry_date,
        "student_allocations": [
            {
                "student_id": row.student_id,
                "name": row.name,
                "email": row.email,
                "status": row.status.value,
                "invited_date": row.invited_date,
                "allocated": int(row.invites_consumed),
                "consumed": int(row.invites_consumed),
                "balance": 0,
                "cap": None,
            }
            for row in student_rows
        ],
    }


def get_pool_balance(db: Session, college_id: UUID) -> dict:
    pool = _get_college_pool(db, college_id)
    return {
        "total_allocated": int(pool.total_allocated),
        "total_consumed": int(pool.total_consumed),
        "balance": int(pool.balance),
    }
