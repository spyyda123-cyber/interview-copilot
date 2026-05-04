from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from shared.models import CollegeToken, StudentActivityLog, User, UserRole
from shared.models.placement import PlacementApplication, PlacementCompany


def get_dashboard_summary(db: Session, college_id: UUID) -> dict:
    pool = db.query(CollegeToken).filter(CollegeToken.college_id == college_id).first()

    total_students = (
        db.query(func.count(User.id))
        .filter(User.college_id == college_id, User.role == UserRole.STUDENT)
        .scalar()
        or 0
    )

    active_cutoff = datetime.utcnow() - timedelta(days=7)
    active_students = (
        db.query(func.count(User.id))
        .filter(
            User.college_id == college_id,
            User.role == UserRole.STUDENT,
            User.last_active_at.isnot(None),
            User.last_active_at >= active_cutoff,
        )
        .scalar()
        or 0
    )

    recent_rows = (
        db.query(StudentActivityLog, User.full_name)
        .join(User, User.id == StudentActivityLog.student_id)
        .filter(StudentActivityLog.college_id == college_id)
        .order_by(StudentActivityLog.created_at.desc())
        .limit(5)
        .all()
    )

    total_allocated = int(pool.total_allocated if pool else 0)
    total_consumed = int(pool.total_consumed if pool else 0)
    balance = int(pool.balance if pool else 0)

    low_token_alert = total_allocated > 0 and balance < max(int(total_allocated * 0.1), 1)

    # ── Company & Application stats ───────────────────────────────
    total_companies = (
        db.query(func.count(PlacementCompany.id))
        .filter(PlacementCompany.college_id == college_id)
        .scalar()
        or 0
    )
    active_companies = (
        db.query(func.count(PlacementCompany.id))
        .filter(PlacementCompany.college_id == college_id, PlacementCompany.status == "Active")
        .scalar()
        or 0
    )
    pending_approvals = (
        db.query(func.count(PlacementApplication.id))
        .join(PlacementCompany, PlacementCompany.id == PlacementApplication.company_id)
        .filter(
            PlacementCompany.college_id == college_id,
            PlacementApplication.status == "INTERESTED",
        )
        .scalar()
        or 0
    )

    # Recent applications (last 5 INTERESTED applications)
    recent_application_rows = (
        db.query(PlacementApplication, PlacementCompany, User)
        .join(PlacementCompany, PlacementCompany.id == PlacementApplication.company_id)
        .join(User, User.id == PlacementApplication.student_id)
        .filter(PlacementCompany.college_id == college_id)
        .order_by(PlacementApplication.created_at.desc())
        .limit(5)
        .all()
    )

    recent_applications = [
        {
            "student_name": user.full_name,
            "student_email": user.email,
            "company_name": company.company_name,
            "role": company.role,
            "status": application.status,
            "applied_at": application.created_at.isoformat(),
        }
        for application, company, user in recent_application_rows
    ]

    # Active companies list (up to 5)
    active_company_rows = (
        db.query(PlacementCompany)
        .filter(PlacementCompany.college_id == college_id, PlacementCompany.status == "Active")
        .order_by(PlacementCompany.created_at.desc())
        .limit(5)
        .all()
    )

    # Count applications per company
    active_companies_list = []
    for comp in active_company_rows:
        total_applied = (
            db.query(func.count(PlacementApplication.id))
            .filter(PlacementApplication.company_id == comp.id)
            .scalar()
            or 0
        )
        approved = (
            db.query(func.count(PlacementApplication.id))
            .filter(
                PlacementApplication.company_id == comp.id,
                PlacementApplication.status.in_(["APPROVED", "ACTIVATED"]),
            )
            .scalar()
            or 0
        )
        active_companies_list.append({
            "id": str(comp.id),
            "company_name": comp.company_name,
            "role": comp.role,
            "package_min": str(comp.package_min) if comp.package_min is not None else None,
            "package_max": str(comp.package_max) if comp.package_max is not None else None,
            "total_applied": int(total_applied),
            "approved": int(approved),
        })

    return {
        "token_pool": {
            "total_allocated": total_allocated,
            "total_consumed": total_consumed,
            "balance": balance,
            "expiry_date": pool.expiry_date if pool else None,
        },
        "total_students": int(total_students),
        "active_students": int(active_students),
        "inactive_students": int(total_students) - int(active_students),
        "low_token_alert": low_token_alert,
        "total_companies": int(total_companies),
        "active_companies": int(active_companies),
        "pending_approvals": int(pending_approvals),
        "recent_applications": recent_applications,
        "active_companies_list": active_companies_list,
        "recent_activity": [
            {
                "student_name": student_name,
                "action_type": log.action_type,
                "tokens_used": int(log.tokens_used),
                "created_at": log.created_at,
            }
            for log, student_name in recent_rows
        ],
    }
