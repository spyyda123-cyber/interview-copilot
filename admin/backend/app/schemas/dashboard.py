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


class DashboardRecentApplication(BaseModel):
    student_name: str
    student_email: str
    company_name: str
    role: str
    status: str
    applied_at: str

class DashboardActiveCompany(BaseModel):
    id: str
    company_name: str
    role: str
    package_min: str | None
    package_max: str | None
    total_applied: int
    approved: int

class DashboardSummaryResponse(BaseModel):
    token_pool: TokenPoolSummary
    total_students: int
    active_students: int
    inactive_students: int
    low_token_alert: bool
    total_companies: int
    active_companies: int
    pending_approvals: int
    recent_applications: list[DashboardRecentApplication]
    active_companies_list: list[DashboardActiveCompany]
    recent_activity: list[DashboardActivityItem]
