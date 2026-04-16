from datetime import datetime

from sqlalchemy.orm import Session

from shared.models.admin_models import StudentActivityLog, User
from shared.models.enums import UserRole


def log_activity(db: Session, student_email: str, action_type: str) -> None:
    """
    Log student action for admin dashboard visibility.
    No token cost; this is activity tracking only.
    Fire-and-forget by design: callers should never fail the main action if logging fails.
    """
    try:
        user = (
            db.query(User)
            .filter(User.email == student_email, User.role == UserRole.STUDENT)
            .first()
        )
        if not user:
            return

        db.add(
            StudentActivityLog(
                student_id=user.id,
                college_id=user.college_id,
                action_type=action_type,
                tokens_used=0,
            )
        )
        user.last_active_at = datetime.utcnow()
        db.commit()
    except Exception:
        db.rollback()
