import sys
sys.path.append('.')
from app.db.session import SessionLocal
from sqlalchemy import text
db = SessionLocal()
db.execute(text("DELETE FROM learning_plans"))
db.commit()
print("Cleared plans.")
