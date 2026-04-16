from sqlalchemy import text

from shared.db.session import SessionLocal, create_extension, engine, get_db


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


    __all__ = ["engine", "SessionLocal", "get_db", "create_extension", "init_db"]
