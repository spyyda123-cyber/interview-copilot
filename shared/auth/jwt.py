from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt

from shared.config import settings


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    expire_window = expires_delta or timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    expire = datetime.now(timezone.utc) + expire_window
    payload = data.copy()
    payload.update({"exp": expire})
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
