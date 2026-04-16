"""
Migration script to add plan_type column to learning_plans table for observability.
"""
from sqlalchemy import text

from app.db.session import engine


def migrate():
    """Add plan_type column to learning_plans."""
    with engine.connect() as conn:
        try:
            # Add plan_type column
            conn.execute(text("""
                ALTER TABLE learning_plans 
                ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'ai'
            """))
            print("✓ Added plan_type column")

            # Update existing rows to default plan_type='ai'
            conn.execute(text("""
                UPDATE learning_plans 
                SET plan_type = 'ai'
                WHERE plan_type IS NULL
            """))
            print("✓ Updated existing plans to plan_type='ai'")

            conn.commit()
            print("✓ Migration completed successfully")

        except Exception as e:
            print(f"✗ Migration failed: {e}")
            conn.rollback()
            raise


if __name__ == "__main__":
    migrate()
