from app.db.session import SessionLocal
from app.models import LearningPlan
db = SessionLocal()
plans = db.query(LearningPlan).filter(LearningPlan.status == 'ready').all()
for p in plans:
    has_curr = 'curriculum' in (p.plan_json or {})
    has_legacy = 'daily_plan' in (p.plan_json or {})
    print(f'Plan {p.id}: curriculum={has_curr}, legacy={has_legacy}')
db.close()
