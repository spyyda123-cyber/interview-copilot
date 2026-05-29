import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join('.', '..', '..')))

from student.backend.app.db.session import SessionLocal
from student.backend.app.models import TargetInterview, LearningPlan

def run():
    db = SessionLocal()
    targets = db.query(TargetInterview).order_by(TargetInterview.id.desc()).limit(20).all()
    print("ALL RECENT TARGETS:")
    for t in targets:
        print(f"ID: {t.id}, Company: {t.company_name}, Role: {t.role}, Student ID: {t.student_id}")

    print("\nALL RECENT PLANS:")
    plans = db.query(LearningPlan).order_by(LearningPlan.created_at.desc()).limit(3).all()
    for p in plans:
        print(f"ID: {p.id}, Signature: {p.plan_signature}, Role: {p.role}, Status: {p.status}, Company: {p.company_name}")
        if p.plan_json and "curriculum" in p.plan_json:
            for cat in p.plan_json["curriculum"]:
                for t in cat.get("topics", []):
                    print(f"  Topic: {t.get('title')} | Stage: {t.get('stage_id')}")
        else:
            print("  No curriculum in JSON")

if __name__ == '__main__':
    run()
