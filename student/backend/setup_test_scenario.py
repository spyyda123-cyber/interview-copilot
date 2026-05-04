#!/usr/bin/env python
"""
Automated Test Setup: Python Developer → Java Developer Study Plan Test

Usage:
  python setup_test_scenario.py

This script sets up a complete test scenario in the database:
- Test student with Python skills (5 years experience)
- Target: Java Backend Developer role at Tech Startup
- Resume with Python backend experience
- Gap analysis showing Java as missing
- PrepLicense for study plan activation
"""

import sys
import os
from datetime import datetime, timedelta

# Setup paths
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.chdir(backend_dir)

from app.db.session import SessionLocal
from app.models import (
    Student, StudentProfile, PrepLicense, TargetInterview,
    Resume, ResumeSection, ResumeGapAnalysis
)

def setup_test_scenario():
    """Setup complete test scenario."""
    db = SessionLocal()
    
    try:
        print("\n" + "="*70)
        print("SETTING UP TEST SCENARIO: Python Developer → Java Developer")
        print("="*70 + "\n")
        
        # ===== STEP 1: Create Student =====
        print("[1/6] Creating test student...")
        student_email = "python_dev_test@example.com"
        student = db.query(Student).filter_by(email=student_email).first()
        
        if student:
            print(f"      ✓ Found existing student (ID: {student.id})")
            # Clean up old data
            db.query(ResumeGapAnalysis).filter_by(student_id=student.id).delete()
            db.query(ResumeSection).filter_by(resume_id=db.query(Resume).filter_by(student_id=student.id).first().id if db.query(Resume).filter_by(student_id=student.id).first() else None).delete()
            db.query(Resume).filter_by(student_id=student.id).delete()
            db.query(TargetInterview).filter_by(student_id=student.id).delete()
            db.query(PrepLicense).filter_by(student_id=student.id).delete()
            db.commit()
        else:
            student = Student(
                email=student_email,
                name="Python Developer",
                phone="9999999999"
            )
            db.add(student)
            db.commit()
            print(f"      ✓ Created new student (ID: {student.id})")
        
        student_id = student.id
        
        # ===== STEP 2: Create Student Profile with Python Skills =====
        print("[2/6] Setting up Python skills profile...")
        profile = db.query(StudentProfile).filter_by(student_id=student_id).first()
        if not profile:
            profile = StudentProfile(student_id=student_id)
            db.add(profile)
            db.commit()
        
        profile.primary_skill = "Python"
        profile.known_skills = [
            {"skill": "Python", "proficiency": "Advanced", "years": 5},
            {"skill": "Django", "proficiency": "Advanced", "years": 4},
            {"skill": "FastAPI", "proficiency": "Intermediate", "years": 2},
            {"skill": "REST APIs", "proficiency": "Intermediate", "years": 3},
            {"skill": "Docker", "proficiency": "Intermediate", "years": 2},
            {"skill": "PostgreSQL", "proficiency": "Intermediate", "years": 3},
            {"skill": "Linux", "proficiency": "Intermediate", "years": 3},
            {"skill": "Git", "proficiency": "Advanced", "years": 5},
            {"skill": "AWS", "proficiency": "Beginner", "years": 1},
        ]
        profile.education_level = "Bachelor's in Computer Science"
        profile.years_of_experience = 5
        profile.support_mode = "Guided coaching"
        profile.tone = "Direct and practical"
        db.commit()
        print(f"      ✓ Profile updated with 9 Python-based skills")
        
        # ===== STEP 3: Create Resume =====
        print("[3/6] Creating resume with Python experience...")
        resume = db.query(Resume).filter_by(student_id=student_id).first()
        if resume:
            db.query(ResumeSection).filter_by(resume_id=resume.id).delete()
        else:
            resume = Resume(
                student_id=student_id,
                file_path="s3://bucket/resume_python_dev.pdf",
                file_name="resume_python_dev.pdf"
            )
            db.add(resume)
            db.commit()
        
        sections = [
            ResumeSection(
                resume_id=resume.id,
                section_type="experience",
                content="""Senior Python Backend Developer at TechCorp (2023-2025)
- Architected and deployed microservices using FastAPI and Django
- Led team of 3 developers on real-time data processing platform
- Designed and optimized PostgreSQL databases handling 100K+ daily queries
- Implemented Docker containerization for local development and CI/CD
- Managed AWS EC2 instances and S3 for scalable data storage

Python Developer at StartupXYZ (2021-2023)
- Built REST APIs using Django and Django REST Framework
- Implemented authentication, authorization, and security best practices
- Wrote 80+ unit tests with pytest achieving 85% code coverage
- Participated in agile development with sprint-based delivery"""
            ),
            ResumeSection(
                resume_id=resume.id,
                section_type="skills",
                content="""Languages: Python (Expert), SQL, Bash, Git
Frameworks: Django, FastAPI, Django REST Framework
Databases: PostgreSQL, MongoDB, Redis
Tools: Docker, Docker Compose, Git, Linux, AWS (S3, EC2)
Testing: pytest, unittest, Postman
Soft Skills: Team Leadership, Agile (Scrum), Problem Solving, Communication"""
            ),
            ResumeSection(
                resume_id=resume.id,
                section_type="education",
                content="B.Tech Computer Science from ABC University (2019) - GPA: 3.8/4.0"
            ),
            ResumeSection(
                resume_id=resume.id,
                section_type="projects",
                content="""Real-time Data Pipeline (Python, FastAPI, PostgreSQL, Docker)
- Processed 1M+ events per day with <100ms latency
- Implemented event deduplication and aggregation logic

E-commerce API Backend (Django, DRF, PostgreSQL)
- REST API serving 10K+ daily active users
- Designed 40+ endpoints for product catalog, orders, payments"""
            ),
        ]
        db.add_all(sections)
        db.commit()
        print(f"      ✓ Resume created with 4 sections (Experience, Skills, Education, Projects)")
        
        # ===== STEP 4: Create Target Interview (Java Developer Role) =====
        print("[4/6] Creating Java Backend Developer target...")
        interview_date = datetime.now() + timedelta(days=14)
        target = TargetInterview(
            student_id=student_id,
            company_name="Tech Startup",
            role="Java Backend Developer",
            jd_text="""Senior Java Backend Developer (3-5 years)

Required Technical Skills:
- Expert Java programming (Java 8, 11, 17) with SOLID principles
- Spring Framework & Spring Boot 2.x/3.x for production applications
- Microservices architecture design and implementation
- RESTful API design, GraphQL basics
- JUnit 5, Mockito for comprehensive testing
- SQL & relational databases (PostgreSQL, MySQL)
- Message queues: Apache Kafka or RabbitMQ
- Docker containerization & Kubernetes orchestration basics
- Git version control and CI/CD pipelines
- Design patterns: Factory, Strategy, Observer, Singleton

Nice to Have:
- Cloud platforms (AWS, GCP, Azure)
- System Design and scalability patterns
- NoSQL databases (MongoDB, Cassandra)
- Spring Security for authentication/authorization
- Performance optimization and profiling

Responsibilities:
- Design and implement scalable backend systems
- Lead architectural decisions for microservices
- Mentor junior developers
- Participate in code reviews and technical discussions""",
            difficulty="hard",
            round_structure="Phone Screen → Technical Coding → System Design → Behavioral",
            required_skills=["Java", "Spring Boot", "Microservices", "REST APIs", "SQL", "Docker", "Kafka"],
            interview_date=interview_date
        )
        db.add(target)
        db.commit()
        target_id = target.id
        print(f"      ✓ Target created: Java Backend Developer (Interview in 14 days)")
        
        # ===== STEP 5: Create Resume Gap Analysis =====
        print("[5/6] Analyzing skill gaps...")
        gap = db.query(ResumeGapAnalysis).filter_by(student_id=student_id, target_id=target_id).first()
        if not gap:
            gap = ResumeGapAnalysis(
                student_id=student_id,
                target_id=target_id
            )
            db.add(gap)
            db.commit()
        
        gap.missing_skills = [
            "Java (8, 11, 17)",
            "Spring Framework",
            "Spring Boot",
            "Spring Security",
            "Microservices architecture",
            "JUnit 5",
            "Mockito",
            "Apache Kafka",
            "System Design",
            "Kubernetes"
        ]
        gap.partial_skills = [
            "REST API design",
            "Docker containerization",
            "Message queues concepts",
            "Database design",
            "Testing practices"
        ]
        gap.matching_skills = [
            "Backend development",
            "Microservices conceptually (FastAPI)",
            "Testing mindset (pytest)",
            "REST API design",
            "Docker & containerization",
            "Database design & optimization",
            "Version control (Git)"
        ]
        gap.ats_score = 68  # Good technical match but Java-specific skills missing
        gap.keyword_match_percentage = 55
        gap.analysis_summary = "Strong backend developer with Python expertise. Needs to transition from Django/FastAPI to Spring Boot ecosystem. REST API and database design knowledge transfers well. Will need 2-3 weeks to learn Java and Spring Boot basics."
        db.commit()
        print(f"      ✓ Gap analysis created:")
        print(f"         - Missing: 10 Java/Spring-specific skills")
        print(f"         - Partial: 5 skills that transfer with Java context")
        print(f"         - Matching: 7 transferable backend skills")
        
        # ===== STEP 6: Create PrepLicense =====
        print("[6/6] Creating PrepLicense for study plan...")
        license_obj = db.query(PrepLicense).filter_by(
            student_id=student_id,
            company_name="Tech Startup"
        ).first()
        
        if not license_obj:
            license_obj = PrepLicense(
                student_id=student_id,
                admin_id=1,
                company_name="Tech Startup",
                role="Java Backend Developer",
                status="active",
                tokens_available=10,
                plan_generated=False
            )
            db.add(license_obj)
            db.commit()
        else:
            license_obj.status = "active"
            license_obj.tokens_available = 10
            license_obj.plan_generated = False
            db.commit()
        
        print(f"      ✓ PrepLicense created with 10 tokens available")
        
        # ===== SUMMARY =====
        print("\n" + "="*70)
        print("✅ TEST SCENARIO SETUP COMPLETE!")
        print("="*70)
        print(f"\nTest Student Details:")
        print(f"  ID:                    {student_id}")
        print(f"  Email:                 {student_email}")
        print(f"  Primary Skill:         Python (Advanced, 5 years)")
        print(f"  Known Skills:          9 (Django, FastAPI, Docker, PostgreSQL, AWS, etc.)")
        print(f"\nTarget Interview:")
        print(f"  Company:               Tech Startup")
        print(f"  Role:                  Java Backend Developer")
        print(f"  Interview Date:        {interview_date.strftime('%Y-%m-%d')}")
        print(f"  Days to Prepare:       14")
        print(f"  Difficulty:            Hard")
        print(f"\nSkill Gap:")
        print(f"  Missing:               10 Java/Spring-specific skills")
        print(f"  Partial (Transfer):    5 skills")
        print(f"  Matching:              7 transferable backend skills")
        print(f"  ATS Match Score:       68%")
        print(f"\nLicense Status:")
        print(f"  Status:                Active")
        print(f"  Tokens Available:      10")
        print(f"  Plan Generated:        False (will trigger on activation)")
        print("\n" + "="*70)
        print("NEXT STEPS:")
        print("="*70)
        print("1. Ensure backend API is running:     uvicorn app.main:app --reload")
        print("2. Ensure Celery worker is running:   celery -A app.tasks.jobs worker --loglevel=info")
        print("3. Login as: python_dev_test@example.com")
        print("4. Navigate to Dashboard")
        print("5. Find 'Tech Startup - Java Backend Developer' company")
        print("6. Click 'Activate Study Plan'")
        print("7. Confirm activation (this triggers AI plan generation)")
        print("8. Navigate to /plan page")
        print("9. Watch the AI generate a 14-day personalized study plan!")
        print("\nExpected AI Plan Features:")
        print("  ✓ Acknowledges Python background")
        print("  ✓ Compares Django concepts to Spring Boot")
        print("  ✓ Addresses Java language fundamentals first")
        print("  ✓ Builds towards Spring Boot & microservices")
        print("  ✓ Includes system design for interviews")
        print("  ✓ 14 days of structured learning tasks")
        print("\n" + "="*70 + "\n")
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    setup_test_scenario()
