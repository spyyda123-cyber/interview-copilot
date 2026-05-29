import sys
sys.path.append('.')
from app.db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
plans = db.execute(text("SELECT id, student_id, company_name, role, status FROM learning_plans")).fetchall()
print(plans)
