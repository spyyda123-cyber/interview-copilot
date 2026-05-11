from sqlalchemy import create_engine, text
import sys, os
from uuid import UUID

# Set up paths to import shared models
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.db.session import engine
from shared.models.admin_models import User, UserRole, UserStatus, StudentDatabaseRecord, College

STUDENT_ID = 40
COLLEGE_NAME = "PSG Tech"
COLLEGE_ID = UUID("ff7557e5-69d3-4f96-a2fb-0441a39ed229")

with engine.begin() as conn:
    # 1. Get student info
    res = conn.execute(text("SELECT email, full_name, hashed_password, department, roll_number FROM students WHERE id = :id"), {"id": STUDENT_ID}).fetchone()
    if not res:
        print(f"Student {STUDENT_ID} not found")
        sys.exit(1)
    
    email, full_name, hashed_password, department, roll_no = res
    print(f"Fixing student: {email} ({full_name})")

    # 2. Update student's college
    conn.execute(text("UPDATE students SET college = :college WHERE id = :id"), {"college": COLLEGE_NAME, "id": STUDENT_ID})
    print(f"Updated student college to {COLLEGE_NAME}")

    # 4. Create/Update admin User record
    user_exists = conn.execute(text("SELECT id FROM users WHERE email = :email"), {"email": email}).fetchone()
    if not user_exists:
        conn.execute(text("""
            INSERT INTO users (id, college_id, full_name, email, department, role, status, password_hash, created_at)
            VALUES (gen_random_uuid(), :cid, :name, :email, :dept, :role, :status, :pw, now())
        """), {
            "cid": COLLEGE_ID,
            "name": full_name or "Student",
            "email": email,
            "dept": department or "Computer Science",
            "role": "STUDENT",
            "status": "ACTIVE",
            "pw": hashed_password or "dummy"
        })
        print(f"Created admin User record for {email}")
    else:
        conn.execute(text("UPDATE users SET college_id = :cid WHERE email = :email"), {"cid": COLLEGE_ID, "email": email})
        print(f"Updated existing admin User record for {email} to college {COLLEGE_ID}")

    # 5. Ensure StudentDatabaseRecord exists
    db_rec_exists = conn.execute(text("SELECT id FROM student_db_records WHERE email = :email"), {"email": email}).fetchone()
    if not db_rec_exists:
        conn.execute(text("""
            INSERT INTO student_db_records (id, college_id, roll_no, name, email, department, cgpa, backlogs, created_at, updated_at)
            VALUES (gen_random_uuid(), :cid, :roll, :name, :email, :dept, 8.5, 0, now(), now())
        """), {
            "cid": COLLEGE_ID,
            "roll": roll_no or "T12345",
            "name": full_name or "Student",
            "email": email,
            "dept": department or "Computer Science"
        })
        print(f"Created StudentDatabaseRecord (student_db_records) for {email}")

print("DONE. Student should now be linked to PSG Tech.")
