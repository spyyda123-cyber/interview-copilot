from uuid import UUID
from fastapi import APIRouter, Depends, Query, File, UploadFile
from sqlalchemy.orm import Session
from app.schemas.student_db import StudentDatabaseListResponse, UploadResult
from app.services import student_db_service
from shared.auth.dependencies import get_college_scope, require_college_admin
from shared.db.session import get_db

router = APIRouter(tags=["Student DB"], dependencies=[Depends(require_college_admin)])

@router.get("", response_model=StudentDatabaseListResponse)
def list_student_db_records(
    search: str | None = None,
    sort_by: str = Query(default="created_at"),
    sort_dir: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    return student_db_service.list_student_db_records(
        db,
        college_id,
        search,
        sort_by,
        sort_dir,
        page,
        per_page,
    )

@router.post("/upload", response_model=UploadResult)
async def upload_student_db(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    # Parse the CSV file and update records
    return await student_db_service.process_csv_upload(db, college_id, file)
