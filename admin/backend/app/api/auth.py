from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from shared.auth.jwt import create_access_token, decode_access_token
from shared.auth.passwords import hash_password, verify_password
from shared.db.session import get_db
from shared.models.admin_models import College, User
from shared.models.enums import CollegeStatus, UserRole, UserStatus


router = APIRouter(tags=["Auth"])


class AdminLoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)


class AdminLoginResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    user_id: str | None = None
    role: str | None = None
    college_id: str | None = None
    requires_password_setup: bool = False
    setup_token: str | None = None


class SetPasswordRequest(BaseModel):
    setup_token: str
    new_password: str = Field(min_length=8)


@router.post("/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .join(College, College.id == User.college_id)
        .filter(User.email == payload.email, User.role == UserRole.COLLEGE_ADMIN)
        .first()
    )

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    college = db.query(College).filter(College.id == user.college_id).first()
    if college is None or college.status != CollegeStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="College is inactive")

    if user.status == UserStatus.PENDING:
        if not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        setup_token = create_access_token(
            {
                "sub": str(user.id),
                "role": user.role.value,
                "college_id": str(user.college_id),
                "type": "setup_password",
            },
            expires_delta=timedelta(hours=1),
        )
        return AdminLoginResponse(requires_password_setup=True, setup_token=setup_token)

    if user.status != UserStatus.ACTIVE or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user.last_active_at = datetime.utcnow()
    db.add(user)
    db.commit()

    access_token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role.value,
            "college_id": str(user.college_id),
        }
    )

    return AdminLoginResponse(
        access_token=access_token,
        user_id=str(user.id),
        role=user.role.value,
        college_id=str(user.college_id),
        requires_password_setup=False,
    )


@router.post("/logout")
def admin_logout():
    # TODO: Add server-side token blacklist/revocation.
    return {"status": "ok", "message": "Logged out"}


@router.post("/set-password")
def set_password(payload: SetPasswordRequest, db: Session = Depends(get_db)):
    try:
        claims = decode_access_token(payload.setup_token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired setup token") from exc

    if claims.get("type") != "setup_password":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token type")

    user_id = claims.get("sub")
    try:
        user_uuid = uuid.UUID(str(user_id))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token subject") from exc

    user = db.query(User).filter(User.id == user_uuid, User.role == UserRole.COLLEGE_ADMIN).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = hash_password(payload.new_password)
    user.status = UserStatus.ACTIVE
    user.last_active_at = datetime.utcnow()
    db.add(user)
    db.commit()

    return {"status": "ok", "message": "Password updated"}
