from pathlib import Path
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "student" / "backend"))

from app.models import Student, LearningPlan, LearningTask
from shared.config import settings

engine = create_engine(settings.DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

try:
    student = db.query(Student).filter(Student.email == "python_dev_test@example.com").first()
    if not student:
        print("Student not found")
        sys.exit(1)
    
    print(f"Student ID: {student.id}")
    
    plans = db.query(LearningPlan).filter(LearningPlan.student_id == student.id).order_by(LearningPlan.created_at.desc()).all()
    print(f"Found {len(plans)} plans")
    
    for plan in plans:
        print(f"Plan ID: {plan.id}, Status: {plan.status}, Created: {plan.created_at}")
        tasks = db.query(LearningTask).filter(LearningTask.plan_id == plan.id).all()
        print(f"  Tasks: {len(tasks)}")
        for task in tasks:
            print(f"    Task: {task.title}, Content Length: {len(task.content) if task.content else 0}")
            if task.content and "coming soon" in task.content.lower():
                print("      [!] Contains 'coming soon' placeholder")

except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
