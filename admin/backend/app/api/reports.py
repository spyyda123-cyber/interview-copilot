from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.schemas.readiness import ReadinessOverviewResponse
from app.services import readiness_service, report_service
from shared.auth.dependencies import get_college_scope, require_college_admin
from shared.db.session import get_db


router = APIRouter(tags=["Reports"], dependencies=[Depends(require_college_admin)])


@router.get("/readiness", response_model=ReadinessOverviewResponse)
def readiness_overview(
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    return readiness_service.get_readiness_overview(db, college_id)


@router.get("/reports/student-usage")
def download_student_usage_report(
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    content = report_service.generate_student_usage_csv(db, college_id)
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="student_usage_report.csv"'},
    )


@router.get("/reports/invite-summary")
def download_invite_summary_report(
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    content = report_service.generate_invite_summary_csv(db, college_id)
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="invite_summary_report.csv"'},
    )


@router.get("/reports/readiness")
def download_readiness_report(
    db: Session = Depends(get_db),
    college_id: UUID = Depends(get_college_scope),
):
    content = report_service.generate_readiness_csv(db, college_id)
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="readiness_report.csv"'},
    )
