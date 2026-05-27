import pandas as pd
from io import BytesIO
from uuid import UUID
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc
from shared.models.admin_models import StudentDatabaseRecord

EXPECTED_HEADERS = {
    "roll_no": "roll_no",
    "rollno": "roll_no",
    "roll": "roll_no",
    "roll no": "roll_no",
    "name": "name",
    "full_name": "name",
    "student name": "name",
    "department": "department",
    "dept": "department",
    "cgpa": "cgpa",
    "backlogs": "backlogs",
    "email": "email",
    "email id": "email",
    "email address": "email",
}

def list_student_db_records(
    db: Session,
    college_id: UUID,
    search: str | None,
    sort_by: str,
    sort_dir: str,
    page: int,
    per_page: int,
):
    query = db.query(StudentDatabaseRecord).filter(StudentDatabaseRecord.college_id == college_id)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                StudentDatabaseRecord.name.ilike(search_term),
                StudentDatabaseRecord.roll_no.ilike(search_term),
                StudentDatabaseRecord.email.ilike(search_term),
            )
        )

    # Sorting
    if sort_by == "name":
        order_col = StudentDatabaseRecord.name
    elif sort_by == "roll_no":
        order_col = StudentDatabaseRecord.roll_no
    elif sort_by == "cgpa":
        order_col = StudentDatabaseRecord.cgpa
    elif sort_by == "backlogs":
        order_col = StudentDatabaseRecord.backlogs
    else:
        order_col = StudentDatabaseRecord.created_at

    if sort_dir == "asc":
        query = query.order_by(asc(order_col))
    else:
        query = query.order_by(desc(order_col))

    total = query.count()
    offset = (page - 1) * per_page
    records = query.offset(offset).limit(per_page).all()

    return {
        "records": records,
        "total": total,
        "page": page,
        "per_page": per_page,
    }

def add_single_student(db: Session, college_id: UUID, payload) -> StudentDatabaseRecord:
    """Upsert a single student record by email."""
    from fastapi import HTTPException

    email = payload.email.strip().lower()
    if not email or not payload.roll_no.strip() or not payload.name.strip():
        raise HTTPException(status_code=400, detail="email, roll_no, and name are required.")

    existing = db.query(StudentDatabaseRecord).filter(
        StudentDatabaseRecord.college_id == college_id,
        StudentDatabaseRecord.email == email,
    ).first()

    if existing:
        existing.roll_no = payload.roll_no.strip()
        existing.name = payload.name.strip()
        existing.department = payload.department.strip() or "-"
        existing.cgpa = float(payload.cgpa)
        existing.backlogs = int(payload.backlogs)
        existing.status = "Active"
        db.commit()
        db.refresh(existing)
        return existing
    else:
        record = StudentDatabaseRecord(
            college_id=college_id,
            email=email,
            roll_no=payload.roll_no.strip(),
            name=payload.name.strip(),
            department=payload.department.strip() or "-",
            cgpa=float(payload.cgpa),
            backlogs=int(payload.backlogs),
            status="Active",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record


async def process_csv_upload(db: Session, college_id: UUID, file: UploadFile):
    content = await file.read()
    
    try:
        file_ext = (file.filename or "").lower()
        if file_ext.endswith(".xls") or file_ext.endswith(".xlsx"):
            df = pd.read_excel(BytesIO(content))
        else:
            df = pd.read_csv(BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot parse file: {str(e)}")

    try:
        df = df.where(pd.notnull(df), None)
        raw_rows = df.to_dict("records")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tabular format.")

    if not raw_rows:
        raise HTTPException(status_code=400, detail="Uploaded file is empty or invalid array.")

    imported = 0
    skipped = 0

    for raw_row in raw_rows:
        # map to our expected row format
        row = {}
        for key, value in raw_row.items():
            if key is None:
                continue
            normalized_key = EXPECTED_HEADERS.get(str(key).strip().lower())
            if normalized_key:
                row[normalized_key] = (str(value) if value is not None else "").strip()

        # Validate mandatory fields
        if not row.get("email") or not row.get("roll_no") or not row.get("name"):
            skipped += 1
            continue

        try:
            cgpa_str = row.get("cgpa")
            backlogs_str = row.get("backlogs")
            cgpa_val = float(cgpa_str) if cgpa_str else 0.0
            backlogs_val = int(float(backlogs_str)) if backlogs_str else 0
        except ValueError:
            skipped += 1
            continue
            
        department_val = row.get("department") or "-"

        # Upsert logic based on email or roll_no uniqueness per college
        existing = db.query(StudentDatabaseRecord).filter(
            StudentDatabaseRecord.college_id == college_id,
            StudentDatabaseRecord.email == row["email"]
        ).first()

        if existing:
            existing.roll_no = row["roll_no"]
            existing.name = row["name"]
            existing.department = department_val
            existing.cgpa = cgpa_val
            existing.backlogs = backlogs_val
            existing.status = "Active"
        else:
            new_record = StudentDatabaseRecord(
                college_id=college_id,
                email=row["email"],
                roll_no=row["roll_no"],
                name=row["name"],
                department=department_val,
                cgpa=cgpa_val,
                backlogs=backlogs_val,
                status="Active"
            )
            db.add(new_record)
        
        imported += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"imported": 0, "skipped": skipped, "error": f"Database error: {str(e)}"}
        
    return {"imported": imported, "skipped": skipped, "error": None}
