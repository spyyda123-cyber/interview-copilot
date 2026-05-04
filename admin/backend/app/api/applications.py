"""Company application approval endpoints for admin.

Admin can:
1. List all applications per company (students who marked interest)
2. Approve or reject individual applications
3. View eligibility against company criteria (CGPA, backlogs, dept)
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from shared.auth.dependencies import get_college_scope, require_college_admin
from shared.db.session import get_db
from shared.models.placement import PlacementApplication, PlacementCompany
from shared.models.admin_models import User, StudentDatabaseRecord

router = APIRouter(prefix="/applications", tags=["applications"])


class ApplicationItem(BaseModel):
    application_id: str
    student_id: str  # admin User UUID
    student_name: str
    student_email: str
    department: Optional[str]
    company_id: str
    company_name: str
    role: str
    application_status: str
    applied_at: str
    # Eligibility from student DB
    cgpa: Optional[float]
    backlogs: Optional[int]
    roll_no: Optional[str]
    # Meets criteria flags
    meets_cgpa: Optional[bool]
    meets_backlogs: Optional[bool]
    meets_dept: Optional[bool]


class ApplicationListResponse(BaseModel):
    applications: list[ApplicationItem]
    total: int
    page: int
    per_page: int


@router.get("", response_model=ApplicationListResponse)
def list_applications(
    company_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    college_id=Depends(get_college_scope),
    _=Depends(require_college_admin),
):
    """List all student applications for this college's companies."""
    # Get all companies for this college
    company_query = db.query(PlacementCompany).filter(
        PlacementCompany.college_id == college_id
    )
    if company_id:
        try:
            company_query = company_query.filter(PlacementCompany.id == uuid.UUID(company_id))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid company_id")

    college_company_ids = [c.id for c in company_query.all()]

    if not college_company_ids:
        return ApplicationListResponse(applications=[], total=0, page=page, per_page=per_page)

    app_query = db.query(PlacementApplication).filter(
        PlacementApplication.company_id.in_(college_company_ids)
    )
    if status:
        app_query = app_query.filter(PlacementApplication.status == status.upper())

    total = app_query.count()
    applications = (
        app_query.order_by(PlacementApplication.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = []
    for app in applications:
        # Get student (admin User record)
        student_user = db.query(User).filter(User.id == app.student_id).first()
        # Get company
        company = db.query(PlacementCompany).filter(PlacementCompany.id == app.company_id).first()

        # Get student DB record (CGPA, backlogs, etc.)
        db_record: Optional[StudentDatabaseRecord] = None
        if student_user and student_user.email:
            db_record = (
                db.query(StudentDatabaseRecord)
                .filter(
                    StudentDatabaseRecord.email.ilike(student_user.email),
                    StudentDatabaseRecord.college_id == college_id,
                )
                .first()
            )

        # Compute eligibility
        meets_cgpa = None
        meets_backlogs = None
        meets_dept = None
        if db_record and company:
            if company.min_cgpa is not None:
                meets_cgpa = db_record.cgpa >= company.min_cgpa
            if company.max_backlogs is not None:
                meets_backlogs = db_record.backlogs <= company.max_backlogs
            if company.eligible_departments:
                dept = db_record.department or (student_user.department if student_user else None)
                if dept:
                    meets_dept = any(
                        dept.lower() in d.lower() or d.lower() in dept.lower()
                        for d in company.eligible_departments
                    )

        items.append(
            ApplicationItem(
                application_id=str(app.id),
                student_id=str(app.student_id),
                student_name=student_user.full_name if student_user else "Unknown",
                student_email=student_user.email if student_user else "",
                department=db_record.department if db_record else (student_user.department if student_user else None),
                company_id=str(app.company_id),
                company_name=company.company_name if company else "Unknown",
                role=company.role if company else "",
                application_status=app.status,
                applied_at=app.created_at.isoformat(),
                cgpa=db_record.cgpa if db_record else None,
                backlogs=db_record.backlogs if db_record else None,
                roll_no=db_record.roll_no if db_record else None,
                meets_cgpa=meets_cgpa,
                meets_backlogs=meets_backlogs,
                meets_dept=meets_dept,
            )
        )

    return ApplicationListResponse(
        applications=items, total=total, page=page, per_page=per_page
    )


@router.patch("/{application_id}/approve")
def approve_application(
    application_id: str,
    db: Session = Depends(get_db),
    college_id=Depends(get_college_scope),
    _=Depends(require_college_admin),
):
    """Approve a student's placement application."""
    try:
        app_uuid = uuid.UUID(application_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid application ID")

    app = db.query(PlacementApplication).filter(PlacementApplication.id == app_uuid).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Validate it belongs to this college's company
    company = db.query(PlacementCompany).filter(
        PlacementCompany.id == app.company_id,
        PlacementCompany.college_id == college_id,
    ).first()
    if not company:
        raise HTTPException(status_code=403, detail="Not authorized")

    if app.status not in ("INTERESTED",):
        raise HTTPException(status_code=400, detail=f"Cannot approve an application with status {app.status}")

    app.status = "APPROVED"
    db.commit()
    return {"status": "APPROVED", "application_id": str(app.id)}


@router.patch("/{application_id}/reject")
def reject_application(
    application_id: str,
    db: Session = Depends(get_db),
    college_id=Depends(get_college_scope),
    _=Depends(require_college_admin),
):
    """Reject a student's placement application."""
    try:
        app_uuid = uuid.UUID(application_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid application ID")

    app = db.query(PlacementApplication).filter(PlacementApplication.id == app_uuid).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    company = db.query(PlacementCompany).filter(
        PlacementCompany.id == app.company_id,
        PlacementCompany.college_id == college_id,
    ).first()
    if not company:
        raise HTTPException(status_code=403, detail="Not authorized")

    app.status = "REJECTED"
    db.commit()
    return {"status": "REJECTED", "application_id": str(app.id)}
