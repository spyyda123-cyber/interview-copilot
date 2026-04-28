"""Add Marksheet table for storing student marksheets.

Revision ID: 005_add_marksheet_table
Revises: 004_remove_plan_type
Create Date: 2026-03-13
"""

from alembic import op
import sqlalchemy as sa


revision = "005_add_marksheet_table"
down_revision = "004_remove_plan_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "marksheets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("file_name", sa.String(length=256), nullable=False),
        sa.Column("file_type", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(op.f("ix_marksheets_student_id"), "marksheets", ["student_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_marksheets_student_id"), table_name="marksheets")
    op.drop_table("marksheets")
