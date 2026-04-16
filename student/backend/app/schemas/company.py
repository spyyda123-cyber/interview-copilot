from pydantic import BaseModel


class CompanyAnalyzeRequest(BaseModel):
    company_name: str
    role: str | None = None


class CompanyAnalyzeResponse(BaseModel):
    company_name: str
    role: str | None = None
    context: str
