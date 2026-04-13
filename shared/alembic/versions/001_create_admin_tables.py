"""Create admin auth and token foundation tables.

Revision ID: 001_create_admin_tables
Revises: None
Create Date: 2026-03-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "001_create_admin_tables"
down_revision = None
branch_labels = None
depends_on = None


plan_type_enum = postgresql.ENUM("BASIC", "STANDARD", "PRO", "CAMPUS", name="plan_type_enum", create_type=False)
college_status_enum = postgresql.ENUM("ACTIVE", "INACTIVE", name="college_status_enum", create_type=False)
user_role_enum = postgresql.ENUM("SUPER_ADMIN", "COLLEGE_ADMIN", "STUDENT", name="user_role_enum", create_type=False)
user_status_enum = postgresql.ENUM("ACTIVE", "INACTIVE", "PENDING", name="user_status_enum", create_type=False)
token_transaction_type_enum = postgresql.ENUM(
    "ALLOCATION",
    "CONSUMPTION",
    "RECLAIM",
    name="token_transaction_type_enum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    plan_type_enum.create(bind, checkfirst=True)
    college_status_enum.create(bind, checkfirst=True)
    user_role_enum.create(bind, checkfirst=True)
    user_status_enum.create(bind, checkfirst=True)
    token_transaction_type_enum.create(bind, checkfirst=True)

    op.create_table(
        "colleges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=255), nullable=True),
        sa.Column("plan_type", plan_type_enum, nullable=False),
        sa.Column("status", college_status_enum, nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("college_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("colleges.id"), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role_enum, nullable=False),
        sa.Column("status", user_status_enum, nullable=False, server_default="ACTIVE"),
        sa.Column("department", sa.String(length=255), nullable=True),
        sa.Column("graduation_year", sa.Integer(), nullable=True),
        sa.Column("access_expiry", sa.Date(), nullable=True),
        sa.Column("last_active_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "college_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("college_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("colleges.id"), nullable=False),
        sa.Column("total_allocated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_consumed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("balance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.UniqueConstraint("college_id", name="uq_college_tokens_college_id"),
    )

    op.create_table(
        "token_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("college_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("colleges.id"), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("type", token_transaction_type_enum, nullable=False),
        sa.Column("action", sa.String(length=255), nullable=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "student_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("college_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("colleges.id"), nullable=False),
        sa.Column("allocated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("consumed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("balance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cap", sa.Integer(), nullable=True),
        sa.UniqueConstraint("student_id", "college_id", name="uq_student_tokens_student_college"),
    )

    op.create_table(
        "student_activity_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("college_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("colleges.id"), nullable=False),
        sa.Column("action_type", sa.String(length=255), nullable=False),
        sa.Column("tokens_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "platform_config",
        sa.Column("key", sa.String(length=255), primary_key=True, nullable=False),
        sa.Column("value", sa.String(length=1024), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("platform_config")
    op.drop_table("student_activity_log")
    op.drop_table("student_tokens")
    op.drop_table("token_transactions")
    op.drop_table("college_tokens")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    op.drop_table("colleges")

    bind = op.get_bind()
    token_transaction_type_enum.drop(bind, checkfirst=True)
    user_status_enum.drop(bind, checkfirst=True)
    user_role_enum.drop(bind, checkfirst=True)
    college_status_enum.drop(bind, checkfirst=True)
    plan_type_enum.drop(bind, checkfirst=True)

