import sys
import os
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.getcwd())
from app.db.session import engine
from shared.models.plan import LearningPlan

Session = sessionmaker(bind=engine)
session = Session()

plan = session.query(LearningPlan).order_by(LearningPlan.id.desc()).first()
if plan:
    print(f"Plan ID: {plan.id}")
    with open("latest_plan.json", "w") as f:
        json.dump(plan.plan_json, f, indent=2)
else:
    print("No plans found")
