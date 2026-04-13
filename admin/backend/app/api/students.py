from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.schemas.student import (
    ApproveRejectResponse,
    BulkInvitePreviewResponse,
    ExpiryUpdate,
    InviteRequest,
    InviteResult,
    StudentDetailResponse,
    StudentListResponse,
    StudentStatusUpdate,
)
from app.services import student_service
from app.utils.csv_parser import parse_csv_upload
from shared.auth.dependencies import get_college_scope, get_current_user, require_college_admin
from shared.db.session import get_db
from shared.models import UserStatus


router = APIRouter(tags=["Students"], dependencies=[Depends(require_college_admin)])


@router.get("", response_model=StudentListResponse)
def list_students(
    search: str | None = None,
    status: UserStatus | None = None,
    target_company: str | None = None,
    target_role: str | None = None,
    sort_by: str = Query(default="created_at"),
    sort_dir: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    return student_service.list_students(
        db,
        college_id,
        search,
        status,
        target_company,
        target_role,
        sort_by,
        sort_dir,
        page,
        per_page,
    )


@router.post("/invite", response_model=InviteResult)
def invite_students(
    payload: InviteRequest,
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
    current_user=Depends(get_current_user),
):
    return student_service.invite_student_by_email(db, college_id, list(payload.emails), current_user.id)


@router.post("/bulk-invite/preview", response_model=BulkInvitePreviewResponse)
async def bulk_invite_preview(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
    current_user=Depends(get_current_user),
):
    csv_rows = await parse_csv_upload(file)
    return student_service.bulk_invite_from_csv(db, college_id, csv_rows, current_user.id)


@router.post("/bulk-invite/confirm", response_model=InviteResult)
async def bulk_invite_confirm(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
    current_user=Depends(get_current_user),
):
    csv_rows = await parse_csv_upload(file)
    preview = student_service.bulk_invite_from_csv(db, college_id, csv_rows, current_user.id)
    imported = student_service.confirm_bulk_invite(db, college_id, preview["valid_rows"], current_user.id)
    skipped = [{"email": row.get("email") or "", "reason": "; ".join(row["errors"])} for row in preview["invalid_rows"]]
    return {
        "imported": imported["imported"],
        "skipped": skipped,
        "error": imported.get("error"),
    }


@router.get("/pending", response_model=StudentListResponse)
def list_pending_students(
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    rows = student_service.list_pending_students(db, college_id)
    return {"students": rows, "total": len(rows), "page": 1, "per_page": len(rows) if rows else 1}


@router.get("/{user_id}", response_model=StudentDetailResponse)
def get_student(
    user_id: UUID,
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    return student_service.get_student_detail(db, college_id, user_id)


@router.patch("/{user_id}/approve", response_model=ApproveRejectResponse)
def approve_student(
    user_id: UUID,
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
    current_user=Depends(get_current_user),
):
    return student_service.approve_student(db, college_id, user_id, current_user.id)


@router.patch("/{user_id}/reject", response_model=ApproveRejectResponse)
def reject_student(
    user_id: UUID,
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    return student_service.reject_student(db, college_id, user_id)


@router.patch("/{user_id}/status", response_model=ApproveRejectResponse)
def update_student_status(
    user_id: UUID,
    payload: StudentStatusUpdate,
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    return student_service.toggle_student_status(db, college_id, user_id, payload.status)


@router.patch("/{user_id}/expiry", response_model=ApproveRejectResponse)
def update_student_expiry(
    user_id: UUID,
    payload: ExpiryUpdate,
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    return student_service.set_access_expiry(db, college_id, user_id, payload.access_expiry)
