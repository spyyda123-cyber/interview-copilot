from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel

from shared.models.enums import UserStatus


class StudentTokenItem(BaseModel):
    student_id: UUID
    name: str | None
    email: str | None
    status: UserStatus
    allocated: int
    consumed: int
    balance: int
    cap: int | None


class TokenPoolResponse(BaseModel):
    total_allocated: int
    total_consumed: int
    balance: int
    expiry_date: date | None
    student_allocations: list[StudentTokenItem]
