from sqlalchemy import create_engine
from shared.models.admin_models import StudentDatabaseRecord

engine = create_engine("postgresql://postgres:postgres@localhost:5432/interview_copilot")
StudentDatabaseRecord.__table__.create(engine, checkfirst=True)
print("student_db_records table created successfully.")
