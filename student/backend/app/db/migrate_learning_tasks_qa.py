import os
import sys
from sqlalchemy import text

# Add roots to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
# backend is 2 levels up from app/db
backend_dir = os.path.dirname(os.path.dirname(script_dir))
# interview-copilot is 2 levels up from backend
root_dir = os.path.dirname(os.path.dirname(backend_dir))

print(f"DEBUG: script_dir={script_dir}")
print(f"DEBUG: backend_dir={backend_dir}")
print(f"DEBUG: root_dir={root_dir}")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app.db.session import engine

def run_migration():
    print("Running migration for learning_tasks table...")
    with engine.begin() as conn:
        # Add task_type column
        try:
            conn.execute(text("ALTER TABLE learning_tasks ADD COLUMN task_type VARCHAR(50) DEFAULT 'text';"))
            print("Successfully added 'task_type' column to 'learning_tasks' table.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("'task_type' column already exists.")
            else:
                print(f"Error adding 'task_type': {e}")

        # Add qa_pairs column
        try:
            conn.execute(text("ALTER TABLE learning_tasks ADD COLUMN qa_pairs JSON;"))
            print("Successfully added 'qa_pairs' column to 'learning_tasks' table.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("'qa_pairs' column already exists.")
            else:
                print(f"Error adding 'qa_pairs': {e}")

        # Add code_metadata column
        try:
            conn.execute(text("ALTER TABLE learning_tasks ADD COLUMN code_metadata JSON;"))
            print("Successfully added 'code_metadata' column to 'learning_tasks' table.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("'code_metadata' column already exists.")
            else:
                print(f"Error adding 'code_metadata': {e}")

if __name__ == "__main__":
    run_migration()
