"""
SCENARIO 5: Frontend Developer (React/JS) → Java Backend Developer (FinTech Corp)
EMAIL:    frontend_dev_test@example.com  |  PASSWORD: password123
LICENSE:  TEST-S5-FRONT-BACK-2026
EXPECTED: Java-native questions + 'If from JavaScript:' bridging Day 1-2.
          Key paradigm shifts: server-side, no DOM, HTTP from server perspective.
          Pure Java from Day 3.
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
    TEST_EMAIL = "frontend_dev_test@example.com"
    TEST_LICENSE = "TEST-S5-FRONT-BACK-2026"
    COMPANY = "FinTech Corp"
    ROLE = "Java Backend Developer"
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
        user = User(full_name="Frontend Dev Test", email=TEST_EMAIL, password_hash=get_password_hash("password123"), role="STUDENT", college_id=college.id)
        db.add(user); db.flush()
        comp = PlacementCompany(company_name=COMPANY, role=ROLE, college_id=college.id, job_description="Java Backend Developer (FinTech).\n- 2+ years Java/Spring Boot\n- RESTful API design\n- SQL and JPA\n- System design basics\n- Understanding of HTTP and distributed systems", status="Active")
        db.add(comp); db.flush()
        db.add(PlacementApplication(company_id=comp.id, student_id=user.id, status="APPROVED")); db.flush()

        student = Student(email=TEST_EMAIL, full_name="Frontend Dev Test", hashed_password=get_password_hash("password123"))
        db.add(student); db.flush()
        profile = StudentProfile(
            student_id=student.id, primary_skill="JavaScript",
            known_skills=[
                {"skill": "JavaScript", "proficiency": "Advanced"},
                {"skill": "React", "proficiency": "Advanced"},
                {"skill": "TypeScript", "proficiency": "Intermediate"},
                {"skill": "HTML/CSS", "proficiency": "Advanced"},
                {"skill": "Node.js", "proficiency": "Intermediate"},
                {"skill": "REST APIs", "proficiency": "Intermediate"},
                {"skill": "Git", "proficiency": "Advanced"},
                {"skill": "Java", "proficiency": "Beginner"},
            ],
            support_mode="Guided coaching", tone="Supportive", coding_required=True,
        )
        db.add(profile); db.flush()
        resume = Resume(student_id=student.id, file_path="s5_resume.pdf", raw_text="Frontend Developer with 3 years React/TypeScript experience, transitioning to backend Java.")
        db.add(resume); db.flush()
        db.add_all([
            ResumeSection(resume_id=resume.id, section_type="experience", content="Frontend Engineer, WebAgency (2022-2025)\n- React + TypeScript SPA with REST API integration\n- Node.js Express backend (simple CRUD)\n- State management with Redux\n- GitHub Actions CI/CD\n- Started learning Java Spring Boot (personal project)"),
            ResumeSection(resume_id=resume.id, section_type="skills", content="Languages: JavaScript (Advanced), TypeScript, HTML/CSS, Java (beginner)\nFrameworks: React, Redux, Express.js\nTools: Webpack, Vite, Git\nConcepts: REST API consumption, async/await, Promises"),
        ]); db.flush()
        target = TargetInterview(student_id=student.id, company_name=COMPANY, role=ROLE, jd_text="Java Backend Developer at FinTech Corp.\nRequired: Spring Boot, REST APIs, JPA, SQL.\nNice to have: Docker, system design, message queues.\nMust understand server-side request lifecycle and OOP.", difficulty="medium", round_structure="Technical Screen (Java coding) → System Design → Behavioral")
        db.add(target); db.flush()
        gap = ResumeGapAnalysis(student_id=student.id, target_id=target.id, resume_id=resume.id, ats_score=45.0, keyword_score=40.0, missing_skills=["Java (language fundamentals)", "Spring Boot", "Spring Data JPA", "Server-side architecture", "SQL optimization", "System design", "OOP principles in Java"])
        db.add(gap); db.flush()
        lic = PrepLicense(license_key=TEST_LICENSE, student_id=student.id, company_name=COMPANY, role=ROLE, interview_date=datetime.now().date() + timedelta(days=14), status="active")
        db.add(lic); db.commit()
        print(f"\nSCENARIO 5 SETUP COMPLETE\n  Email: {TEST_EMAIL}\n  License: {TEST_LICENSE}\n  Company: {COMPANY} | Role: {ROLE}")
        print("  EXPECTED: Java-native questions + 'If from JavaScript:' bridging Day 1-2. Pure Java Day 3+.")
        return True
    except Exception as e:
        print(f"ERROR: {e}"); import traceback; traceback.print_exc(); db.rollback(); return False
    finally:
        db.close()

if __name__ == "__main__":
    sys.exit(0 if run() else 1)
