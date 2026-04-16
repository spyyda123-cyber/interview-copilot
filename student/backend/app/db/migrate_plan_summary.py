"""Migration: Add plan_summary column to learning_plans table.

Single-Call Plan Optimization:
- Replaces per-day enrichment with one strategic summary per plan
- plan_summary: TEXT field to store personalized interview advice
- Populated asynchronously by generate_plan_summary Celery task

This migration is safe: column is nullable and has no default requirement.
"""
import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate_add_plan_summary_column(connection):
    """Add plan_summary column as nullable TEXT field."""
    try:
        connection.execute(text("ALTER TABLE learning_plans ADD COLUMN plan_summary TEXT"))
        connection.commit()
        logger.info("[MIGRATION] Added plan_summary column to learning_plans")
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            logger.info("[MIGRATION] Column plan_summary already exists, skipping")
        else:
            logger.error(f"[MIGRATION] Error adding plan_summary column: {e}")
            raise


if __name__ == "__main__":
    from app.db.session import engine

    with engine.connect() as conn:
        migrate_add_plan_summary_column(conn)
        print("Migration complete")

