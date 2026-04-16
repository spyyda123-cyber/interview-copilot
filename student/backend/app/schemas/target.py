from pydantic import BaseModel


class TargetAnalyzeRequest(BaseModel):
    student_id: int
    company_name: str
    role: str | None = None
    jd_text: str


class TargetAnalyzeResponse(BaseModel):
    target_id: int
    status: str


class TargetStatusResponse(BaseModel):
    target_id: int
    status: str
    error: str | None = None
    required_skills: list[str] = []
    difficulty: str | None = None
    round_structure: str | None = None
