import sys
import json
sys.path.append('.')
from app.db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
plans = db.execute(text("SELECT plan_json FROM learning_plans WHERE id=62")).fetchall()
for p in plans:
    data = p[0]
    if isinstance(data, str): data = json.loads(data)
    cur = data.get("curriculum", [])
    print("Curriculum length:", len(cur))
    for cat in cur:
        topics = cat.get("topics", [])
        print(f"  Category: {cat.get('category')} / {cat.get('category_title')} with {len(topics)} topics")
        for t in topics:
            print(f"    - [{t.get('stage_id')}] {t.get('title')}")
