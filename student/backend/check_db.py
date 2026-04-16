import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup database connection
DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/interview_copilot"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def main():
    db = SessionLocal()
    try:
        # Import the model
        # We need to add the backend path to sys.path
        sys.path.append(r"D:\17.3interview copilot\interview copilot\interview-copilot\student\backend")
        from shared.models.prep_license import PrepLicense
        from shared.models.student import Student

        key = "TCSX-2026-D597E670"
        license = db.query(PrepLicense).filter(PrepLicense.license_key == key).first()
        
        if not license:
            print(f"License {key} not found in DB.")
        else:
            print(f"License Key: {license.license_key}")
            print(f"Status: {license.status}")
            print(f"Student ID: {license.student_id}")
            print(f"Company: {license.company_name}")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
