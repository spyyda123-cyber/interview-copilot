"""Create topic_content table for Prompt 2 caching."""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS topic_content (
            id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL,
            topic_id VARCHAR(255) NOT NULL,
            content JSON NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(student_id, topic_id)
        );
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_topic_content_student_topic ON topic_content(student_id, topic_id);"))
    conn.commit()
    print("topic_content table created successfully")
