from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from shared.models import CollegeToken, StudentActivityLog, User, UserRole


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
