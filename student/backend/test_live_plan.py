import json
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from app.db.session import SessionLocal
from app.models import Student, StudentProfile, PrepLicense, TargetInterview, Resume, ResumeGapAnalysis
from app.services.plan_service import generate_learning_plan

def test_live_plan():
    db = SessionLocal()
    try:
        # Assuming student_id 1 is valid or we can create a mock student context
        student = db.query(Student).first()
        if not student:
            print("No student found in DB. Need a student to run the test.")
            return
            
        student_id = student.id
        company_name = "MockLiveCompany"
        role = "Java Backend Developer"
        days_available = 14
        
        # We need a profile with Python skills
        profile = db.query(StudentProfile).filter_by(student_id=student_id).first()
        if not profile:
            profile = StudentProfile(student_id=student_id)
            db.add(profile)
            db.commit()
            
        profile.primary_skill = "Python"
        profile.known_skills = [{"skill": "Python", "proficiency": "Advanced"}, {"skill": "Django", "proficiency": "Advanced"}]
        db.commit()
        
        # We need a TargetInterview
        target = db.query(TargetInterview).filter_by(student_id=student_id, company_name=company_name).first()
        if not target:
            target = TargetInterview(
                student_id=student_id,
                company_name=company_name,
                role=role,
                jd_text="Need a Java Spring Boot developer with microservices experience.",
                difficulty="medium",
                round_structure="Screen -> Technical -> System Design",
                required_skills=["Java", "Spring Boot", "Microservices"]
            )
            db.add(target)
            db.commit()
            
        # We need a ResumeGapAnalysis showing Java is missing
        gap = db.query(ResumeGapAnalysis).filter_by(student_id=student_id).first()
        if not gap:
            gap = ResumeGapAnalysis(student_id=student_id, target_id=target.id)
            db.add(gap)
            db.commit()
            
        gap.missing_skills = ["Java", "Spring Boot", "Microservices"]
        gap.target_id = target.id
        db.commit()
        
        # Remove any existing plan to force generation
        from app.models import LearningPlan
        db.query(LearningPlan).filter_by(student_id=student_id, company_name=company_name).delete()
        db.commit()

        print("Generating live learning plan using Gemini/OpenAI...")
        plan = generate_learning_plan(
            db=db,
            student_id=student_id,
            company_name=company_name,
            days_available=days_available,
            role=role
        )
        
        print("\n=== GENERATED PLAN TASKS ===")
        print(f"Plan ID: {plan.id}, Type: {plan.plan_type}")
        for day_data in plan.plan_json.get("daily_plan", []):
            print(f"\nDay {day_data['day']}: {day_data.get('focus', 'No Focus')}")
            for task in day_data.get("tasks", []):
                print(f"  - [{task['duration_minutes']}m] {task['title']}")
                print(f"    {task['description']}")
                
    finally:
        db.close()

if __name__ == "__main__":
    test_live_plan()
