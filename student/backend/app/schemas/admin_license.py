from datetime import date

from pydantic import BaseModel


class CreateLicenseRequest(BaseModel):
    company_name: str
    role: str | None = None
    interview_date: date
