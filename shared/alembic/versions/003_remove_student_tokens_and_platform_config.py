"""Remove deprecated student_tokens and platform_config tables.

Revision ID: 003_remove_student_tokens_and_platform_config
Revises: 002_add_user_phone
Create Date: 2026-03-16
"""

from alembic import op


revision = "003_remove_student_tokens_and_platform_config"
down_revision = "002_add_user_phone"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("platform_config")
    op.drop_table("student_tokens")


def downgrade() -> None:
    raise RuntimeError("Downgrade is intentionally unsupported for this migration")
