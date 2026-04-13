from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.dashboard import DashboardSummaryResponse
from app.services import dashboard_service
from shared.auth.dependencies import get_college_scope, require_college_admin
from shared.db.session import get_db


router = APIRouter(tags=["Dashboard"], dependencies=[Depends(require_college_admin)])


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    return dashboard_service.get_dashboard_summary(db, college_id)
