from pydantic import BaseModel


class KnowledgeIngestFileRequest(BaseModel):
    title: str
    company_name: str
    role: str | None = None
    file_path: str
    source: str | None = None


class KnowledgeIngestResponse(BaseModel):
    document_id: int
    status: str
