"""
Verify the learning_plans table migration.
"""
from sqlalchemy import text, inspect

from app.db.session import engine


def verify():
    """Verify the migration was successful."""
    with engine.connect() as conn:
        # Get table columns
        inspector = inspect(engine)
        columns = inspector.get_columns('learning_plans')
        
        print("📋 learning_plans table columns:")
        print("-" * 60)
        for col in columns:
            nullable = "NULL" if col['nullable'] else "NOT NULL"
            default = f" DEFAULT {col['default']}" if col['default'] else ""
            print(f"  {col['name']:<20} {str(col['type']):<15} {nullable}{default}")
        
        # Check indexes
        indexes = inspector.get_indexes('learning_plans')
        print("\n📊 Indexes:")
        print("-" * 60)
        for idx in indexes:
            unique = "UNIQUE" if idx['unique'] else ""
            print(f"  {idx['name']:<40} {unique}")
            print(f"    Columns: {', '.join(idx['column_names'])}")
        
        # Check constraints
        constraints = inspector.get_unique_constraints('learning_plans')
        print("\n🔒 Unique Constraints:")
        print("-" * 60)
        for const in constraints:
            print(f"  {const['name']:<40}")
            print(f"    Columns: {', '.join(const['column_names'])}")
        
        # Count existing plans
        result = conn.execute(text("SELECT COUNT(*) FROM learning_plans"))
        count = result.scalar()
        print(f"\n📈 Total learning plans in database: {count}")
        
        if count > 0:
            result = conn.execute(text("""
                SELECT status, COUNT(*) as count 
                FROM learning_plans 
                GROUP BY status
            """))
            print("\n📊 Plans by status:")
            for row in result:
                print(f"  {row.status or 'NULL'}: {row.count}")
        
        print("\n✅ Verification complete!")


if __name__ == "__main__":
    verify()
