from pydantic import BaseModel


class PlanGenerateRequest(BaseModel):
    student_id: int
    company_name: str
    days_available: int
    role: str | None = None


class PlanGenerateResponse(BaseModel):
    task_id: str
    plan_id: int | None = None
    status: str


class PlanDetailResponse(BaseModel):
    plan_id: int
    student_id: int
    company_name: str
    role: str
    days_available: int
    plan_json: dict
    summary_generated: bool = False


class PlanTaskStatusResponse(BaseModel):
    task_id: str
    status: str
