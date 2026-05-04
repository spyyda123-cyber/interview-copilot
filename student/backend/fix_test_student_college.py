"""
Fix: Move all test student users and their placement companies to PSG Tech college
so they show up under psgtech@gmail.com admin's Approvals page.

Also set all INTERESTED applications back to INTERESTED so admin can approve them.

USAGE:
    $env:PYTHONPATH = "../.."; python fix_test_student_college.py
"""
from sqlalchemy import create_engine, text
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from shared.config import settings

PSG_TECH_COLLEGE_ID = "ff7557e5-69d3-4f96-a2fb-0441a39ed229"  # PSG Tech

TEST_EMAILS = [
    "java_dev_test@example.com",
    "python_dev_test@example.com",
    "java_to_python_test@example.com",
    "python_python_test@example.com",
    "frontend_dev_test@example.com",
    "backend_backend_test@example.com",
]

engine = create_engine(settings.DATABASE_URL)
with engine.begin() as conn:
    # 1. Move test users to PSG Tech
    result = conn.execute(
        text("UPDATE users SET college_id=:cid WHERE email=ANY(:emails) RETURNING email"),
        {"cid": PSG_TECH_COLLEGE_ID, "emails": TEST_EMAILS}
    )
    updated_users = result.fetchall()
    print(f"Updated {len(updated_users)} users -> PSG Tech college:")
    for r in updated_users:
        print(f"  {r[0]}")

    # 2. Move their placement companies to PSG Tech
    result = conn.execute(
        text("""
            UPDATE placement_companies pc
            SET college_id = :cid
            FROM placement_applications pa
            JOIN users u ON u.id = pa.student_id
            WHERE pa.company_id = pc.id
              AND u.email = ANY(:emails)
            RETURNING pc.company_name, pc.id
        """),
        {"cid": PSG_TECH_COLLEGE_ID, "emails": TEST_EMAILS}
    )
    updated_comps = result.fetchall()
    print(f"\nUpdated {len(updated_comps)} placement companies -> PSG Tech college:")
    for r in updated_comps:
        print(f"  {r[0]}")

    # 3. Show current application statuses
    print("\n=== CURRENT APPLICATION STATUS ===")
    rows = conn.execute(
        text("""
            SELECT u.email, pa.status, pc.company_name, pa.id
            FROM placement_applications pa
            JOIN users u ON u.id = pa.student_id
            JOIN placement_companies pc ON pc.id = pa.company_id
            WHERE u.email = ANY(:emails)
            ORDER BY u.email, pa.status
        """),
        {"emails": TEST_EMAILS}
    ).fetchall()
    for r in rows:
        print(f"  {r[0]}: status={r[1]}  company={r[2]}  app_id={r[3]}")

print("\nDONE. Refresh the College Admin Approvals page (localhost:3001/approvals)")
print("Test students should now appear under PSG Tech admin.")
print("Applications with INTERESTED status will show Approve/Reject buttons.")
