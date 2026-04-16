from pydantic import BaseModel


class PrepGenerateRequest(BaseModel):
    student_id: int


class PrepGenerateResponse(BaseModel):
    task_id: str
    status: str


class CodeReportRequest(BaseModel):
    question: str
    code: str
    language: str
    test_results: list
    concepts_in_course: list


class LaggingSkill(BaseModel):
    skill: str
    in_course: bool
    explanation: str


class CodeReportResponse(BaseModel):
    analysis: str
    lagging_skills: list[LaggingSkill]
