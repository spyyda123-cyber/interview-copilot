"""Admin endpoints for SaaS license management.

These endpoints are ADMIN-ONLY and protected by X-ADMIN-KEY header validation.
All routes in this module require valid admin authentication.

LICENSE CREATION WORKFLOW:
1. Admin calls POST /admin/license/create with company, role, interview_date
2. generate_license_key() creates unique key: "COMPANY-YEAR-TOKEN"
3. PrepLicense record created with status='unused', student_id=NULL
4. License key transmitted to student out-of-band (email, etc.)
5. Student activates license via onboarding flow
6. Once activated: status='active', student_id populated, student accesses prep

KEY FIELD POPULATION:
- license_key: Generated actively (checked for uniqueness via retry)
- status: Set to 'unused' at creation
- student_id: NULL until student activation
- company_name: Required; must match target company in all future API calls
- role: Optional; used for targeting specific interview tracks
- interview_date: Admin-specified; drives expiration and days_available

UNIQUENESS:
- license_key must be globally unique (DB constraint)
- GenerationStrategy: Retry up to 5 times if collision
- If 5 collisions: return 500 (very rare in production)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.prep_license import PrepLicense
from app.schemas.admin_license import CreateLicenseRequest
from app.security.admin_auth import verify_admin_access
from app.utils.license_key import generate_license_key

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(verify_admin_access)],  # All routes require X-ADMIN-KEY header
)


@router.post(
    "/license/create",
    summary="Create prep license",
    description="Admin-only endpoint to generate a paid license key for interview prep.",
)
def create_license(payload: CreateLicenseRequest, db: Session = Depends(get_db)):
    """Create a new unused license key.
    
    Args:
        payload: CreateLicenseRequest with company_name, role, interview_date
        db: Database session
        
    Returns:
        dict: Created license with license_key, company_name, role, interview_date
        
    Raises:
        HTTPException(403): X-ADMIN-KEY header validation failed (caught by Depends)
        HTTPException(500): Failed to generate unique key after 5 attempts
        
    License Lifecycle After Creation:
    - Status: 'unused'
    - Student ID: NULL (populated when student activates)
    - Ready for: Student activation via onboarding
    """
    max_attempts = 5
    for _ in range(max_attempts):
        license_key = generate_license_key(payload.company_name)
        license_row = PrepLicense(
            license_key=license_key,
            student_id=None,  # Populated when student activates
            company_name=payload.company_name,
            role=payload.role,
            interview_date=payload.interview_date,  # Drives expiration
            activated_at=None,  # Set when student activates
            status="unused",  # FSM: unused -> active -> expired
            plan_generated=False,  # One-time flag for Gemini spending
        )

        db.add(license_row)
        try:
            db.commit()
            db.refresh(license_row)
            return {
                "license_key": license_row.license_key,
                "company_name": license_row.company_name,
                "role": license_row.role,
                "interview_date": license_row.interview_date,
            }
        except IntegrityError:
            # Uniqueness collision; retry with new key
            db.rollback()

    raise HTTPException(status_code=500, detail="Failed to generate unique license key")
