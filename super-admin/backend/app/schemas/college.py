from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from shared.models.enums import CollegeStatus


class CollegeCreate(BaseModel):
    college_name: str = Field(min_length=3)
    admin_full_name: str = Field(min_length=2)
    admin_email: EmailStr
    admin_phone: str | None = None
    city: str | None = None

    initial_token_quota: int = Field(ge=0)
    token_expiry_date: date | None = None


class CollegeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3)
    city: str | None = None



class CollegeStatusUpdate(BaseModel):
    status: CollegeStatus


class CollegeListItem(BaseModel):
    id: UUID
    name: str
    admin_email: str | None

    tokens_allocated: int
    tokens_remaining: int
    status: CollegeStatus
    onboarded_on: date
    city: str | None

    model_config = ConfigDict(from_attributes=True)


class CollegeListResponse(BaseModel):
    colleges: list[CollegeListItem]
    total: int
    page: int
    per_page: int


class CollegeDetailResponse(BaseModel):
    id: UUID
    name: str
    city: str | None

    status: CollegeStatus
    created_at: datetime
    updated_at: datetime
    admin_name: str | None
    admin_email: str | None
    admin_phone: str | None
    tokens_allocated: int
    tokens_consumed: int
    tokens_remaining: int
    token_expiry_date: date | None


class CollegeCreateResponse(BaseModel):
    college: CollegeDetailResponse
    admin_email: str
    temporary_password: str
