import sys
import os
from dotenv import load_dotenv
sys.path.append('.')
load_dotenv('.env')

from shared.config import settings
print("DB URL:", settings.DATABASE_URL)

from shared.db.session import SessionLocal
from sqlalchemy import text
import json
db = SessionLocal()
plans = db.execute(text("SELECT id, plan_signature, plan_json FROM learning_plans")).fetchall()
print("Learning plans count:", len(plans))
for p in plans:
    print(f"[{p[0]}] Signature: {p[1]}")
    data = p[2]
    if isinstance(data, str): data = json.loads(data)
    if data:
        cur = data.get("curriculum", [])
        for cat in cur:
            for t in cat.get("topics", []):
                print(f"   - {t.get('title')} (Stage: {t.get('stage_id')})")
