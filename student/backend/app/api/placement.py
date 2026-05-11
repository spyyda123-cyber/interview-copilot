"""Placement company endpoints for students.

Students can:
1. List all placement companies for their college
2. Mark interest in a company
3. View their application status
4. Activate an approved company (triggers study plan generation)

FLOW:
  Admin adds company → Student sees it in placement page
  Student marks "Interested" → Application created with status=INTERESTED
  Admin approves → Application status changes to APPROVED
  Student activates → Application status=ACTIVATED, TargetInterview created,
                      plan generation enqueued immediately (fire-and-forget)
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.models import Student, TargetInterview
from shared.models.placement import PlacementApplication, PlacementCompany
from shared.models.admin_models import College, User, StudentDatabaseRecord

router = APIRouter(prefix="/placement", tags=["placement"])
logger = logging.getLogger(__name__)


class CompanyListItem(BaseModel):
    id: str
    company_name: str
    role: str
    package_min: Optional[float]
    package_max: Optional[float]
    interview_date: Optional[str]
    min_cgpa: Optional[float]
    max_backlogs: Optional[int]
    eligible_departments: list[str]
    job_description: Optional[str]
    status: str
    application_status: Optional[str]  # Student's application status if any


class PlacementListResponse(BaseModel):
    companies: list[CompanyListItem]
    total: int


class InterestRequest(BaseModel):
    student_id: int
    company_id: str  # UUID as string


class ActivateRequest(BaseModel):
    student_id: int
    company_id: str  # UUID as string


def _get_student_college_id(db: Session, student_id: int) -> Optional[UUID]:
    """
    Find the college_id for a student by matching their email/department to
    admin User records (students register via admin invite - same email).
    Also tries to match via college name on student record.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        return None

    # Try matching by email in the admin Users table (student is invited via email)
    if student.email:
        admin_user = db.query(User).filter(User.email.ilike(student.email)).first()
        if admin_user:
            return admin_user.college_id

    # Fallback: Try matching by college name
    if student.college:
        college = db.query(College).filter(College.name.ilike(f"%{student.college}%")).first()
        if college:
            return college.id

    # Last resort: check StudentDatabaseRecord by email
    if student.email:
        db_record = db.query(StudentDatabaseRecord).filter(
            StudentDatabaseRecord.email.ilike(student.email)
        ).first()
        if db_record:
            return db_record.college_id

    return None


@router.get("/companies")
def list_placement_companies(
    student_id: int = Query(..., description="Student ID"),
    db: Session = Depends(get_db),
):
    """List all Active placement companies for the student's college."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    college_id = _get_student_college_id(db, student_id)
    if not college_id:
        raise HTTPException(
            status_code=404,
            detail="College not found for student. Ask your admin to invite you via college email.",
        )

    # Get all Active companies for this college
    companies = (
        db.query(PlacementCompany)
        .filter(
            PlacementCompany.college_id == college_id,
            PlacementCompany.status == "Active",
        )
        .order_by(PlacementCompany.created_at.desc())
        .all()
    )

    # Get all student's applications for these companies
    company_ids = [c.id for c in companies]
    applications = (
        db.query(PlacementApplication)
        .filter(
            PlacementApplication.student_id == _get_admin_user_id(db, student),
            PlacementApplication.company_id.in_(company_ids),
        )
        .all()
    ) if company_ids else []

    app_map = {str(a.company_id): a.status for a in applications}

    items = []
    for comp in companies:
        items.append(
            CompanyListItem(
                id=str(comp.id),
                company_name=comp.company_name,
                role=comp.role,
                package_min=comp.package_min,
                package_max=comp.package_max,
                interview_date=comp.interview_date.isoformat() if comp.interview_date else None,
                min_cgpa=comp.min_cgpa,
                max_backlogs=comp.max_backlogs,
                eligible_departments=comp.eligible_departments or [],
                job_description=comp.job_description,
                status=comp.status,
                application_status=app_map.get(str(comp.id)),
            )
        )

    return PlacementListResponse(companies=items, total=len(items))


@router.get("/applications")
def list_student_applications(
    student_id: int = Query(..., description="Student ID"),
    db: Session = Depends(get_db),
):
    """List all applications submitted by a student (Interested, Approved, Rejected, Activated)."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    admin_user_id = _get_admin_user_id(db, student)
    if not admin_user_id:
        return {"applications": [], "total": 0}

    applications = (
        db.query(PlacementApplication)
        .filter(PlacementApplication.student_id == admin_user_id)
        .all()
    )

    result = []
    for app in applications:
        comp = db.query(PlacementCompany).filter(PlacementCompany.id == app.company_id).first()
        if comp:
            result.append({
                "application_id": str(app.id),
                "company_id": str(comp.id),
                "company_name": comp.company_name,
                "role": comp.role,
                "package_min": comp.package_min,
                "package_max": comp.package_max,
                "interview_date": comp.interview_date.isoformat() if comp.interview_date else None,
                "job_description": comp.job_description,
                "application_status": app.status,
                "applied_at": app.created_at.isoformat(),
                "updated_at": app.updated_at.isoformat(),
            })

    return {"applications": result, "total": len(result)}


@router.post("/interest")
def mark_interest(payload: InterestRequest, db: Session = Depends(get_db)):
    """Student marks interest in a company."""
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    try:
        company_uuid = UUID(payload.company_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid company ID")

    company = db.query(PlacementCompany).filter(PlacementCompany.id == company_uuid).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.status != "Active":
        raise HTTPException(status_code=400, detail="Company is not accepting applications")

    admin_user_id = _get_admin_user_id(db, student)
    if not admin_user_id:
        raise HTTPException(
            status_code=400,
            detail="Your account is not linked to a college. Contact your admin.",
        )

    # Check if already applied
    existing = (
        db.query(PlacementApplication)
        .filter(
            PlacementApplication.company_id == company_uuid,
            PlacementApplication.student_id == admin_user_id,
        )
        .first()
    )
    if existing:
        return {
            "status": existing.status,
            "application_id": str(existing.id),
            "message": f"Already applied with status: {existing.status}",
        }

    # Create new application
    application = PlacementApplication(
        company_id=company_uuid,
        student_id=admin_user_id,
        status="INTERESTED",
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    return {
        "status": "INTERESTED",
        "application_id": str(application.id),
        "message": "Interest marked successfully. Awaiting admin approval.",
    }


@router.post("/activate")
def activate_company(payload: ActivateRequest, db: Session = Depends(get_db)):
    """Student activates an APPROVED company - triggers study plan generation.
    
    Idempotent: calling again on an already-ACTIVATED company re-enqueues plan generation
    (useful when the student wants to regenerate their plan).
    """
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    try:
        company_uuid = UUID(payload.company_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid company ID")

    admin_user_id = _get_admin_user_id(db, student)
    if not admin_user_id:
        raise HTTPException(status_code=400, detail="Account not linked to college")

    application = (
        db.query(PlacementApplication)
        .filter(
            PlacementApplication.company_id == company_uuid,
            PlacementApplication.student_id == admin_user_id,
        )
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="No application found for this company")

    # Allow both APPROVED and already-ACTIVATED (idempotent re-activation)
    if application.status not in ("APPROVED", "ACTIVATED"):
        raise HTTPException(
            status_code=400,
            detail=f"Company not yet approved. Current status: {application.status}",
        )

    company = db.query(PlacementCompany).filter(PlacementCompany.id == company_uuid).first()

    application.status = "ACTIVATED"

    # Bridge to Prep/Plan module: Create a TargetInterview if one doesn't exist for this company
    existing_target = (
        db.query(TargetInterview)
        .filter(
            TargetInterview.student_id == student.id,
            TargetInterview.company_name == company.company_name
        )
        .first()
    )

    target_id = None
    if not existing_target and company:
        new_target = TargetInterview(
            student_id=student.id,
            company_name=company.company_name,
            role=company.role,
            jd_text=company.job_description or f"Interview for {company.role} at {company.company_name}",
            analysis_status="processing"
        )
        db.add(new_target)
        db.flush()
        target_id = new_target.id
    elif existing_target:
        target_id = existing_target.id

    db.commit()

    # Fire-and-forget: delete old plan and enqueue fresh generation.
    # Uses a separate try/except so activation always succeeds even if plan ops fail.
    try:
        from app.services.plan_service import build_plan_signature
        from app.models import LearningPlan
        from app.tasks.jobs import generate_plan_task

        role = company.role or "general"
        plan_signature = build_plan_signature(student.id, company.company_name, role)

        # Step 1: Delete ALL existing plans for this signature in a clean transaction
        old_plans = (
            db.query(LearningPlan)
            .filter(LearningPlan.plan_signature == plan_signature)
            .all()
        )
        deleted_count = len(old_plans)
        for old_plan in old_plans:
            db.delete(old_plan)

        # Flush the deletes first, then commit — avoids UniqueViolation on insert
        db.flush()
        db.commit()

        if deleted_count:
            logger.info(
                "[PLACEMENT-ACTIVATE] Deleted %d stale plan(s) for student_id=%s company=%s",
                deleted_count, student.id, company.company_name
            )

        # Step 2: Insert fresh stub in a new transaction
        stub_plan = LearningPlan(
            student_id=student.id,
            company_name=company.company_name,
            role=role,
            days_available=14,
            plan_signature=plan_signature,
            status="generating",
            plan_json={},
        )
        db.add(stub_plan)
        db.commit()

        # Step 3: Enqueue Celery task
        generate_plan_task.delay(student.id, company.company_name, 14, role)
        logger.info(
            "[PLACEMENT-ACTIVATE] Enqueued plan generation for student_id=%s company=%s role=%s",
            student.id, company.company_name, role
        )

    except Exception as plan_exc:
        # Non-fatal: plan generation failure should not block activation response
        logger.warning(
            "[PLACEMENT-ACTIVATE] Could not enqueue plan generation: %s", plan_exc
        )
        # Rollback any partial plan transaction so the session is clean
        try:
            db.rollback()
        except Exception:
            pass

    return {
        "status": "ACTIVATED",
        "application_id": str(application.id),
        "target_id": target_id,
        "company_name": company.company_name if company else "",
        "role": company.role if company else "",
        "message": "Company activated. Your study plan is being generated.",
    }


def _get_admin_user_id(db: Session, student: Student) -> Optional[UUID]:
    """Get the admin User UUID matching the student's email.
    
    Flow:
    1. Try to find an existing admin User with the same email
    2. If not found, look for StudentDatabaseRecord (uploaded by admin)
       and create a new User from it
    3. If neither exists, return None (student is not linked to any college)
    """
    if not student.email:
        return None
    
    from shared.models.admin_models import User, UserRole, UserStatus, StudentDatabaseRecord
    
    # Try to find existing admin User by email
    admin_user = db.query(User).filter(User.email.ilike(student.email)).first()
    if admin_user:
        return admin_user.id
    
    # Try to find StudentDatabaseRecord by email (case-insensitive)
    db_record = db.query(StudentDatabaseRecord).filter(
        StudentDatabaseRecord.email.ilike(student.email)
    ).first()
    
    if db_record:
        # Create a new User from the StudentDatabaseRecord
        try:
            new_user = User(
                college_id=db_record.college_id,
                full_name=student.full_name or db_record.name or "Student",
                email=db_record.email,  # Use the exact email from StudentDatabaseRecord
                department=db_record.department,
                role=UserRole.STUDENT,
                status=UserStatus.ACTIVE,
                password_hash=student.hashed_password or "dummy"
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            return new_user.id
        except Exception as e:
            logger.error(f"Failed to create User from StudentDatabaseRecord: {e}")
            db.rollback()
            return None
    
    # Student not found in StudentDatabaseRecord - not linked to any college
    return None
