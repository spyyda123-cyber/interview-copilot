from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Student, StudentProfile
from app.schemas.auth import AuthResponse, LoginRequest, SignupRequest
from app.security.auth_utils import get_password_hash, verify_password
from app.services.activity_logger import log_activity

router = APIRouter(prefix="/auth", tags=["auth"])

def _normalize_email(email: str) -> str:
    return email.strip().lower()

@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """Register a new student."""
    normalized_email = _normalize_email(payload.email)
    
    existing_user = db.query(Student).filter(Student.email.ilike(normalized_email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(payload.password)
    new_student = Student(
        full_name=payload.name,
        email=normalized_email,
        hashed_password=hashed_password,
        roll_number=payload.roll_number,
        department=payload.department,
        college=payload.college,
    )
    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    try:
        log_activity(db, normalized_email, "SIGNUP")
    except Exception:
        pass

    return AuthResponse(student_id=new_student.id)

@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a student."""
    normalized_email = _normalize_email(payload.email)
    
    student = db.query(Student).filter(Student.email.ilike(normalized_email)).first()
    if not student:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    if not student.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, student.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    try:
        log_activity(db, normalized_email, "LOGIN")
    except Exception:
        pass

    primary_skill = "General"
    profile = db.query(StudentProfile).filter(StudentProfile.student_id == student.id).first()
    if profile:
        primary_skill = profile.primary_skill

    return AuthResponse(
        student_id=student.id, 
        student_name=student.full_name,
        primary_skill=primary_skill
    )
