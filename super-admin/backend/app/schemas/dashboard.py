from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from shared.models.enums import TokenTransactionType


class DashboardActivityItem(BaseModel):
    id: UUID
    type: TokenTransactionType
    college_name: str | None
    amount: int
    actor_name: str | None
    note: str | None
    created_at: datetime


class DashboardSummaryResponse(BaseModel):
    total_colleges: int
    active_colleges: int
    total_tokens_issued: int
    total_tokens_consumed: int
    recent_activity: list[DashboardActivityItem]
