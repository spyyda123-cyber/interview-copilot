from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

# IMPORTANT:
# Models are registered by importing app.models in main.py
# Do NOT import models here - it creates circular dependencies

