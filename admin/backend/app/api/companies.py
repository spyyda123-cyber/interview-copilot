import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from shared.auth.dependencies import get_current_user
from shared.db.session import get_db
from app.schemas.company import CompanyCreate, CompanyListResponse, CompanyResponse, CompanyUpdate
from app.services.company_service import list_companies, create_company, get_company, update_company
from shared.models.admin_models import User

router = APIRouter(prefix="/companies", tags=["companies"])

@router.get("", response_model=CompanyListResponse)
def get_companies_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Get paginated placement companies for the admin's college"""
    return list_companies(
        db=db,
        college_id=current_user.college_id,
        page=page,
        per_page=per_page
    )

@router.post("", response_model=CompanyResponse)
def create_company_endpoint(
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new placement company"""
    comp = create_company(db, current_user.college_id, payload)
    
    # Return matched format
    return {
        "id": comp.id,
        "college_id": comp.college_id,
        "company_name": comp.company_name,
        "role": comp.role,
        "package_min": comp.package_min,
        "package_max": comp.package_max,
        "interview_date": comp.interview_date,
        "min_cgpa": comp.min_cgpa,
        "max_backlogs": comp.max_backlogs,
        "eligible_departments": comp.eligible_departments,
        "job_description": comp.job_description,
        "exemption_list": comp.exemption_list,
        "status": comp.status,
        "created_at": comp.created_at,
        "updated_at": comp.updated_at,
        "interested_count": 0,
        "approved_count": 0,
    }

@router.get("/{id}", response_model=CompanyResponse)
def get_company_endpoint(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get specific company details"""
    return get_company(db, current_user.college_id, id)

@router.patch("/{id}", response_model=CompanyResponse)
def update_company_endpoint(
    id: uuid.UUID,
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update placement company details"""
    comp = update_company(db, current_user.college_id, id, payload)
    
    # Needs to match CompanyResponse shape like create does to some extent, 
    # but since update_company returns the ORM model, and we have from_attributes=True,
    # the response_model should handle it automatically.
    return comp
