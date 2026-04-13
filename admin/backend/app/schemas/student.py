from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from shared.models.enums import UserStatus


class StudentListItem(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    department: str | None
    graduation_year: int | None
    status: UserStatus
    last_active_at: datetime | None
    access_expiry: date | None
    tokens_allocated: int
    tokens_consumed: int
    target_company: str | None
    target_role: str | None


class StudentListResponse(BaseModel):
    students: list[StudentListItem]
    total: int
    page: int
    per_page: int


class StudentActivityBreakdownItem(BaseModel):
    action_type: str
    tokens_used: int


class PrepDetails(BaseModel):
    target_company: str | None
    target_role: str | None
    prep_mode: str | None
    tone: str | None
    interview_date: date | None


class ResumeSummary(BaseModel):
    ats_score: float | None
    last_scan_at: datetime | None


class StudyPlanSummary(BaseModel):
    completed_tasks: int
    total_tasks: int
    completion_percentage: float | None


class StudentTokenSummary(BaseModel):
    allocated: int
    consumed: int
    balance: int
    cap: int | None


class StudentDetailResponse(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    department: str | None
    graduation_year: int | None
    status: UserStatus
    created_at: datetime
    last_active_at: datetime | None
    access_expiry: date | None
    token_usage: StudentTokenSummary
    per_action_breakdown: list[StudentActivityBreakdownItem]
    prep_details: PrepDetails
    resume_summary: ResumeSummary
    study_plan: StudyPlanSummary


class InviteRequest(BaseModel):
    emails: list[EmailStr] = Field(min_length=1)


class InviteResult(BaseModel):
    imported: int
    skipped: list[dict[str, str]]
    error: str | None = None


class BulkInviteValidRow(BaseModel):
    row: int
    full_name: str
    email: EmailStr
    phone: str | None = None
    department: str | None = None
    graduation_year: int | None = None


class BulkInviteInvalidRow(BaseModel):
    row: int
    email: str | None = None
    errors: list[str]


class BulkInvitePreviewResponse(BaseModel):
    valid_rows: list[BulkInviteValidRow]
    invalid_rows: list[BulkInviteInvalidRow]
    total_valid: int
    total_invalid: int


class ApproveRejectResponse(BaseModel):
    status: str


class StudentStatusUpdate(BaseModel):
    status: UserStatus


class ExpiryUpdate(BaseModel):
    access_expiry: date | None
