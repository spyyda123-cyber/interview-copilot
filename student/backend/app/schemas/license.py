from datetime import date

from pydantic import BaseModel, EmailStr


class LicenseActivateRequest(BaseModel):
    name: str
    email: EmailStr
    license_key: str


class LicenseActivateResponse(BaseModel):
    student_id: int
    company_name: str
    role: str | None
    interview_date: date
