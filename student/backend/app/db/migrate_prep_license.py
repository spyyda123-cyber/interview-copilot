"""
Migration script to create prep_licenses table.
"""
from sqlalchemy import text

from app.db.session import engine


def migrate():
    """Create prep_licenses table."""
    with engine.connect() as conn:
        try:
            # Create prep_licenses table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS prep_licenses (
                    id SERIAL PRIMARY KEY,
                    license_key VARCHAR(128) UNIQUE NOT NULL,
                    student_id INTEGER REFERENCES students(id),
                    company_name VARCHAR(255) NOT NULL,
                    role VARCHAR(255),
                    interview_date DATE NOT NULL,
                    activated_at TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'unused' NOT NULL,
                    plan_generated BOOLEAN DEFAULT FALSE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                )
            """))
            print("✓ Created prep_licenses table")
            
            # Create indexes
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_prep_licenses_license_key 
                ON prep_licenses(license_key)
            """))
            print("✓ Created index on license_key")
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_prep_licenses_student_id 
                ON prep_licenses(student_id)
            """))
            print("✓ Created index on student_id")
            
            conn.commit()
            print("\n✅ PrepLicense migration completed successfully!")
            
        except Exception as e:
            conn.rollback()
            print(f"\n❌ Migration failed: {e}")
            raise


if __name__ == "__main__":
    migrate()
