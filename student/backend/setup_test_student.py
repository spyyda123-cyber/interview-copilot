"""
Set up test student for Python→Java transition scenario.

SCENARIO:
- Student: Python developer with 5 years backend experience
- Primary Skill: Python (Django, FastAPI)
- Target Role: Java Backend Developer (Spring Boot)
- Timeline: 14 days until interview
- Difficulty: Hard
- Missing Skills: Spring Boot, Maven/Gradle, Microservices, etc.

EXPECTED PLAN:
- Day 1-2: Spring Boot fundamentals (CRITICAL)
- Day 3: Microservices architecture
- Day 4: System design with Java patterns
- Day 5: Behavioral + mock interview

USAGE:
    python setup_test_student.py

OUTPUT:
    ✅ Test setup complete
    Email: python_dev_test@example.com
    Student ID: <auto-assigned>
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add project root to Python path to allow imports from 'shared'
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import (
    Student, 
    StudentProfile, 
    TargetInterview, 
    Resume, 
    ResumeSection, 
    ResumeGapAnalysis, 
    PrepLicense,
    User,
    College,
    StudentActivityLog,
    InterviewFeedback,
    Marksheet,
)
from shared.models.placement import PlacementCompany, PlacementApplication
from shared.config import settings


def create_test_student():
    """Create complete test setup for Python→Java scenario."""
    
    # Create database session
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        print("\n" + "="*70)
        print("INTERVIEW COPILOT - TEST SETUP: PYTHON-TO-JAVA TRANSITION")
        print("="*70 + "\n")
        
        # ----------------------------------------------------------
        # PRE-STEP: Clean up existing test data (Idempotency)
        # ----------------------------------------------------------
        test_email = "python_dev_test@example.com"
        test_license = "TEST-JAVA-PLAN-2026"
        
        # Delete existing student (cascades to profile, resumes, etc.)
        existing_student = db.query(Student).filter(Student.email == test_email).first()
        if existing_student:
            # Delete records linked by Integer student_id
            db.query(InterviewFeedback).filter(InterviewFeedback.student_id == existing_student.id).delete()
            db.query(Marksheet).filter(Marksheet.student_id == existing_student.id).delete()
            db.delete(existing_student)
            print(f"Removed existing student: {test_email}")
            
        # Delete existing user
        existing_user = db.query(User).filter(User.email == test_email).first()
        if existing_user:
            # First delete related records to satisfy foreign keys
            db.query(PlacementApplication).filter(PlacementApplication.student_id == existing_user.id).delete()
            db.query(StudentActivityLog).filter(StudentActivityLog.student_id == existing_user.id).delete()
            db.delete(existing_user)
            print(f"Removed existing user: {test_email}")

        # Delete existing placement company for this test
        existing_comp = db.query(PlacementCompany).filter(PlacementCompany.company_name == "Tech Startup").first()
        if existing_comp:
            db.delete(existing_comp)
            print(f"Removed existing placement company: Tech Startup")
            
        # Delete existing license
        existing_license = db.query(PrepLicense).filter(PrepLicense.license_key == test_license).first()
        if existing_license:
            db.delete(existing_license)
            print(f"Removed existing license: {test_license}")
            
        db.commit()
        db = Session() # Re-open session after commit
        
        # ----------------------------------------------------------
        # STEP 0: Create User and Placement (for IL visibility)
        # ----------------------------------------------------------
        college = db.query(College).filter(College.name == "PSG Tech").first() or db.query(College).first()
        if not college:
            college = College(name="Test College")
            db.add(college)
            db.flush()

        from app.security.auth_utils import get_password_hash
        
        user = User(
            full_name="Python Developer Test",
            email=test_email,
            password_hash=get_password_hash("password123"),
            role="STUDENT",
            college_id=college.id
        )
        db.add(user)
        db.flush()

        comp = PlacementCompany(
            company_name="Tech Startup",
            role="Java Backend Developer",
            college_id=college.id,
            job_description=(
                "We are looking for a Java Backend Developer with:\n"
                "- 3+ years backend development experience (Java/Spring preferred)\n"
                "- Strong understanding of Spring Boot and microservices"
            ),
            status="Active"
        )
        db.add(comp)
        db.flush()

        app = PlacementApplication(
            company_id=comp.id,
            student_id=user.id,
            status="APPROVED"
        )
        db.add(app)
        db.flush()
        
        print(f"Created User and Placement Application (APPROVED)")
        
        # ----------------------------------------------------------
        # STEP 1: Create Student
        # ----------------------------------------------------------
        from app.security.auth_utils import get_password_hash
        
        student = Student(
            email="python_dev_test@example.com",
            full_name="Python Developer Test",
            hashed_password=get_password_hash("password123"),
        )
        db.add(student)
        db.flush()
        
        print(f"Created Student")
        print(f"  Email: {student.email}")
        print(f"  Full Name: {student.full_name}")
        print(f"  ID: {student.id}\n")
        
        # ----------------------------------------------------------
        # STEP 2: Create Student Profile (5-year Python developer)
        # ----------------------------------------------------------
        profile = StudentProfile(
            student_id=student.id,
            primary_skill="Python",
            known_skills=[
                "Python",
                "Django",
                "FastAPI",
                "PostgreSQL",
                "Docker",
                "AWS",
                "SQL",
                "REST APIs",
                "Linux",
                "Git",
            ],
            support_mode="Adaptive",
            tone="Direct",
            coding_required=True,
        )
        db.add(profile)
        db.flush()
        
        print(f"Created Student Profile")
        print(f"  Primary Skill: {profile.primary_skill}")
        print(f"  Known Skills: {', '.join(profile.known_skills[:5])}... (+5 more)\n")
        
        # ----------------------------------------------------------
        # STEP 3: Create Resume with Sections
        # ----------------------------------------------------------
        resume = Resume(
            student_id=student.id,
            file_path="python_dev_test_resume.pdf",
            raw_text="Python Backend Developer with 5 years experience in designing and building scalable APIs.",
        )
        db.add(resume)
        db.flush()
        
        sections = [
            ResumeSection(
                resume_id=resume.id,
                section_type="experience",
                content=(
                    "Senior Backend Engineer, TechCorp (2020-2025)\n"
                    "- Led Python microservices architecture migration (15% latency reduction)\n"
                    "- Managed PostgreSQL databases at scale (50GB+ data)\n"
                    "- Designed and deployed FastAPI services on AWS (EC2, RDS)\n"
                    "- Implemented Celery task queues for async processing\n\n"
                    "Backend Developer, StartupXYZ (2019-2020)\n"
                    "- Built Django REST API serving 100k+ daily users\n"
                    "- Optimized database queries (N+1 problem fixes)\n"
                    "- Set up Docker and container orchestration"
                )
            ),
            ResumeSection(
                resume_id=resume.id,
                section_type="skills",
                content=(
                    "Languages: Python, SQL, Bash, JavaScript\n"
                    "Frameworks: Django, FastAPI, Flask\n"
                    "Databases: PostgreSQL, Redis, MongoDB\n"
                    "DevOps: Docker, AWS (EC2, RDS, S3), Linux\n"
                    "Tools: Git, CI/CD, Celery, RabbitMQ\n"
                    "Concepts: REST APIs, Microservices, System Design, Database Optimization"
                )
            ),
        ]
        db.add_all(sections)
        db.flush()
        
        print(f"Created Resume with {len(sections)} sections")
        
        # ----------------------------------------------------------
        # STEP 4: Create Target Interview
        # (Java Backend Developer at Tech Startup, 14 days away)
        # ----------------------------------------------------------
        target = TargetInterview(
            student_id=student.id,
            company_name="Tech Startup",
            role="Java Backend Developer",
            jd_text=(
                "We are looking for a Java Backend Developer with:\n"
                "- 3+ years backend development experience (Java/Spring preferred)\n"
                "- Strong understanding of Spring Boot and microservices\n"
                "- Experience with RESTful APIs and system design\n"
                "- Knowledge of Maven/Gradle build tools\n"
                "- Familiarity with Docker and cloud deployment\n"
                "- SQL and database optimization\n\n"
                "Nice to have:\n"
                "- Kubernetes experience\n"
                "- Event-driven architecture (Kafka, RabbitMQ)\n"
                "- AWS or cloud platform experience"
            ),
            difficulty="hard",
            round_structure="Screening -> Technical (Coding + System Design) -> Behavioral",
        )
        db.add(target)
        db.flush()
        
        print(f"Created Target Interview")
        print(f"  Company: {target.company_name}")
        print(f"  Role: {target.role}")
        
        # ----------------------------------------------------------
        # STEP 5: Create Resume Gap Analysis
        # (Missing Java/Spring skills, transferable Python skills)
        # ----------------------------------------------------------
        gap = ResumeGapAnalysis(
            student_id=student.id,
            target_id=target.id,
            resume_id=resume.id,
            ats_score=72.0,
            keyword_score=65.0,
            missing_skills=[
                "Spring Boot Framework",
                "Maven/Gradle Build Tools",
                "Microservices Architecture (Spring Cloud)",
                "Spring Data JPA & Hibernate",
                "Dependency Injection (Spring DI)",
                "Spring MVC & REST Controllers",
                "Java Concurrency (Threads, Locks)",
                "Kafka or Event-Driven Architecture",
            ],
        )
        db.add(gap)
        db.flush()
        
        print(f"Created Resume Gap Analysis")
        
        # ----------------------------------------------------------
        # STEP 6: Create Prep License (Active for 14 days)
        # ----------------------------------------------------------
        interview_date = datetime.now().date() + timedelta(days=14)
        license_obj = PrepLicense(
            license_key="TEST-JAVA-PLAN-2026",
            student_id=student.id,
            company_name=target.company_name,
            role=target.role,
            interview_date=interview_date,
            status="active",
        )
        db.add(license_obj)
        db.commit()
        
        print(f"Created Prep License")
        print(f"  License Key: {license_obj.license_key}")
        print(f"  Status: ACTIVE")
        print(f"  Expires: {license_obj.interview_date}\n")
        
        # ----------------------------------------------------------
        # SUCCESS SUMMARY
        # ----------------------------------------------------------
        print("="*70)
        print("TEST SETUP COMPLETE")
        print("="*70)
        print(f"\nTest Student Details:")
        print(f"  Email: {student.email}")
        print(f"  Full Name: {student.full_name}")
        print(f"  Student ID: {student.id}")
        print(f"  License Key: {license_obj.license_key}")
        print(f"\nScenario: Python Developer -> Java Developer")
        print(f"\nNext Steps:")
        print(f"  1. Open http://localhost:3000")
        print(f"  2. Login with email: {student.email}")
        print(f"  3. Use License Key: {license_obj.license_key}")
        print(f"  4. Activate study plan for {target.role}")
        print(f"\n" + "="*70 + "\n")
        
        return True
        
    except Exception as e:
        print(f"\nERROR during setup: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = create_test_student()
    sys.exit(0 if success else 1)
