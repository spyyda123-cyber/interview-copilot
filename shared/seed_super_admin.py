from __future__ import annotations

import argparse
import os
import sys

from sqlalchemy.orm import Session

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from shared.auth.passwords import hash_password
from shared.db.base import Base
from shared.db.session import SessionLocal, engine
from shared import models  # noqa: F401
from shared.models.admin_models import College, CollegeStatus, PlanType, User, UserRole, UserStatus


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed initial super admin user")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--college-name", default="Platform")
    return parser.parse_args()


def ensure_platform_college(db: Session, college_name: str) -> College:
    college = db.query(College).filter(College.name == college_name).first()
    if college:
        return college

    college = College(
        name=college_name,
        city=None,
        plan_type=PlanType.CAMPUS,
        status=CollegeStatus.ACTIVE,
    )
    db.add(college)
    db.commit()
    db.refresh(college)
    return college


def seed_super_admin(email: str, password: str, name: str, college_name: str) -> None:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print("Super admin already exists for this email")
            return

        college = ensure_platform_college(db, college_name)

        user = User(
            college_id=college.id,
            full_name=name,
            email=email,
            password_hash=hash_password(password),
            role=UserRole.SUPER_ADMIN,
            status=UserStatus.ACTIVE,
        )
        db.add(user)
        db.commit()
        print(f"Created super admin: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    args = parse_args()
    seed_super_admin(
        email=args.email,
        password=args.password,
        name=args.name,
        college_name=args.college_name,
    )

