from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from shared.auth.jwt import create_access_token
from shared.auth.passwords import verify_password
from shared.db.session import get_db
from shared.models.admin_models import User
from shared.models.enums import UserRole, UserStatus


router = APIRouter(tags=["Auth"])


class SuperAdminLoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    college_id: str | None = None
    full_name: str | None = None
    email: str | None = None


@router.post("/login", response_model=LoginResponse)
def super_admin_login(payload: SuperAdminLoginRequest, db: Session = Depends(get_db)):
    import logging
    logger = logging.getLogger("super_admin.login")
    logger.info(f"Attempting login for {payload.email}")
    user = (
        db.query(User)
        .filter(User.email == payload.email, User.role == UserRole.SUPER_ADMIN)
        .first()
    )
    if user is None:
        logger.warning(f"User not found for email: {payload.email}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    
    if not verify_password(payload.password, user.password_hash):
        logger.warning(f"Password verification failed for: {payload.email}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is not active")

    user.last_active_at = datetime.utcnow()
    db.add(user)
    db.commit()

    access_token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role.value,
            "college_id": str(user.college_id),
            "full_name": user.full_name,
            "email": user.email,
        }
    )

    # TODO: Add OTP verification before final token issue.
    return LoginResponse(
        access_token=access_token,
        user_id=str(user.id),
        role=user.role.value,
        college_id=str(user.college_id),
        full_name=user.full_name,
        email=user.email,
    )


@router.post("/logout")
def super_admin_logout():
    # TODO: Add server-side token blacklist/revocation.
    return {"status": "ok", "message": "Logged out"}
