from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class TokenAllocateRequest(BaseModel):
    amount: int = Field(ge=1)
    note: str | None = None
    new_expiry_date: date | None = None


class TokenOverviewResponse(BaseModel):
    college_id: UUID
    total_allocated: int
    total_consumed: int
    balance: int
    expiry_date: date | None


class StudentUsageItem(BaseModel):
    student_id: UUID
    name: str | None
    email: str | None
    allocated: int
    consumed: int
    balance: int


class TokenUsageResponse(BaseModel):
    college_id: UUID
    total_allocated: int
    total_consumed: int
    balance: int
    expiry_date: date | None
    per_action_breakdown: dict[str, int]
    student_usage: list[StudentUsageItem]
