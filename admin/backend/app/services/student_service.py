from __future__ import annotations

import secrets
import string
from datetime import date
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import EmailStr, TypeAdapter
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, aliased

from shared.auth.passwords import hash_password
from shared.models import (
    CollegeToken,
    LearningPlan,
    LearningTask,
    PrepLicense,
    Resume,
    ResumeGapAnalysis,
    Student,
    StudentActivityLog,
    StudentProfile,
    TargetInterview,
    TokenTransaction,
    TokenTransactionType,
    User,
    UserRole,
    UserStatus,
)


_email_adapter = TypeAdapter(EmailStr)


def _temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _consume_invite_slot(db: Session, college_id: UUID, actor_id: UUID, student_id: UUID) -> None:
    pool = db.query(CollegeToken).filter(CollegeToken.college_id == college_id).first()
    if not pool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="College token pool not found")
    if int(pool.balance) < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No invite slots remaining")

    pool.balance = int(pool.balance) - 1
    pool.total_consumed = int(pool.total_consumed) + 1
    db.add(pool)
    db.add(
        TokenTransaction(
            college_id=college_id,
            student_id=student_id,
            type=TokenTransactionType.CONSUMPTION,
            action="STUDENT_INVITE",
            amount=1,
            actor_id=actor_id,
            note="Invite slot consumed",
        )
    )


def list_students(
    db: Session,
    college_id: UUID,
    search: str | None,
    status_filter: UserStatus | None,
    target_company: str | None,
    target_role: str | None,
    sort_by: str,
    sort_dir: str,
    page: int,
    per_page: int,
) -> dict:
    page = max(page, 1)
    per_page = max(min(per_page, 100), 1)

    latest_target_subquery = (
        select(
            TargetInterview.student_id.label("student_id"),
            func.max(TargetInterview.created_at).label("latest_created_at"),
        )
        .group_by(TargetInterview.student_id)
        .subquery()
    )

    latest_target_alias = aliased(TargetInterview)

    base_stmt = (
        db.query(
            User,
            latest_target_alias.company_name.label("target_company"),
            latest_target_alias.role.label("target_role"),
        )
        .outerjoin(Student, Student.email == User.email)
        .outerjoin(latest_target_subquery, latest_target_subquery.c.student_id == Student.id)
        .outerjoin(
            latest_target_alias,
            and_(
                latest_target_alias.student_id == latest_target_subquery.c.student_id,
                latest_target_alias.created_at == latest_target_subquery.c.latest_created_at,
            ),
        )
        .filter(User.college_id == college_id, User.role == UserRole.STUDENT)
    )

    if search:
        pattern = f"%{search.strip()}%"
        base_stmt = base_stmt.filter(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))

    if status_filter:
        base_stmt = base_stmt.filter(User.status == status_filter)

    if target_company:
        base_stmt = base_stmt.filter(latest_target_alias.company_name.ilike(f"%{target_company.strip()}%"))

    if target_role:
        base_stmt = base_stmt.filter(latest_target_alias.role.ilike(f"%{target_role.strip()}%"))

    count_query = base_stmt.with_entities(func.count(func.distinct(User.id)))
    total = int(count_query.scalar() or 0)

    sort_map = {
        "name": User.full_name,
        "tokens_consumed": User.last_active_at,
        "last_active": User.last_active_at,
    }
    sort_column = sort_map.get(sort_by, User.created_at)
    direction = sort_column.asc() if sort_dir.lower() == "asc" else sort_column.desc()

    rows = (
        base_stmt.order_by(direction, User.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "students": [
            {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "department": user.department,
                "graduation_year": user.graduation_year,
                "status": user.status,
                "last_active_at": user.last_active_at,
                "access_expiry": user.access_expiry,
                "tokens_allocated": 0,
                "tokens_consumed": 0,
                "target_company": target_company_row,
                "target_role": target_role_row,
            }
            for user, target_company_row, target_role_row in rows
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


def get_student_detail(db: Session, college_id: UUID, user_id: UUID) -> dict:
    user = (
        db.query(User)
        .filter(User.id == user_id, User.college_id == college_id, User.role == UserRole.STUDENT)
        .first()
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    action_rows = (
        db.query(
            StudentActivityLog.action_type,
            func.coalesce(func.sum(StudentActivityLog.tokens_used), 0).label("tokens_used"),
        )
        .filter(StudentActivityLog.college_id == college_id, StudentActivityLog.student_id == user_id)
        .group_by(StudentActivityLog.action_type)
        .all()
    )

    # Intentional global bridge lookup: legacy student-flow data is mapped by unique email across the platform.
    legacy_student = db.query(Student).filter(Student.email == user.email).first()

    prep_details = {
        "target_company": None,
        "target_role": None,
        "prep_mode": None,
        "tone": None,
        "interview_date": None,
    }
    resume_summary = {"ats_score": None, "last_scan_at": None}
    study_plan = {"completed_tasks": 0, "total_tasks": 0, "completion_percentage": None}

    if legacy_student:
        latest_target = (
            db.query(TargetInterview)
            .filter(TargetInterview.student_id == legacy_student.id)
            .order_by(TargetInterview.created_at.desc())
            .first()
        )
        profile = (
            db.query(StudentProfile)
            .filter(StudentProfile.student_id == legacy_student.id)
            .first()
        )
        latest_license = (
            db.query(PrepLicense)
            .filter(PrepLicense.student_id == legacy_student.id)
            .order_by(PrepLicense.created_at.desc())
            .first()
        )

        prep_details = {
            "target_company": latest_target.company_name if latest_target else None,
            "target_role": latest_target.role if latest_target else None,
            "prep_mode": profile.support_mode if profile else None,
            "tone": profile.tone if profile else None,
            "interview_date": latest_license.interview_date if latest_license else None,
        }

        latest_resume = (
            db.query(Resume)
            .filter(Resume.student_id == legacy_student.id)
            .order_by(Resume.created_at.desc())
            .first()
        )
        latest_gap = (
            db.query(ResumeGapAnalysis)
            .filter(ResumeGapAnalysis.student_id == legacy_student.id)
            .order_by(ResumeGapAnalysis.created_at.desc())
            .first()
        )
        resume_summary = {
            "ats_score": float(latest_gap.ats_score) if latest_gap else None,
            "last_scan_at": latest_resume.created_at if latest_resume else None,
        }

        latest_plan = (
            db.query(LearningPlan)
            .filter(LearningPlan.student_id == legacy_student.id)
            .order_by(LearningPlan.created_at.desc())
            .first()
        )
        if latest_plan:
            total_tasks = (
                db.query(func.count(LearningTask.id))
                .filter(LearningTask.plan_id == latest_plan.id)
                .scalar()
                or 0
            )
            completed_tasks = (
                db.query(func.count(LearningTask.id))
                .filter(LearningTask.plan_id == latest_plan.id, LearningTask.task_order <= 0)
                .scalar()
                or 0
            )
            study_plan = {
                "completed_tasks": int(completed_tasks),
                "total_tasks": int(total_tasks),
                "completion_percentage": (float(completed_tasks) / float(total_tasks) * 100.0)
                if total_tasks > 0
                else None,
            }

    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "department": user.department,
        "graduation_year": user.graduation_year,
        "status": user.status,
        "created_at": user.created_at,
        "last_active_at": user.last_active_at,
        "access_expiry": user.access_expiry,
        "token_usage": {
            "allocated": 0,
            "consumed": 0,
            "balance": 0,
            "cap": None,
        },
        "per_action_breakdown": [
            {"action_type": action, "tokens_used": int(tokens_used)}
            for action, tokens_used in action_rows
        ],
        "prep_details": prep_details,
        "resume_summary": resume_summary,
        "study_plan": study_plan,
    }


def invite_student_by_email(db: Session, college_id: UUID, emails: list[str], actor_id: UUID) -> dict:
    imported = 0
    skipped: list[dict[str, str]] = []

    college_pool = db.query(CollegeToken).filter(CollegeToken.college_id == college_id).first()
    total_needed = len(emails)
    if not college_pool or int(college_pool.balance) < total_needed:
        available = int(college_pool.balance) if college_pool else 0
        return {
            "imported": 0,
            "skipped": [
                {
                    "email": email,
                    "reason": f"Insufficient invite slots. Need {total_needed}, have {available}.",
                }
                for email in emails
            ],
            "error": f"Not enough invite slots. Need {total_needed}, have {available}.",
        }

    for raw_email in emails:
        email = raw_email.strip().lower()
        if not email:
            continue

        try:
            _email_adapter.validate_python(email)
        except Exception:
            skipped.append({"email": raw_email, "reason": "Invalid email format"})
            continue

        # Intentional global uniqueness check: email must be unique platform-wide, not per college.
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            skipped.append({"email": email, "reason": "Email already exists"})
            continue

        temp_password = _temporary_password()
        student = User(
            college_id=college_id,
            full_name=email.split("@")[0],
            email=email,
            password_hash=hash_password(temp_password),
            role=UserRole.STUDENT,
            status=UserStatus.ACTIVE,
        )
        db.add(student)
        db.flush()
        _consume_invite_slot(db, college_id, actor_id, student.id)
        imported += 1

        # TODO: send welcome email with login/setup link to invited student.
        print(f"[INVITE-DEBUG] student={email} temporary_password={temp_password} actor={actor_id}")

    db.commit()
    return {"imported": imported, "skipped": skipped}


def bulk_invite_from_csv(db: Session, college_id: UUID, csv_rows: list[dict], actor_id: UUID) -> dict:
    valid_rows: list[dict] = []
    invalid_rows: list[dict] = []

    for index, row in enumerate(csv_rows, start=1):
        errors: list[str] = []
        full_name = (row.get("full_name") or "").strip()
        email = (row.get("email") or "").strip().lower()
        phone = (row.get("phone") or "").strip() or None
        department = (row.get("department") or "").strip() or None
        graduation_year_raw = (row.get("graduation_year") or "").strip()

        graduation_year = None
        if not full_name:
            errors.append("Missing full_name")

        if not email:
            errors.append("Missing email")
        else:
            try:
                _email_adapter.validate_python(email)
            except Exception:
                errors.append("Invalid email format")

        # Intentional global uniqueness check: email must be unique platform-wide, not per college.
        if email and db.query(User).filter(User.email == email).first():
            errors.append("Email already exists")

        if graduation_year_raw:
            if not graduation_year_raw.isdigit() or len(graduation_year_raw) != 4:
                errors.append("graduation_year must be a 4-digit year")
            else:
                graduation_year = int(graduation_year_raw)

        if errors:
            invalid_rows.append({"row": index, "email": email or None, "errors": errors})
            continue

        valid_rows.append(
            {
                "row": index,
                "full_name": full_name,
                "email": email,
                "phone": phone,
                "department": department,
                "graduation_year": graduation_year,
            }
        )

    return {
        "valid_rows": valid_rows,
        "invalid_rows": invalid_rows,
        "total_valid": len(valid_rows),
        "total_invalid": len(invalid_rows),
    }


def confirm_bulk_invite(db: Session, college_id: UUID, valid_rows: list[dict], actor_id: UUID) -> dict:
    imported = 0

    college_pool = db.query(CollegeToken).filter(CollegeToken.college_id == college_id).first()
    total_needed = len(valid_rows)
    if not college_pool or int(college_pool.balance) < total_needed:
        available = int(college_pool.balance) if college_pool else 0
        return {
            "imported": 0,
            "skipped": [],
            "error": f"Not enough invite slots. Need {total_needed}, have {available}.",
        }

    for row in valid_rows:
        email = row["email"]
        # Intentional global uniqueness check: email must be unique platform-wide, not per college.
        if db.query(User).filter(User.email == email).first():
            continue

        temp_password = _temporary_password()
        student = User(
            college_id=college_id,
            full_name=row["full_name"],
            email=email,
            phone=row.get("phone"),
            department=row.get("department"),
            graduation_year=row.get("graduation_year"),
            password_hash=hash_password(temp_password),
            role=UserRole.STUDENT,
            status=UserStatus.ACTIVE,
        )
        db.add(student)
        db.flush()
        _consume_invite_slot(db, college_id, actor_id, student.id)
        imported += 1

        # TODO: send welcome email with login/setup link to imported student.
        print(f"[BULK-INVITE-DEBUG] student={email} temporary_password={temp_password} actor={actor_id}")

    db.commit()
    return {"imported": imported}


def list_pending_students(db: Session, college_id: UUID) -> list[dict]:
    rows = (
        db.query(User)
        .filter(
            User.college_id == college_id,
            User.role == UserRole.STUDENT,
            User.status == UserStatus.PENDING,
        )
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        {
            "id": row.id,
            "full_name": row.full_name,
            "email": row.email,
            "department": row.department,
            "graduation_year": row.graduation_year,
            "status": row.status,
            "last_active_at": row.last_active_at,
            "access_expiry": row.access_expiry,
            "tokens_allocated": 0,
            "tokens_consumed": 0,
            "target_company": None,
            "target_role": None,
        }
        for row in rows
    ]


def approve_student(db: Session, college_id: UUID, user_id: UUID, actor_id: UUID) -> dict:
    student = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.college_id == college_id,
            User.role == UserRole.STUDENT,
            User.status == UserStatus.PENDING,
        )
        .first()
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending student not found")

    student.status = UserStatus.ACTIVE
    db.flush()
    _consume_invite_slot(db, college_id, actor_id, student.id)
    db.commit()

    # TODO: send approval email.
    return {"status": "approved"}


def reject_student(db: Session, college_id: UUID, user_id: UUID) -> dict:
    student = (
        db.query(User)
        .filter(User.id == user_id, User.college_id == college_id, User.role == UserRole.STUDENT)
        .first()
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    db.delete(student)
    db.commit()

    # TODO: send rejection notification email.
    return {"status": "rejected"}


def toggle_student_status(db: Session, college_id: UUID, user_id: UUID, new_status: UserStatus) -> dict:
    if new_status not in (UserStatus.ACTIVE, UserStatus.INACTIVE):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    student = (
        db.query(User)
        .filter(User.id == user_id, User.college_id == college_id, User.role == UserRole.STUDENT)
        .first()
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    student.status = new_status
    db.commit()

    # TODO: student app should enforce this status during student login.
    return {"status": new_status.value.lower()}


def set_access_expiry(db: Session, college_id: UUID, user_id: UUID, expiry_date: date | None) -> dict:
    student = (
        db.query(User)
        .filter(User.id == user_id, User.college_id == college_id, User.role == UserRole.STUDENT)
        .first()
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    student.access_expiry = expiry_date
    db.commit()

    # TODO: schedule reminder email and auto-deactivation by expiry date.
    return {"status": "updated"}
