import os
import sys

# Add the project root to the sys path to allow importing app
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.db.session import engine

def run_migration():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE students ADD COLUMN first_name VARCHAR(50);"))
            print("Added first_name to students.")
        except Exception as e:
            print("first_name column might already exist.")
            
        try:
            conn.execute(text("ALTER TABLE students ADD COLUMN last_name VARCHAR(50);"))
            print("Added last_name to students.")
        except Exception as e:
            print("last_name column might already exist.")
            
        try:
            conn.execute(text("ALTER TABLE students ADD COLUMN phone VARCHAR(20);"))
            print("Added phone to students.")
        except Exception as e:
            print("phone column might already exist.")
            
        try:
            conn.execute(text("ALTER TABLE student_profiles ADD COLUMN marksheets JSON DEFAULT '[]';"))
            print("Added marksheets to student_profiles.")
        except Exception as e:
            print("marksheets column might already exist.")

if __name__ == "__main__":
    run_migration()
