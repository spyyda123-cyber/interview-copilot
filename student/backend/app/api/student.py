from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
import shutil
import uuid
import os
from app.core.config import settings
from app.db.session import get_db
from app.models import Student, StudentProfile
from app.schemas.student import StudentCreateRequest, StudentCreateResponse

router = APIRouter(prefix="/student", tags=["student"])


@router.post("/create", response_model=StudentCreateResponse)
def create_student(payload: StudentCreateRequest, db: Session = Depends(get_db)):
    student = (
        db.query(Student)
        .filter(Student.email == payload.email)
        .first()
    )

    if not student:
        student = Student(
            first_name=payload.first_name,
            last_name=payload.last_name,
            full_name=f"{payload.first_name} {payload.last_name}",
            phone=payload.phone,
            department=payload.department,
            email=payload.email,
        )
        db.add(student)
        db.flush()
    else:
        student.first_name = payload.first_name
        student.last_name = payload.last_name
        student.full_name = f"{payload.first_name} {payload.last_name}"
        student.phone = payload.phone
        student.department = payload.department

    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.student_id == student.id)
        .first()
    )

    if not profile:
        profile = StudentProfile(
            student_id=student.id,
            primary_skill=payload.primary_skill,
            known_skills=payload.known_skills,
            support_mode=payload.support_mode,
            tone=payload.tone,
            coding_required=payload.coding_required,
            marksheets=payload.marksheets,
        )
        db.add(profile)
    else:
        profile.primary_skill = payload.primary_skill
        profile.known_skills = payload.known_skills
        profile.support_mode = payload.support_mode
        profile.tone = payload.tone
        profile.coding_required = payload.coding_required
        profile.marksheets = payload.marksheets

    db.commit()
    db.refresh(student)

    return StudentCreateResponse(student_id=student.id)

@router.post("/marksheets/upload")
def upload_marksheet(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".pdf", ".jpg", ".jpeg", ".png")):
        raise HTTPException(status_code=400, detail="Only PDF, JPG, PNG files are supported.")
    
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Return file info to be shown in UI and submitted with personal info form
    return {
        "file_path": file_path,
        "file_name": file.filename,
    }
