"""
Script to create the token_requests table in the database.
Run from: d:\\17.3interview copilot\\interview copilot\\interview-copilot\\shared
"""
import sys
import os

# Add parent directories to path
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from shared.db.base import Base
from shared.db.session import engine

# Import all models so they register with Base.metadata
from shared.models.admin_models import College, User, CollegeToken, TokenTransaction, StudentActivityLog, StudentDatabaseRecord
from shared.models.token_request import TokenRequest

print("Creating token_requests table if it doesn't exist...")
TokenRequest.__table__.create(bind=engine, checkfirst=True)
print("Done! token_requests table is ready.")
