import sys, os, json
sys.path.append(os.getcwd())
from app.db.session import SessionLocal
from app.models import Student, TargetInterview
from app.services.plan_service import generate_learning_plan

def main():
    db = SessionLocal()
    target = db.query(TargetInterview).order_by(TargetInterview.created_at.desc()).first()
    student = db.query(Student).first()
    if target and student:
        print(f"Generating plan synchronously for student {student.id}, target {target.id}")
        role = target.role or "general"
        result = generate_learning_plan(db, student.id, target.company_name, 14, role)
        print("Done!")
        with open("temp_plan_output.json", "w") as f:
            json.dump(result.plan_json, f, indent=2)
        print("Saved to temp_plan_output.json")
    else:
        print("No target or student")

if __name__ == "__main__":
    main()
