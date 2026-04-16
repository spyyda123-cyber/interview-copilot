"""Admin authentication via X-ADMIN-KEY header.

Security-critical module for controlling admin-only endpoints like license creation.

KEY RESOLUTION STRATEGY (Layered Fallback):
1. Try settings.ADMIN_SECRET_KEY (from FastAPI config)
2. Try OS environment variable ADMIN_SECRET_KEY
3. Try .env file in project root (ADMIN_SECRET_KEY=value)
4. Return empty string if none found (will reject all requests)

This layering allows:
- Production: Key in secure env var
- Development: Key in .env file
- Tests: Key in settings override

SECURITY PRACTICES:
- Use secrets.compare_digest for timing-attack resistance
- Log unauthorized attempts (but not the key value)
- Raise 401 if missing, 403 if invalid/wrong
- Header parameter in FastAPI enables Swagger UI prompt
"""
import logging
import os
from pathlib import Path
import secrets
from typing import Annotated

from fastapi import Header, HTTPException

from app.core.config import settings

logger = logging.getLogger("app.security.admin_auth")


def _resolve_admin_secret_key() -> str:
    """Resolve admin secret key via layered fallback strategy.
    
    Attempts in order:
    1. settings.ADMIN_SECRET_KEY (FastAPI config, usually from env)
    2. OS environment variable ADMIN_SECRET_KEY
    3. .env file line ADMIN_SECRET_KEY=...
    
    Returns:
        str: The admin secret key, or empty string if not found
    """
    key = (settings.ADMIN_SECRET_KEY or "").strip()
    if key:
        return key

    env_key = (os.getenv("ADMIN_SECRET_KEY") or "").strip()
    if env_key:
        return env_key

    env_path = Path(__file__).resolve().parents[2] / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("ADMIN_SECRET_KEY="):
                return line.split("=", 1)[1].strip()

    return ""


def verify_admin_access(
    x_admin_key: Annotated[str | None, Header(alias="X-ADMIN-KEY")] = None,
) -> None:
    """Dependency to verify admin X-ADMIN-KEY header.
    
    Args:
        x_admin_key: Value of X-ADMIN-KEY header (FastAPI auto-extracts)
        
    Raises:
        HTTPException(401): Header missing
        HTTPException(403): Header present but wrong value
        
    Usage in route:
        @router.post("/admin/critical")
        def critical_op(db=Depends(get_db), _=Depends(verify_admin_access)):
            ...
    """
    provided_key = (x_admin_key or "").strip()
    if not provided_key:
        logger.warning("[ADMIN ACCESS] Unauthorized attempt: missing key")
        raise HTTPException(status_code=401, detail="Admin key required")

    expected_key = _resolve_admin_secret_key()
    if not expected_key or not secrets.compare_digest(provided_key, expected_key):
        logger.warning("[ADMIN ACCESS] Unauthorized attempt: invalid key")
        raise HTTPException(status_code=403, detail="Invalid admin key")

    logger.info("[ADMIN ACCESS] Request authorized")
