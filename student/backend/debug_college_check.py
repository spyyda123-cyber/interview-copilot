"""Debug: Check college assignments and placement applications for test students."""
from sqlalchemy import create_engine, text
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from shared.config import settings

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    print("=== COLLEGES ===")
    for r in conn.execute(text("SELECT id, name FROM colleges ORDER BY id")).fetchall():
        print(f"  ID={r[0]}  Name={r[1]}")

    print("\n=== COLLEGE ADMINS ===")
    for r in conn.execute(text("SELECT email, college_id FROM users WHERE role='COLLEGE_ADMIN'")).fetchall():
        print(f"  {r[0]} -> college_id={r[1]}")

    print("\n=== TEST STUDENT USERS ===")
    test_emails = (
        "java_dev_test@example.com",
        "java_to_python_test@example.com",
        "python_python_test@example.com",
        "frontend_dev_test@example.com",
        "backend_backend_test@example.com",
        "python_dev_test@example.com",
    )
    for email in test_emails:
        rows = conn.execute(
            text("SELECT u.id, u.email, u.college_id, c.name FROM users u LEFT JOIN colleges c ON c.id=u.college_id WHERE u.email=:e"),
            {"e": email}
        ).fetchall()
        for r in rows:
            print(f"  user_id={r[0]}  email={r[1]}  college_id={r[2]}  college={r[3]}")

    print("\n=== PLACEMENT APPLICATIONS (all test students) ===")
    rows = conn.execute(text(
        """
        SELECT u.email, pa.status, pc.company_name, pc.college_id, pa.id
        FROM placement_applications pa
        JOIN users u ON u.id = pa.student_id
        JOIN placement_companies pc ON pc.id = pa.company_id
        WHERE u.email IN (
            'java_dev_test@example.com',
            'python_dev_test@example.com',
            'java_to_python_test@example.com',
            'python_python_test@example.com',
            'frontend_dev_test@example.com',
            'backend_backend_test@example.com'
        )
        ORDER BY u.email, pa.status
        """
    )).fetchall()
    for r in rows:
        print(f"  {r[0]}: status={r[1]}  company={r[2]}  company_college_id={r[3]}  app_id={r[4]}")
