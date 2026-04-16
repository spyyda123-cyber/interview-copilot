"""
Migration script to remove deprecated time_left_days column from student_profiles.
"""
from sqlalchemy import text

from app.db.session import engine


def migrate() -> None:
    with engine.connect() as conn:
        try:
            conn.execute(
                text(
                    """
                    ALTER TABLE student_profiles
                    DROP COLUMN IF EXISTS time_left_days
                    """
                )
            )
            conn.commit()
            print("✅ Removed student_profiles.time_left_days")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Migration failed: {exc}")
            raise


if __name__ == "__main__":
    migrate()
