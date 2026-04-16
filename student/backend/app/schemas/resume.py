from typing import Optional

from pydantic import BaseModel, Field


class ResumeUploadResponse(BaseModel):
    resume_id: int
    status: str
    missing_skills: list[str]
    ats_score: float


class ResumeUploadMetadata(BaseModel):
    student_id: int = Field(..., description="Existing student id")
    student_name: Optional[str] = None
    student_email: Optional[str] = None
