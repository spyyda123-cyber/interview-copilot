import sys, os, json
sys.path.append(os.getcwd())
from app.db.session import SessionLocal
from app.models import LearningPlan
db = SessionLocal()
plans = db.query(LearningPlan).order_by(LearningPlan.id.desc()).all()
if plans:
    plan = plans[0]
    print('Plan ID:', plan.id, 'Role:', plan.role)
    curriculum = plan.plan_json.get('curriculum', [])
    for cat in curriculum:
        for t in cat['topics']:
            print(f"Stage: {t.get('stage_id')} | Title: {t.get('title')} | Prof: {t.get('proficiency_tag')}")
