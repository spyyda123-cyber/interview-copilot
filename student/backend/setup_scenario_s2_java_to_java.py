"""
SCENARIO 2: Java Developer → Java Backend Developer

STUDENT: Senior Java developer, 4 years experience
PRIMARY SKILL: Java (Advanced)
KNOWN SKILLS: Java, Spring Boot, JPA, SQL, Docker
TARGET: Java Backend Developer at TCS
EXPECTED: Pure Java plan — depth, polish, zero Python/JS comparisons

USAGE:
    python setup_scenario_s2_java_to_java.py

LOGIN:
    Email:       java_dev_test@example.com
    Password:    password123
    License Key: TEST-S2-JAVA-JAVA-2026
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import (
    Student, StudentProfile, TargetInterview,
    Resume, ResumeSection, ResumeGapAnalysis,
    PrepLicense, User, College, StudentActivityLog,
    InterviewFeedback, Marksheet,
)
from shared.models.placement import PlacementCompany, PlacementApplication
from shared.config import settings


def create_test_student():
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        print("\n" + "="*70)
        print("SCENARIO 2: Java Developer → Java Backend Developer (TCS)")
        print("="*70 + "\n")

        TEST_EMAIL   = "java_dev_test@example.com"
        TEST_LICENSE = "TEST-S2-JAVA-JAVA-2026"
        COMPANY      = "TCS"
        ROLE         = "Java Backend Developer"

        # ── Cleanup ────────────────────────────────────────────────
        existing = db.query(Student).filter(Student.email == TEST_EMAIL).first()
        if existing:
            db.query(InterviewFeedback).filter(InterviewFeedback.student_id == existing.id).delete()
            db.query(Marksheet).filter(Marksheet.student_id == existing.id).delete()
            db.delete(existing)

        existing_user = db.query(User).filter(User.email == TEST_EMAIL).first()
        if existing_user:
            db.query(PlacementApplication).filter(PlacementApplication.student_id == existing_user.id).delete()
            db.query(StudentActivityLog).filter(StudentActivityLog.student_id == existing_user.id).delete()
            db.delete(existing_user)

        existing_lic = db.query(PrepLicense).filter(PrepLicense.license_key == TEST_LICENSE).first()
        if existing_lic:
            db.delete(existing_lic)

        db.commit()
        db = Session()

        # ── College ────────────────────────────────────────────────
        college = db.query(College).filter(College.name == "PSG Tech").first() or db.query(College).first()
        if not college:
            college = College(name="Test College")
            db.add(college)
            db.flush()

        from app.security.auth_utils import get_password_hash

        # ── User & Placement ───────────────────────────────────────
        user = User(
            full_name="Java Developer Test",
            email=TEST_EMAIL,
            password_hash=get_password_hash("password123"),
            role="STUDENT",
            college_id=college.id,
        )
        db.add(user)
        db.flush()

        comp = PlacementCompany(
            company_name=COMPANY,
            role=ROLE,
            college_id=college.id,
            job_description=(
                "Senior Java Backend Developer\n"
                "- 4+ years Java development experience\n"
                "- Expertise in Spring Boot, Spring Security, Spring Data JPA\n"
                "- Strong DSA skills (LeetCode medium-hard)\n"
                "- Microservices architecture and system design\n"
                "- SQL optimization, transaction management\n"
                "- Knowledge of Kafka or message queues\n"
                "- Docker and CI/CD pipelines"
            ),
            status="Active",
        )
        db.add(comp)
        db.flush()

        app = PlacementApplication(company_id=comp.id, student_id=user.id, status="APPROVED")
        db.add(app)
        db.flush()

        # ── Student ────────────────────────────────────────────────
        student = Student(
            email=TEST_EMAIL,
            full_name="Java Developer Test",
            hashed_password=get_password_hash("password123"),
        )
        db.add(student)
        db.flush()

        # ── Profile — Advanced Java ────────────────────────────────
        profile = StudentProfile(
            student_id=student.id,
            primary_skill="Java",
            known_skills=[
                {"skill": "Java",          "proficiency": "Advanced"},
                {"skill": "Spring Boot",   "proficiency": "Advanced"},
                {"skill": "Spring Data JPA","proficiency": "Intermediate"},
                {"skill": "SQL",           "proficiency": "Intermediate"},
                {"skill": "Docker",        "proficiency": "Intermediate"},
                {"skill": "REST APIs",     "proficiency": "Advanced"},
                {"skill": "Git",           "proficiency": "Advanced"},
                {"skill": "Maven",         "proficiency": "Intermediate"},
            ],
            support_mode="Adaptive",
            tone="Direct",
            coding_required=True,
        )
        db.add(profile)
        db.flush()

        # ── Resume ─────────────────────────────────────────────────
        resume = Resume(
            student_id=student.id,
            file_path="java_dev_test_resume.pdf",
            raw_text="Senior Java Backend Engineer with 4 years building enterprise Spring Boot applications.",
        )
        db.add(resume)
        db.flush()

        sections = [
            ResumeSection(
                resume_id=resume.id,
                section_type="experience",
                content=(
                    "Senior Java Engineer, FinCorp (2021-2025)\n"
                    "- Designed REST APIs using Spring Boot serving 500k daily requests\n"
                    "- Migrated monolith to microservices (Spring Cloud, Eureka, API Gateway)\n"
                    "- Optimized JPA queries reducing DB load by 40%\n"
                    "- Implemented Spring Security with JWT + OAuth2\n\n"
                    "Java Developer, TechSystems (2020-2021)\n"
                    "- Built batch processing pipelines using Spring Batch\n"
                    "- Wrote unit/integration tests (JUnit 5, Mockito)\n"
                    "- Set up Docker Compose for local dev environments"
                ),
            ),
            ResumeSection(
                resume_id=resume.id,
                section_type="skills",
                content=(
                    "Languages: Java 17, SQL, Bash\n"
                    "Frameworks: Spring Boot, Spring MVC, Spring Security, Spring Data JPA\n"
                    "Databases: PostgreSQL, MySQL, Redis\n"
                    "DevOps: Docker, Maven, GitHub Actions\n"
                    "Concepts: Microservices, REST, OOP, SOLID, Design Patterns"
                ),
            ),
        ]
        db.add_all(sections)
        db.flush()

        # ── Target Interview ───────────────────────────────────────
        target = TargetInterview(
            student_id=student.id,
            company_name=COMPANY,
            role=ROLE,
            jd_text=(
                "TCS Java Backend Developer\n"
                "- Expert-level Java and Spring Boot\n"
                "- Microservices, REST APIs, database optimization\n"
                "- System design and scalability\n"
                "- Kafka / message queues experience preferred\n"
                "- DSA: medium to hard LeetCode"
            ),
            difficulty="hard",
            round_structure="Online Assessment → Technical (Coding + System Design) → Behavioral",
        )
        db.add(target)
        db.flush()

        # ── Gap Analysis — Polish gaps, no language gap ────────────
        gap = ResumeGapAnalysis(
            student_id=student.id,
            target_id=target.id,
            resume_id=resume.id,
            ats_score=88.0,
            keyword_score=82.0,
            missing_skills=[
                "Kafka / Message Queues",
                "Kubernetes basics",
                "Advanced DSA (DP, Graphs)",
                "System Design at scale (10M+ users)",
            ],
        )
        db.add(gap)
        db.flush()

        # ── License ────────────────────────────────────────────────
        interview_date = datetime.now().date() + timedelta(days=10)
        lic = PrepLicense(
            license_key=TEST_LICENSE,
            student_id=student.id,
            company_name=COMPANY,
            role=ROLE,
            interview_date=interview_date,
            status="active",
        )
        db.add(lic)
        db.commit()

        print("TEST SETUP COMPLETE — Scenario 2")
        print(f"  Email:       {TEST_EMAIL}")
        print(f"  Password:    password123")
        print(f"  License Key: {TEST_LICENSE}")
        print(f"  Company:     {COMPANY}")
        print(f"  Role:        {ROLE}")
        print(f"\nEXPECTED: Pure Java plan — NO Python/JS comparisons anywhere\n")
        return True

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback; traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(0 if create_test_student() else 1)
