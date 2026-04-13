from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate
from shared.models.placement import PlacementCompany, PlacementApplication

def list_companies(
    db: Session,
    college_id: UUID,
    page: int = 1,
    per_page: int = 20,
):
    offset = (page - 1) * per_page
    query = db.query(PlacementCompany).filter(PlacementCompany.college_id == college_id).order_by(PlacementCompany.created_at.desc())
    
    total = query.count()
    companies = query.offset(offset).limit(per_page).all()
    
    items = []
    for comp in companies:
        interested_count = db.query(PlacementApplication).filter(
            PlacementApplication.company_id == comp.id,
            PlacementApplication.status == "INTERESTED"
        ).count()
        
        approved_count = db.query(PlacementApplication).filter(
            PlacementApplication.company_id == comp.id,
            PlacementApplication.status == "APPROVED"
        ).count()
        
        comp_dict = {
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
            "status": comp.status,
            "created_at": comp.created_at,
            "updated_at": comp.updated_at,
            "exemption_list": comp.exemption_list,
            "interested_count": interested_count,
            "approved_count": approved_count,
        }
        items.append(comp_dict)
        
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page
    }

def create_company(
    db: Session,
    college_id: UUID,
    payload: CompanyCreate,
) -> PlacementCompany:
    new_company = PlacementCompany(
        college_id=college_id,
        company_name=payload.company_name,
        role=payload.role,
        package_min=payload.package_min,
        package_max=payload.package_max,
        interview_date=payload.interview_date,
        min_cgpa=payload.min_cgpa,
        max_backlogs=payload.max_backlogs,
        eligible_departments=payload.eligible_departments,
        job_description=payload.job_description,
        exemption_list=payload.exemption_list,
        status="Review" if payload.status == "Review" else payload.status
    )
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    return new_company

def get_company(
    db: Session,
    college_id: UUID,
    company_id: UUID
):
    comp = db.query(PlacementCompany).filter(
        PlacementCompany.college_id == college_id,
        PlacementCompany.id == company_id
    ).first()
    
    if not comp:
        raise HTTPException(status_code=404, detail="Company not found")
        
    return comp

def update_company(
    db: Session,
    college_id: UUID,
    company_id: UUID,
    payload: CompanyUpdate
) -> PlacementCompany:
    comp = get_company(db, college_id, company_id)
    
    update_data = payload.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] not in ["Active", "Review", "Closed"]:
        update_data["status"] = comp.status

    for key, value in update_data.items():
        setattr(comp, key, value)
        
    db.commit()
    db.refresh(comp)
    return comp
