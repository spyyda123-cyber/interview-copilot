import os
import sys

# Add root project dir to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from sqlalchemy import text
from app.db.session import engine

def run_migration():
    print("Running migration to add UI fields to students table...")
    with engine.connect() as conn:
        try:
            conn.execute(text("""
                ALTER TABLE students 
                ADD COLUMN IF NOT EXISTS roll_number VARCHAR(50)
            """))
            conn.execute(text("""
                ALTER TABLE students 
                ADD COLUMN IF NOT EXISTS department VARCHAR(100)
            """))
            conn.execute(text("""
                ALTER TABLE students 
                ADD COLUMN IF NOT EXISTS college VARCHAR(200)
            """))
            conn.commit()
            print("Migration successful! Added missing Student UI columns.")
        except Exception as e:
            conn.rollback()
            print(f"Error executing migration: {e}")

if __name__ == "__main__":
    run_migration()
