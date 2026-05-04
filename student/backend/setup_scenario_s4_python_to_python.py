"""
SCENARIO 4: Python Developer → Python Backend Developer (DataStartup)
EMAIL:    python_python_test@example.com  |  PASSWORD: password123
LICENSE:  TEST-S4-PYTHON-PYTHON-2026
EXPECTED: Pure Python plan — ZERO Java/JS comparisons. Depth on asyncio, Django, FastAPI, decorators.
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
    TEST_EMAIL = "python_python_test@example.com"
    TEST_LICENSE = "TEST-S4-PYTHON-PYTHON-2026"
    COMPANY = "DataStartup"
    ROLE = "Python Backend Developer"
    try:
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
        if not college:
            college = College(name="Test College"); db.add(college); db.flush()

        from app.security.auth_utils import get_password_hash
        user = User(full_name="Python Python Test", email=TEST_EMAIL, password_hash=get_password_hash("password123"), role="STUDENT", college_id=college.id)
        db.add(user); db.flush()
        comp = PlacementCompany(company_name=COMPANY, role=ROLE, college_id=college.id, job_description="Python Backend Developer. FastAPI preferred. asyncio, Celery, Redis, SQLAlchemy, PostgreSQL. Clean code and testing required.", status="Active")
        db.add(comp); db.flush()
        db.add(PlacementApplication(company_id=comp.id, student_id=user.id, status="APPROVED")); db.flush()

        student = Student(email=TEST_EMAIL, full_name="Python Python Test", hashed_password=get_password_hash("password123"))
        db.add(student); db.flush()
        profile = StudentProfile(
            student_id=student.id, primary_skill="Python",
            known_skills=[
                {"skill": "Python", "proficiency": "Advanced"},
                {"skill": "Django", "proficiency": "Intermediate"},
                {"skill": "SQL", "proficiency": "Intermediate"},
                {"skill": "Docker", "proficiency": "Intermediate"},
                {"skill": "FastAPI", "proficiency": "Beginner"},
                {"skill": "REST APIs", "proficiency": "Advanced"},
                {"skill": "Git", "proficiency": "Advanced"},
            ],
            support_mode="Guided coaching", tone="Supportive", coding_required=True,
        )
        db.add(profile); db.flush()
        resume = Resume(student_id=student.id, file_path="s4_resume.pdf", raw_text="Python Backend Developer with 3 years Django/FastAPI experience.")
        db.add(resume); db.flush()
        db.add_all([
            ResumeSection(resume_id=resume.id, section_type="experience", content="Python Backend Dev, WebCo (2022-2025)\n- Django REST framework APIs for 200k users\n- PostgreSQL optimization\n- Docker deployment\n- Started using FastAPI for a new microservice"),
            ResumeSection(resume_id=resume.id, section_type="skills", content="Languages: Python, SQL\nFrameworks: Django, FastAPI (learning)\nDB: PostgreSQL, Redis\nTools: Docker, Celery, Git"),
        ]); db.flush()
        target = TargetInterview(student_id=student.id, company_name=COMPANY, role=ROLE, jd_text="FastAPI Python Backend. asyncio. Celery + Redis. SQLAlchemy. pytest. Clean architecture. PostgreSQL.", difficulty="medium", round_structure="Technical (Python coding) → System Design → Behavioral")
        db.add(target); db.flush()
        gap = ResumeGapAnalysis(student_id=student.id, target_id=target.id, resume_id=resume.id, ats_score=78.0, keyword_score=70.0, missing_skills=["FastAPI advanced patterns", "Python asyncio (async/await)", "pytest and TDD", "Redis caching patterns", "Clean architecture"])
        db.add(gap); db.flush()
        lic = PrepLicense(license_key=TEST_LICENSE, student_id=student.id, company_name=COMPANY, role=ROLE, interview_date=datetime.now().date() + timedelta(days=10), status="active")
        db.add(lic); db.commit()
        print(f"\nSCENARIO 4 SETUP COMPLETE\n  Email: {TEST_EMAIL}\n  License: {TEST_LICENSE}\n  Company: {COMPANY} | Role: {ROLE}")
        print("  EXPECTED: Pure Python plan — ZERO Java comparisons. FastAPI/asyncio depth.")
        return True
    except Exception as e:
        print(f"ERROR: {e}"); import traceback; traceback.print_exc(); db.rollback(); return False
    finally:
        db.close()

if __name__ == "__main__":
    sys.exit(0 if run() else 1)
