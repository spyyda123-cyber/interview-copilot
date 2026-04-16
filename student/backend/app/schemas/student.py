from pydantic import BaseModel, EmailStr
from typing import Any


class StudentCreateRequest(BaseModel):
    first_name: str
    last_name: str
    phone: str
    department: str
    email: EmailStr
    primary_skill: str
    known_skills: list[Any]  # list of dict {"skill": str, "proficiency": str}
    support_mode: str
    tone: str
    coding_required: bool
    marksheets: list[Any] = []

class StudentCreateResponse(BaseModel):
    student_id: int
