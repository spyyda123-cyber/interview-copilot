from app.db.session import SessionLocal
from app.models import LearningPlan
import json

db = SessionLocal()
p = db.query(LearningPlan).filter(LearningPlan.role.ilike('%Python Developer%')).first()
if p and p.plan_json:
    print(json.dumps(p.plan_json, indent=2))
else:
    print("No plan found")
db.close()
