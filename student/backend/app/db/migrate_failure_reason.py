"""
Migration script to add failure_reason column to learning_plans table for diagnostics.
"""
from sqlalchemy import text

from app.db.session import engine


def migrate():
    """Add failure_reason column to learning_plans."""
    with engine.connect() as conn:
        try:
            # Add failure_reason column
            conn.execute(text("""
                ALTER TABLE learning_plans 
                ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(50)
            """))
            print("✓ Added failure_reason column")

            conn.commit()
            print("✓ Migration completed successfully")

        except Exception as e:
            print(f"✗ Migration failed: {e}")
            conn.rollback()
            raise


if __name__ == "__main__":
    migrate()
