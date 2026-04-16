"""
Migration script to add plan_signature and status columns to learning_plans table.
"""
from sqlalchemy import text

from app.db.session import engine


def migrate():
    """Add plan_signature and status columns to learning_plans."""
    with engine.connect() as conn:
        try:
            # Add plan_signature column
            conn.execute(text("""
                ALTER TABLE learning_plans 
                ADD COLUMN IF NOT EXISTS plan_signature VARCHAR(512)
            """))
            print("✓ Added plan_signature column")
            
            # Add status column
            conn.execute(text("""
                ALTER TABLE learning_plans 
                ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'
            """))
            print("✓ Added status column")
            
            # Create unique constraint on plan_signature
            conn.execute(text("""
                ALTER TABLE learning_plans 
                ADD CONSTRAINT unique_plan_signature UNIQUE (plan_signature)
            """))
            print("✓ Added unique constraint on plan_signature")
            
            # Create index on plan_signature
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_learning_plans_plan_signature 
                ON learning_plans(plan_signature)
            """))
            print("✓ Created index on plan_signature")
            
            # Update existing rows to have status='ready' if plan_json is not empty
            conn.execute(text("""
                UPDATE learning_plans 
                SET status = 'ready' 
                WHERE plan_json IS NOT NULL 
                AND plan_json::text != '{}'
                AND status IS NULL
            """))
            print("✓ Updated existing plans to status='ready'")
            
            conn.commit()
            print("\n✅ Migration completed successfully!")
            
        except Exception as e:
            conn.rollback()
            print(f"\n❌ Migration failed: {e}")
            raise


if __name__ == "__main__":
    migrate()
