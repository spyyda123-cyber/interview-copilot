from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from shared.config import settings


engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_extension():
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()


def init_db():
    with engine.connect() as conn:
        conn.execute(
            text(
                "ALTER TABLE target_interviews ADD COLUMN IF NOT EXISTS analysis_status VARCHAR(50) DEFAULT 'processing'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE target_interviews ADD COLUMN IF NOT EXISTS analysis_error TEXT"
            )
        )
        conn.execute(
            text(
                "UPDATE target_interviews SET analysis_status = 'ready' WHERE analysis_status IS NULL"
            )
        )
        conn.commit()

