from __future__ import annotations

import logging
import secrets
import string
from datetime import date
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from shared.auth.passwords import hash_password
from shared.models.admin_models import (
    College,
    CollegeToken,
    StudentActivityLog,
    TokenTransaction,
    User,
)
from shared.models.enums import CollegeStatus, TokenTransactionType, UserRole, UserStatus


logger = logging.getLogger("super_admin.college_service")


def _random_temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def list_colleges(
    db: Session,
    search: str | None,
    status_filter: CollegeStatus | None,

    page: int,
    per_page: int,
):
    page = max(page, 1)
    per_page = max(min(per_page, 100), 1)

    admin_email_subquery = (
        select(User.email)
        .where(User.college_id == College.id, User.role == UserRole.COLLEGE_ADMIN)
        .order_by(User.created_at.asc())
        .limit(1)
        .scalar_subquery()
    )

    base_stmt: Select = (
        select(
            College.id,
            College.name,
            College.city,

            College.status,
            College.created_at,
            func.coalesce(CollegeToken.total_allocated, 0).label("tokens_allocated"),
            func.coalesce(CollegeToken.balance, 0).label("tokens_remaining"),
            admin_email_subquery.label("admin_email"),
        )
        .outerjoin(CollegeToken, CollegeToken.college_id == College.id)
    )

    count_stmt = select(func.count()).select_from(College)

    filters = []
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(or_(College.name.ilike(pattern), admin_email_subquery.ilike(pattern)))
    if status_filter:
        filters.append(College.status == status_filter)

    if filters:
        base_stmt = base_stmt.where(*filters)
        count_stmt = count_stmt.where(*filters)

    total = int(db.execute(count_stmt).scalar() or 0)

    rows = db.execute(
        base_stmt.order_by(College.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()

    colleges = [
        {
            "id": row.id,
            "name": row.name,
            "admin_email": row.admin_email,

            "tokens_allocated": int(row.tokens_allocated or 0),
            "tokens_remaining": int(row.tokens_remaining or 0),
            "status": row.status,
            "onboarded_on": row.created_at.date(),
            "city": row.city,
        }
        for row in rows
    ]

    return {
        "colleges": colleges,
        "total": total,
        "page": page,
        "per_page": per_page,
    }


def get_college_detail(db: Session, college_id: UUID):
    college = db.query(College).filter(College.id == college_id).first()
    if not college:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="College not found")

    college_tokens = db.query(CollegeToken).filter(CollegeToken.college_id == college.id).first()
    admin_user = (
        db.query(User)
        .filter(User.college_id == college.id, User.role == UserRole.COLLEGE_ADMIN)
        .order_by(User.created_at.asc())
        .first()
    )

    return {
        "id": college.id,
        "name": college.name,
        "city": college.city,

        "status": college.status,
        "created_at": college.created_at,
        "updated_at": college.updated_at,
        "admin_name": admin_user.full_name if admin_user else None,
        "admin_email": admin_user.email if admin_user else None,
        "admin_phone": getattr(admin_user, "phone", None) if admin_user else None,
        "tokens_allocated": int(college_tokens.total_allocated if college_tokens else 0),
        "tokens_consumed": int(college_tokens.total_consumed if college_tokens else 0),
        "tokens_remaining": int(college_tokens.balance if college_tokens else 0),
        "token_expiry_date": college_tokens.expiry_date if college_tokens else None,
    }


def create_college(db: Session, data, actor_id: UUID):
    existing_admin_email = db.query(User).filter(User.email == data.admin_email).first()
    if existing_admin_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin email already exists")

    temporary_password = _random_temporary_password()

    try:
        college = College(
            name=data.college_name,
            city=data.city,

            status=CollegeStatus.ACTIVE,
        )
        db.add(college)
        db.flush()

        admin_user = User(
            college_id=college.id,
            full_name=data.admin_full_name,
            email=data.admin_email,
            password_hash=hash_password(temporary_password),
            role=UserRole.COLLEGE_ADMIN,
            status=UserStatus.PENDING,
        )
        if hasattr(admin_user, "phone"):
            admin_user.phone = data.admin_phone
        db.add(admin_user)

        college_tokens = CollegeToken(
            college_id=college.id,
            total_allocated=data.initial_token_quota,
            total_consumed=0,
            balance=data.initial_token_quota,
            expiry_date=data.token_expiry_date,
        )
        db.add(college_tokens)

        token_txn = TokenTransaction(
            college_id=college.id,
            student_id=None,
            type=TokenTransactionType.ALLOCATION,
            action=None,
            amount=data.initial_token_quota,
            actor_id=actor_id,
            note="Initial allocation on onboarding",
        )
        db.add(token_txn)
        db.commit()

        db.refresh(college)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to create college") from exc

    logger.warning(
        "TODO: send onboarding email to %s with first-login setup link. Temporary password (dev only): %s",
        data.admin_email,
        temporary_password,
    )

    detail = get_college_detail(db, college.id)
    return {
        "college": detail,
        "admin_email": data.admin_email,
        "temporary_password": temporary_password,
    }


def update_college(db: Session, college_id: UUID, data):
    college = db.query(College).filter(College.id == college_id).first()
    if not college:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="College not found")

    update_data = data.model_dump(exclude_unset=True)
    if "name" in update_data:
        college.name = update_data["name"]
    if "city" in update_data:
        college.city = update_data["city"]


    db.add(college)
    db.commit()
    db.refresh(college)

    return get_college_detail(db, college_id)


def toggle_college_status(db: Session, college_id: UUID, new_status: CollegeStatus):
    college = db.query(College).filter(College.id == college_id).first()
    if not college:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="College not found")

    college.status = new_status
    db.add(college)

    if new_status == CollegeStatus.INACTIVE:
        users = db.query(User).filter(User.college_id == college_id).all()
        for user in users:
            user.status = UserStatus.INACTIVE
            db.add(user)
    else:
        admins = db.query(User).filter(User.college_id == college_id, User.role == UserRole.COLLEGE_ADMIN).all()
        for admin in admins:
            admin.status = UserStatus.ACTIVE
            db.add(admin)

    db.commit()
    db.refresh(college)

    return get_college_detail(db, college_id)


def delete_college(db: Session, college_id: UUID):
    college = db.query(College).filter(College.id == college_id).first()
    if not college:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="College not found")

    has_super_admin = (
        db.query(User)
        .filter(User.college_id == college_id, User.role == UserRole.SUPER_ADMIN)
        .first()
        is not None
    )
    if has_super_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a college that owns super admin accounts",
        )

    db.query(StudentActivityLog).filter(StudentActivityLog.college_id == college_id).delete()
    db.query(TokenTransaction).filter(TokenTransaction.college_id == college_id).delete()
    db.query(CollegeToken).filter(CollegeToken.college_id == college_id).delete()
    db.query(User).filter(User.college_id == college_id).delete()
    db.delete(college)
    db.commit()

    return {"status": "ok", "message": "College deleted"}
