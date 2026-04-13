from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.schemas.college import (
    CollegeCreate,
    CollegeCreateResponse,
    CollegeDetailResponse,
    CollegeListResponse,
    CollegeStatusUpdate,
    CollegeUpdate,
)
from app.services import college_service
from shared.auth.dependencies import require_super_admin
from shared.db.session import get_db
from shared.models.admin_models import User
from shared.models.enums import CollegeStatus


router = APIRouter(tags=["Colleges"], dependencies=[Depends(require_super_admin)])


@router.get("", response_model=CollegeListResponse)
def list_colleges(
    search: str | None = None,
    status: CollegeStatus | None = None,

    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return college_service.list_colleges(db, search, status, page, per_page)


@router.post("", response_model=CollegeCreateResponse)
def create_college(
    payload: CollegeCreate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    return college_service.create_college(db, payload, current_user.id)


@router.get("/{college_id}", response_model=CollegeDetailResponse)
def get_college(college_id: UUID, db: Session = Depends(get_db)):
    return college_service.get_college_detail(db, college_id)


@router.patch("/{college_id}", response_model=CollegeDetailResponse)
def update_college(college_id: UUID, payload: CollegeUpdate, db: Session = Depends(get_db)):
    return college_service.update_college(db, college_id, payload)


@router.patch("/{college_id}/status", response_model=CollegeDetailResponse)
def toggle_college_status(
    college_id: UUID,
    payload: CollegeStatusUpdate,
    db: Session = Depends(get_db),
):
    return college_service.toggle_college_status(db, college_id, payload.status)


@router.delete("/{college_id}")
def delete_college(college_id: UUID, db: Session = Depends(get_db)):
    return college_service.delete_college(db, college_id)
