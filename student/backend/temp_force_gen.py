import sys
sys.path.append('.')
from app.db.session import SessionLocal
from app.models import Student, TargetInterview, LearningPlan
from app.tasks.jobs import generate_plan_task
import os

db = SessionLocal()
# get the latest target
target = db.query(TargetInterview).order_by(TargetInterview.created_at.desc()).first()
student = db.query(Student).first()

if target and student:
    print(f"Resetting plan for student {student.id}, target {target.id}")
    # delete all plans
    db.query(LearningPlan).delete()
    db.commit()
    
    # Enqueue task
    role = target.role or "general"
    print(f"Enqueueing task: student_id={student.id}, company={target.company_name}, role={role}")
    generate_plan_task.delay(student.id, target.company_name, 14, role)
    print("Enqueued!")
else:
    print("No target or student found")
