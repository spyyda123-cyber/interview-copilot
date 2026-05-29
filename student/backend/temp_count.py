import sys
sys.path.append('.')
from app.db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
count = db.execute(text("SELECT COUNT(*) FROM learning_plans")).scalar()
print("Learning plans count:", count)
