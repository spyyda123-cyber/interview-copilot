from app.db.session import SessionLocal
from app.models import Student, TargetInterview, LearningPlan

db = SessionLocal()
print("Students:")
for s in db.query(Student).all():
    print(f"ID: {s.id}, Email: {s.email}")

print("\nTargets:")
for t in db.query(TargetInterview).all():
    print(f"ID: {t.id}, Student ID: {t.student_id}, Company: {t.company_name}, Role: {t.role}")

print("\nPlans:")
for p in db.query(LearningPlan).all():
    print(f"ID: {p.id}, Signature: {p.plan_signature}, Status: {p.status}")

db.close()
