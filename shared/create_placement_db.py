import traceback
from sqlalchemy import create_engine
from shared.models import admin_models
from shared.models.placement import PlacementCompany, PlacementApplication

try:
    engine = create_engine("postgresql://postgres:postgres@localhost:5432/interview_copilot")
    PlacementCompany.__table__.create(engine, checkfirst=True)
    PlacementApplication.__table__.create(engine, checkfirst=True)
    print("Tables created successfully")
except Exception as e:
    with open("error.txt", "w") as f:
        f.write(str(e))
    print("Error saved to error.txt")
