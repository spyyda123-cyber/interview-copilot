"""Remove plan_type from colleges

Revision ID: 004_remove_plan_type
Revises: 003_remove_student_tokens_and_platform_config
Create Date: 2026-03-31
"""

from alembic import op
import sqlalchemy as sa

revision = "004_remove_plan_type"
down_revision = "003_remove_student_tokens_and_platform_config"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # We remove the plan_type column from colleges
    op.drop_column("colleges", "plan_type")

def downgrade() -> None:
    # Downgrade is not supported
    pass
