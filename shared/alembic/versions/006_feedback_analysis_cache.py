"""Add feedback_analysis_cache table and interview_feedbacks unique constraint.

Revision ID: 006_feedback_analysis_cache
Revises: 005_add_marksheet_table
Create Date: 2026-04-27

CHANGES:
  1. Create feedback_analysis_cache table — stores per-company AI-aggregated insights
  2. Add UNIQUE constraint on interview_feedbacks (student_id, company_name, interview_date)
"""

from alembic import op
import sqlalchemy as sa


revision = "006_feedback_analysis_cache"
down_revision = "005_add_marksheet_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Create feedback_analysis_cache ────────────────────────────────
    op.create_table(
        "feedback_analysis_cache",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("feedback_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("avg_relevance", sa.Float(), nullable=True),
        sa.Column("irrelevant_pct", sa.Float(), nullable=True),
        sa.Column("most_common_experience", sa.String(50), nullable=True),
        sa.Column("most_common_performance", sa.String(50), nullable=True),
        sa.Column("missing_topics", sa.JSON(), nullable=True),
        sa.Column("prompt_snippet", sa.Text(), nullable=True),
        sa.Column("last_refreshed", sa.DateTime(), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("feedback_hash", sa.String(64), nullable=True),
    )
    op.create_index(
        "ix_feedback_analysis_cache_company_name",
        "feedback_analysis_cache",
        ["company_name"],
        unique=True,
    )

    # ── 2. Unique constraint on interview_feedbacks ───────────────────────
    # Safely skip if constraint already exists
    try:
        op.create_unique_constraint(
            "uq_feedback_student_company_date",
            "interview_feedbacks",
            ["student_id", "company_name", "interview_date"],
        )
    except Exception:
        pass  # Already exists — migration is idempotent


def downgrade() -> None:
    try:
        op.drop_constraint(
            "uq_feedback_student_company_date",
            "interview_feedbacks",
            type_="unique",
        )
    except Exception:
        pass
    op.drop_index("ix_feedback_analysis_cache_company_name", table_name="feedback_analysis_cache")
    op.drop_table("feedback_analysis_cache")
