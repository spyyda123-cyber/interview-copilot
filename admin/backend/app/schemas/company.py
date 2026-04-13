from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

class CompanyCreate(BaseModel):
    company_name: str
    role: str
    package_min: Optional[float] = None
    package_max: Optional[float] = None
    interview_date: Optional[date] = None
    min_cgpa: Optional[float] = None
    max_backlogs: Optional[int] = None
    eligible_departments: list[str] = Field(default_factory=list)
    job_description: Optional[str] = None
    exemption_list: list[str] = Field(default_factory=list)
    status: str = "Review"

class CompanyUpdate(BaseModel):
    company_name: Optional[str] = None
    role: Optional[str] = None
    package_min: Optional[float] = None
    package_max: Optional[float] = None
    interview_date: Optional[date] = None
    min_cgpa: Optional[float] = None
    max_backlogs: Optional[int] = None
    eligible_departments: Optional[list[str]] = None
    job_description: Optional[str] = None
    exemption_list: Optional[list[str]] = None
    status: Optional[str] = None

class CompanyResponse(BaseModel):
    id: UUID
    college_id: UUID
    company_name: str
    role: str
    package_min: Optional[float] = None
    package_max: Optional[float] = None
    interview_date: Optional[date] = None
    min_cgpa: Optional[float] = None
    max_backlogs: Optional[int] = None
    eligible_departments: list[str]
    job_description: Optional[str] = None
    exemption_list: list[str] = Field(default_factory=list)
    status: str
    created_at: datetime
    updated_at: datetime
    
    # Aggregated fields for admin view
    interested_count: int = 0
    approved_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class CompanyListResponse(BaseModel):
    items: list[CompanyResponse]
    total: int
    page: int
    per_page: int
