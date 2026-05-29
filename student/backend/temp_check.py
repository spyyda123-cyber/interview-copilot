import sys
import json
sys.path.append('.')
from app.db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
plans = db.execute(text("SELECT plan_signature, plan_json FROM learning_plans")).fetchall()
for p in plans:
    print("Signature:", p[0])
    print(json.dumps(p[1], indent=2))
