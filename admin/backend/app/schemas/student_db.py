from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

class StudentDatabaseResponse(BaseModel):
    id: UUID
    college_id: UUID
    roll_no: str
    name: str
    department: str
    cgpa: float
    backlogs: int
    email: str
    status: str
    created_at: datetime
    updated_at: datetime

class StudentDatabaseListResponse(BaseModel):
    records: list[StudentDatabaseResponse]
    total: int
    page: int
    per_page: int

class UploadResult(BaseModel):
    imported: int
    skipped: int
    error: str | None = None
