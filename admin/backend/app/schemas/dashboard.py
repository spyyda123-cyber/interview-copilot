from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class TokenPoolSummary(BaseModel):
    total_allocated: int
    total_consumed: int
    balance: int
    expiry_date: date | None


class DashboardActivityItem(BaseModel):
    student_name: str | None
    action_type: str
    tokens_used: int
    created_at: datetime


class DashboardSummaryResponse(BaseModel):
    token_pool: TokenPoolSummary
    total_students: int
    active_students: int
    inactive_students: int
    low_token_alert: bool
    recent_activity: list[DashboardActivityItem]
