import os
import sys
from sqlalchemy import text

# Add roots to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
# backend is 2 levels up from app/db
backend_dir = os.path.dirname(os.path.dirname(script_dir))
# interview-copilot is 2 levels up from backend
root_dir = os.path.dirname(os.path.dirname(backend_dir))

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app.db.session import engine

def run_migration():
    print("Running migration to add 'quiz' column to 'learning_tasks' table...")
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE learning_tasks ADD COLUMN quiz JSON;"))
            print("Successfully added 'quiz' column to 'learning_tasks' table.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("'quiz' column already exists.")
            else:
                print(f"Error adding 'quiz': {e}")

if __name__ == "__main__":
    run_migration()
