"""
SCENARIO 3: Java Developer → Python Backend Developer (DataCorp)
EMAIL:    java_to_python_test@example.com  |  PASSWORD: password123
LICENSE:  TEST-S3-JAVA-PYTHON-2026
EXPECTED: Python-native questions + 'If from Java:' bridging in answers Day 1-2 only
"""
import sys
from datetime import datetime, timedelta
from pathlib import Path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Student, StudentProfile, TargetInterview, Resume, ResumeSection, ResumeGapAnalysis, PrepLicense, User, College, StudentActivityLog, InterviewFeedback, Marksheet
from shared.models.placement import PlacementCompany, PlacementApplication
from shared.config import settings

def run():
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    TEST_EMAIL = "java_to_python_test@example.com"
    TEST_LICENSE = "TEST-S3-JAVA-PYTHON-2026"
    COMPANY = "DataCorp"
    ROLE = "Python Backend Developer"
    try:
        # Cleanup
        for m in db.query(Student).filter(Student.email == TEST_EMAIL).all():
            db.query(InterviewFeedback).filter(InterviewFeedback.student_id == m.id).delete()
            db.query(Marksheet).filter(Marksheet.student_id == m.id).delete()
            db.delete(m)
        for m in db.query(User).filter(User.email == TEST_EMAIL).all():
            db.query(PlacementApplication).filter(PlacementApplication.student_id == m.id).delete()
            db.query(StudentActivityLog).filter(StudentActivityLog.student_id == m.id).delete()
            db.delete(m)
        for m in db.query(PrepLicense).filter(PrepLicense.license_key == TEST_LICENSE).all():
            db.delete(m)
        db.commit()
        db = Session()

        college = db.query(College).filter(College.name == "PSG Tech").first() or db.query(College).first()
        if not college.id:
            db.add(college); db.flush()

        from app.security.auth_utils import get_password_hash
        user = User(full_name="Java To Python Test", email=TEST_EMAIL, password_hash=get_password_hash("password123"), role="STUDENT", college_id=college.id)
        db.add(user); db.flush()
        comp = PlacementCompany(company_name=COMPANY, role=ROLE, college_id=college.id, job_description="Python Backend Developer. Django or FastAPI. Python async, decorators, generators. SQLAlchemy ORM. Celery.", status="Active")
        db.add(comp); db.flush()
        db.add(PlacementApplication(company_id=comp.id, student_id=user.id, status="APPROVED")); db.flush()

        student = Student(email=TEST_EMAIL, full_name="Java To Python Test", hashed_password=get_password_hash("password123"))
        db.add(student); db.flush()
        profile = StudentProfile(
            student_id=student.id, primary_skill="Java",
            known_skills=[
                {"skill": "Java", "proficiency": "Advanced"},
                {"skill": "Spring Boot", "proficiency": "Advanced"},
                {"skill": "SQL", "proficiency": "Intermediate"},
                {"skill": "Docker", "proficiency": "Intermediate"},
                {"skill": "Python", "proficiency": "Beginner"},
                {"skill": "REST APIs", "proficiency": "Advanced"},
            ],
            support_mode="Adaptive", tone="Direct", coding_required=True,
        )
        db.add(profile); db.flush()
        resume = Resume(student_id=student.id, file_path="s3_resume.pdf", raw_text="Java Backend Engineer pivoting to Python.")
        db.add(resume); db.flush()
        db.add_all([
            ResumeSection(resume_id=resume.id, section_type="experience", content="Java Backend Engineer, Enterprise Ltd (2020-2025)\n- Spring Boot REST APIs\n- PostgreSQL\n- Personal project: FastAPI todo app"),
            ResumeSection(resume_id=resume.id, section_type="skills", content="Languages: Java (Advanced), Python (Beginner)\nFrameworks: Spring Boot\nDB: PostgreSQL"),
        ]); db.flush()
        target = TargetInterview(student_id=student.id, company_name=COMPANY, role=ROLE, jd_text="Python Backend Developer. Django/FastAPI. asyncio. decorators. SQLAlchemy. Celery.", difficulty="medium", round_structure="Phone Screen → Python Coding → System Design → Behavioral")
        db.add(target); db.flush()
        gap = ResumeGapAnalysis(student_id=student.id, target_id=target.id, resume_id=resume.id, ats_score=55.0, keyword_score=48.0, missing_skills=["Python", "Django or FastAPI", "Python async (asyncio)", "SQLAlchemy ORM", "Celery"])
        db.add(gap); db.flush()
        lic = PrepLicense(license_key=TEST_LICENSE, student_id=student.id, company_name=COMPANY, role=ROLE, interview_date=datetime.now().date() + timedelta(days=12), status="active")
        db.add(lic); db.commit()
        print(f"\nSCENARIO 3 SETUP COMPLETE\n  Email: {TEST_EMAIL}\n  License: {TEST_LICENSE}\n  Company: {COMPANY} | Role: {ROLE}")
        print("  EXPECTED: Python-native questions + 'If from Java:' bridging Day 1-2 only")
        return True
    except Exception as e:
        print(f"ERROR: {e}"); import traceback; traceback.print_exc(); db.rollback(); return False
    finally:
        db.close()

if __name__ == "__main__":
    sys.exit(0 if run() else 1)
