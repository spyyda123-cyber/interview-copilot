import sys
sys.path.append(r"D:\17.3interview copilot\interview copilot\interview-copilot\student\backend")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from shared.models.prep_license import PrepLicense
from shared.models.student import Student
from datetime import datetime

DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/interview_copilot"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

db = SessionLocal()
try:
    # 1. Create a dummy license
    key = "TCSX-9999-DUMMY"
    lic = db.query(PrepLicense).filter_by(license_key=key).first()
    if not lic:
        lic = PrepLicense(license_key=key, company_name="TCS", interview_date=datetime.now().date(), status="unused")
        db.add(lic)
        db.commit()
        db.refresh(lic)
        print("Created dummy license.")

    # 2. Simulate activation
    student = db.query(Student).filter_by(email="ashikcreationz01@gmail.com").first()
    
    lic.student_id = student.id
    lic.activated_at = datetime.utcnow()
    lic.status = "active"
    db.commit()
    db.refresh(lic)

    print(f"After commit: license.status={lic.status}, license.student_id={lic.student_id}")

    # Re-query
    db.expunge_all()
    lic2 = db.query(PrepLicense).filter_by(license_key=key).first()
    print(f"Re-queried: license.status={lic2.status}, license.student_id={lic2.student_id}")

finally:
    db.close()
