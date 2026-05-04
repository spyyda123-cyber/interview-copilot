"""
Fix: Reset TCS application for java_dev_test back to APPROVED
so the student can enter the license key and trigger plan generation.
Also clears any existing plan signature to allow fresh generation.

USAGE:
    $env:PYTHONPATH = "../.."; python fix_reset_tcs_to_approved.py
"""
from sqlalchemy import create_engine, text
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from shared.config import settings

engine = create_engine(settings.DATABASE_URL)
with engine.begin() as conn:
    # 1. Reset TCS application to APPROVED
    result = conn.execute(text("""
        UPDATE placement_applications
        SET status = 'APPROVED'
        WHERE student_id = (SELECT id FROM users WHERE email = 'java_dev_test@example.com')
          AND company_id = (SELECT id FROM placement_companies WHERE company_name = 'TCS' LIMIT 1)
        RETURNING id, status
    """))
    rows = result.fetchall()
    print(f"Reset {len(rows)} application(s) to APPROVED: {rows}")

    # 2. Delete existing plan so fresh generation happens on license activation
    result2 = conn.execute(text("""
        DELETE FROM learning_plans
        WHERE student_id = (SELECT id FROM students WHERE email = 'java_dev_test@example.com')
          AND company_name = 'TCS'
        RETURNING id
    """))
    deleted = result2.fetchall()
    print(f"Deleted {len(deleted)} existing plan(s) for TCS: {[r[0] for r in deleted]}")

    # 3. Confirm final state
    rows = conn.execute(text("""
        SELECT u.email, pa.status, pc.company_name
        FROM placement_applications pa
        JOIN users u ON u.id = pa.student_id
        JOIN placement_companies pc ON pc.id = pa.company_id
        WHERE u.email = 'java_dev_test@example.com'
        ORDER BY pa.status
    """)).fetchall()
    print("\nCurrent application status for java_dev_test:")
    for r in rows:
        print(f"  {r[2]}: {r[1]}")

print("\nDONE.")
print("Student should now see TCS in 'Approved companies' on Interview List.")
print("Click Activate → enter license key: TEST-S2-JAVA-JAVA-2026")
