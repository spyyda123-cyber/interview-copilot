from typing import Any, Dict

from fastapi import APIRouter
from redis import Redis
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine
from app.utils.celery_check import has_active_workers

router = APIRouter(prefix="/system", tags=["system"])


def _check_database() -> tuple[str, str | None]:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return "ok", None
    except Exception as exc:
        return "error", str(exc)


def _check_redis() -> tuple[str, str | None]:
    try:
        client = Redis.from_url(settings.REDIS_URL)
        client.ping()
        client.close()
        return "ok", None
    except Exception as exc:
        return "error", str(exc)


def _check_celery() -> tuple[str, str | None]:
    try:
        return ("running", None) if has_active_workers() else ("not_detected", None)
    except Exception as exc:
        return "not_detected", str(exc)


def _check_openai_key() -> str:
    return "present" if settings.OPENAI_API_KEY else "missing"


@router.get("/status")
def system_status() -> Dict[str, Any]:
    database_status, database_error = _check_database()
    redis_status, redis_error = _check_redis()
    celery_status, celery_error = _check_celery()

    details = {
        key: value
        for key, value in {
            "database": database_error,
            "redis": redis_error,
            "celery_worker": celery_error,
        }.items()
        if value
    }

    response: Dict[str, Any] = {
        "api": "ok",
        "database": database_status,
        "redis": redis_status,
        "celery_worker": celery_status,
        "openai_key": _check_openai_key(),
    }

    if details:
        response["details"] = details

    return response
