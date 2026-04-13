from sqlalchemy import create_engine, text

engine = create_engine("postgresql://postgres:postgres@localhost:5432/interview_copilot")
with engine.connect() as conn:
    conn.execute(text("DROP TABLE IF EXISTS placement_applications CASCADE;"))
    conn.execute(text("DROP TABLE IF EXISTS placement_companies CASCADE;"))
    conn.commit()
    print("Dropped")
