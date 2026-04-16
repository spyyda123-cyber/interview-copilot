"""
Migration script to add hashed_password to students table.
"""
from sqlalchemy import text

from app.db.session import engine


def migrate():
    """Add hashed_password column to students table."""
    with engine.connect() as conn:
        try:
            # Add hashed_password column
            conn.execute(text("""
                ALTER TABLE students 
                ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255)
            """))
            print("✓ Added hashed_password column to students table")
            
            conn.commit()
            print("\n✅ Student password migration completed successfully!")
            
        except Exception as e:
            conn.rollback()
            print(f"\n❌ Migration failed: {e}")
            raise


if __name__ == "__main__":
    migrate()
