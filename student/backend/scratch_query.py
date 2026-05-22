from app.db.session import SessionLocal
from app.models import Student, User
from app.security.auth_utils import verify_password

db = SessionLocal()
student = db.query(Student).filter(Student.email == "student3@clg.com").first()
if student:
    print(f"STUDENT EMAIL: {student.email}")
    print(f"STUDENT HASH: {student.hashed_password}")
    is_valid = verify_password("password123", student.hashed_password)
    print(f"VERIFY password123: {is_valid}")
    # Also verify some other password candidates if any
    is_valid_p = verify_password("Password123", student.hashed_password)
    print(f"VERIFY Password123: {is_valid_p}")
else:
    print("Student not found!")
