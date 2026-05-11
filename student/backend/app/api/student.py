from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Form
from sqlalchemy.orm import Session
import shutil
import uuid
import os
from app.core.config import settings
from app.db.session import get_db
from app.models import Student, StudentProfile, Marksheet
from app.schemas.student import StudentCreateRequest, StudentCreateResponse
from shared.models.admin_models import StudentDatabaseRecord
from shared.storage import get_s3_service

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
def upload_marksheet(
    student_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload and store marksheet for a student.
    
    PROCESS:
    1. Validate student exists and file format
    2. Read file bytes
    3a. If S3 enabled: upload to S3 under marksheets/<uuid>.<ext>, store S3 URL
    3b. If S3 disabled: save to local filesystem
    4. Create Marksheet DB record linked to student
    5. Return marksheet with S3 URL
    """
    if not file.filename.lower().endswith((".pdf", ".jpg", ".jpeg", ".png")):
        raise HTTPException(status_code=400, detail="Only PDF, JPG, PNG files are supported.")
    
    # ── Validate student exists ──────────────────────────────────
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # ── Read file bytes ──────────────────────────────────────────
    file_bytes = file.file.read()
    ext = os.path.splitext(file.filename)[1].lower()
    file_type = ext.lstrip('.')  # e.g., 'pdf', 'jpg', 'png'
    filename = f"{uuid.uuid4().hex}{ext}"
    
    # ── Storage: S3 (preferred) or local fallback ──────────────────
    s3 = get_s3_service()
    
    if s3:
        # Upload to S3 under marksheets/ prefix
        s3_key = f"marksheets/{filename}"
        content_type = "application/pdf" if ext == ".pdf" else f"image/{ext.lstrip('.')}"
        if content_type == "image/jpg":
            content_type = "image/jpeg"
        
        try:
            file_path = s3.upload_file(
                file_bytes=file_bytes,
                key=s3_key,
                content_type=content_type,
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"File upload to S3 failed: {exc}")
    else:
        # Fallback: save to local filesystem
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            buffer.write(file_bytes)
    
    # ── Persist Marksheet record ─────────────────────────────────
    marksheet = Marksheet(
        student_id=student.id,
        file_path=file_path,
        file_name=file.filename,
        file_type=file_type,
    )
    db.add(marksheet)
    db.commit()
    db.refresh(marksheet)
    
    # ── Parse Marksheet via Gemini ───────────────────────────────
    try:
        from app.services.marksheet_service import parse_marksheet_file
        parsed_data = parse_marksheet_file(marksheet.id, file_path, db)
    except Exception as exc:
        print(f"Marksheet parsing failed: {exc}")
        parsed_data = {"cgpa": 0.0, "backlogs": 0}

    # Return marksheet info  
    return {
        "id": marksheet.id,
        "file_path": file_path,
        "file_name": file.filename,
        "file_type": file_type,
        "created_at": marksheet.created_at.isoformat(),
        "parsed_data": parsed_data,
    }


@router.get("/marksheets/{student_id}")
def get_student_marksheets(
    student_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve all marksheets for a student.
    
    Returns list of marksheets with S3 URLs.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    marksheets = db.query(Marksheet).filter(Marksheet.student_id == student_id).all()
    
    return {
        "student_id": student_id,
        "marksheets": [
            {
                "id": m.id,
                "file_path": m.file_path,
                "file_name": m.file_name,
                "file_type": m.file_type,
                "created_at": m.created_at.isoformat(),
            } for m in marksheets
        ]
    }

@router.get("/{student_id}/profile")
def get_student_profile(
    student_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve the student's profile including academic records (CGPA, backlogs) from admin database."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    profile = db.query(StudentProfile).filter(StudentProfile.student_id == student.id).first()
    
    profile_data = {
        "id": student.id,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "email": student.email,
        "department": student.department,
        "primary_skill": profile.primary_skill if profile else "General",
        "cgpa": 0.0,
        "backlogs": 0,
        "is_verified": False,
    }

    if student.email:
        db_record = db.query(StudentDatabaseRecord).filter(
            StudentDatabaseRecord.email.ilike(student.email)
        ).first()
        
        if db_record:
            profile_data["cgpa"] = db_record.cgpa
            profile_data["backlogs"] = db_record.backlogs
            profile_data["department"] = db_record.department
            profile_data["is_verified"] = True
        elif profile and profile.marksheets:
            latest_marksheet = profile.marksheets[-1]
            profile_data["cgpa"] = latest_marksheet.get("cgpa", 0.0)
            profile_data["backlogs"] = latest_marksheet.get("backlogs", 0)

    return profile_data
