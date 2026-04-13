import sys
import os

# Add root to pythonpath
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from shared.db.session import engine
from sqlalchemy import text

def add_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE placement_companies ADD COLUMN exemption_list JSON DEFAULT '[]'::json;"))
            conn.commit()
            print("Successfully added exemption_list to placement_companies!")
        except Exception as e:
            print(f"Error or column already exists: {e}")

if __name__ == "__main__":
    add_column()
