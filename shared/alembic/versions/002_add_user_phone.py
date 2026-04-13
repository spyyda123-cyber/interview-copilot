"""Add optional phone to users.

Revision ID: 002_add_user_phone
Revises: 001_create_admin_tables
Create Date: 2026-03-13
"""

from alembic import op
import sqlalchemy as sa


revision = "002_add_user_phone"
down_revision = "001_create_admin_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "phone")
