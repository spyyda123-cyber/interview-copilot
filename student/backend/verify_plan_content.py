import sys
import os

# Add the project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from student.backend.app.db.session import SessionLocal
from student.backend.app.models import LearningPlan

def check_plan():
    db = SessionLocal()
    try:
        plan = db.query(LearningPlan).filter(LearningPlan.id == 2).first()
        if not plan:
            print("Plan 2 not found")
            return
        
        print(f"Plan ID: {plan.id}")
        print(f"Status: {plan.status}")
        print(f"Company: {plan.company_name}")
        print(f"Role: {plan.role}")
        print("-" * 20)
        
        plan_json = plan.plan_json
        if not plan_json:
            print("Plan JSON is empty")
            return
            
        print("Overview:")
        print(plan_json.get("overview", "No overview"))
        print("-" * 20)
        
        daily_plan = plan_json.get("daily_plan", [])
        print(f"Total days: {len(daily_plan)}")
        
        for day in daily_plan[:3]:  # Show first 3 days
            print(f"Day {day.get('day')}: {day.get('focus')}")
            for task in day.get('tasks', []):
                print(f"  - {task.get('title')} ({task.get('duration_minutes')}m)")
    finally:
        db.close()

if __name__ == "__main__":
    check_plan()
