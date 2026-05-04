"""
SCENARIO 6: Backend Developer (Node.js) → Java Backend Developer (Enterprise Corp)
EMAIL:    backend_backend_test@example.com  |  PASSWORD: password123
LICENSE:  TEST-S6-BACK-JAVA-2026
EXPECTED: Plan recognizes transferable backend skills (REST, APIs, DBs, Docker).
          Focuses on Java-specific gaps: static typing, JVM, Spring, Maven.
          'If from Node.js:' bridging only in Day 1-2. Pure Java from Day 3.
          Should NOT rebuild REST/API fundamentals (already known).
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
    TEST_EMAIL = "backend_backend_test@example.com"
    TEST_LICENSE = "TEST-S6-BACK-JAVA-2026"
    COMPANY = "Enterprise Corp"
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
        user = User(full_name="Backend Backend Test", email=TEST_EMAIL, password_hash=get_password_hash("password123"), role="STUDENT", college_id=college.id)
        db.add(user); db.flush()
        comp = PlacementCompany(company_name=COMPANY, role=ROLE, college_id=college.id, job_description="Java Backend Developer — Enterprise Corp.\n- 3+ years backend development (any language)\n- Strong Java / Spring Boot preferred\n- Microservices, REST APIs, SQL\n- System design for enterprise scale\n- Docker, CI/CD, cloud deployment", status="Active")
        db.add(comp); db.flush()
        db.add(PlacementApplication(company_id=comp.id, student_id=user.id, status="APPROVED")); db.flush()

        student = Student(email=TEST_EMAIL, full_name="Backend Backend Test", hashed_password=get_password_hash("password123"))
        db.add(student); db.flush()
        profile = StudentProfile(
            student_id=student.id, primary_skill="Node.js",
            known_skills=[
                {"skill": "Node.js",    "proficiency": "Advanced"},
                {"skill": "JavaScript", "proficiency": "Advanced"},
                {"skill": "Express.js", "proficiency": "Advanced"},
                {"skill": "MongoDB",    "proficiency": "Intermediate"},
                {"skill": "PostgreSQL", "proficiency": "Intermediate"},
                {"skill": "Docker",     "proficiency": "Intermediate"},
                {"skill": "REST APIs",  "proficiency": "Advanced"},
                {"skill": "System Design", "proficiency": "Intermediate"},
                {"skill": "Java",       "proficiency": "Beginner"},
            ],
            support_mode="Adaptive", tone="Direct", coding_required=True,
        )
        db.add(profile); db.flush()
        resume = Resume(student_id=student.id, file_path="s6_resume.pdf", raw_text="Node.js Backend Engineer with 4 years experience building REST APIs and microservices.")
        db.add(resume); db.flush()
        db.add_all([
            ResumeSection(resume_id=resume.id, section_type="experience", content="Senior Node.js Engineer, CloudSoft (2021-2025)\n- Designed REST microservices with Express.js (50+ endpoints)\n- PostgreSQL + MongoDB database design\n- Docker + Kubernetes deployment\n- Message queues with RabbitMQ\n- Led team of 3 backend engineers\n\nBackend Developer, WebCo (2020-2021)\n- Node.js API for e-commerce platform\n- JWT auth, rate limiting, caching with Redis"),
            ResumeSection(resume_id=resume.id, section_type="skills", content="Languages: JavaScript/Node.js (Advanced), SQL, Java (beginner)\nFrameworks: Express.js, NestJS\nDatabases: PostgreSQL, MongoDB, Redis\nDevOps: Docker, Kubernetes, GitHub Actions\nConcepts: Microservices, REST, System Design, Message Queues"),
        ]); db.flush()
        target = TargetInterview(student_id=student.id, company_name=COMPANY, role=ROLE, jd_text="Java Backend Developer at Enterprise Corp.\nRequired: Spring Boot, Spring Data JPA, Maven, REST APIs.\nStrong OOP and Java type system knowledge.\nMicroservices and system design experience.\nKafka or message queue experience a plus.", difficulty="hard", round_structure="Online Assessment → Technical (Java Coding + System Design) → Behavioral")
        db.add(target); db.flush()
        gap = ResumeGapAnalysis(student_id=student.id, target_id=target.id, resume_id=resume.id, ats_score=62.0, keyword_score=55.0, missing_skills=["Java (language fundamentals)", "Spring Boot", "Spring Data JPA", "Maven build tool", "Java type system and OOP", "Kafka / Event-driven in Java"])
        db.add(gap); db.flush()
        lic = PrepLicense(license_key=TEST_LICENSE, student_id=student.id, company_name=COMPANY, role=ROLE, interview_date=datetime.now().date() + timedelta(days=12), status="active")
        db.add(lic); db.commit()
        print(f"\nSCENARIO 6 SETUP COMPLETE\n  Email: {TEST_EMAIL}\n  License: {TEST_LICENSE}\n  Company: {COMPANY} | Role: {ROLE}")
        print("  EXPECTED: Plan leverages Node.js backend knowledge. 'If from Node.js:' bridging Day 1-2 only.")
        print("  Plan should NOT rebuild REST/API basics. Focus: Java type system, Spring Boot, Maven, JPA.")
        return True
    except Exception as e:
        print(f"ERROR: {e}"); import traceback; traceback.print_exc(); db.rollback(); return False
    finally:
        db.close()

if __name__ == "__main__":
    sys.exit(0 if run() else 1)
