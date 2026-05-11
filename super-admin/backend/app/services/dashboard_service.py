from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session, aliased

from shared.models.admin_models import College, CollegeToken, TokenTransaction, User
from shared.models.llm_usage import LLMUsageLog
from shared.models.enums import CollegeStatus, TokenTransactionType


def get_dashboard_summary(db: Session):
    total_colleges = int(db.query(func.count(College.id)).scalar() or 0)
    active_colleges = int(
        db.query(func.count(College.id)).filter(College.status == CollegeStatus.ACTIVE).scalar() or 0
    )

    token_totals = db.query(
        func.coalesce(func.sum(CollegeToken.total_allocated), 0),
        func.coalesce(func.sum(CollegeToken.total_consumed), 0),
    ).one()

    total_tokens_issued = int(token_totals[0] or 0)
    total_tokens_consumed = int(token_totals[1] or 0)

    llm_stats = db.query(
        func.coalesce(func.sum(LLMUsageLog.total_tokens), 0),
        func.coalesce(func.sum(LLMUsageLog.cost_usd), 0.0),
    ).one()

    total_llm_tokens = int(llm_stats[0] or 0)
    total_llm_cost_usd = float(llm_stats[1] or 0.0)

    actor = aliased(User)

    recent_rows = (
        db.query(TokenTransaction, College.name.label("college_name"), actor.full_name.label("actor_name"))
        .outerjoin(College, College.id == TokenTransaction.college_id)
        .outerjoin(actor, actor.id == TokenTransaction.actor_id)
        .order_by(TokenTransaction.created_at.desc())
        .limit(5)
        .all()
    )

    recent_activity = [
        {
            "id": txn.id,
            "type": txn.type,
            "college_name": college_name,
            "amount": int(txn.amount),
            "actor_name": actor_name,
            "note": txn.note,
            "created_at": txn.created_at,
        }
        for txn, college_name, actor_name in recent_rows
    ]

    return {
        "total_colleges": total_colleges,
        "active_colleges": active_colleges,
        "total_tokens_issued": total_tokens_issued,
        "total_tokens_consumed": total_tokens_consumed,
        "total_llm_tokens": total_llm_tokens,
        "total_llm_cost_usd": total_llm_cost_usd,
        "recent_activity": recent_activity,
    }
