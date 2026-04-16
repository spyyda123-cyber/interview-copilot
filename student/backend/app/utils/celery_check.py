from redis import Redis

from app.core.config import settings
from app.tasks.celery_app import celery_app


def _ping_worker() -> bool:
    try:
        response = celery_app.control.ping(timeout=1)
        return bool(response)
    except Exception:
        return False


def _check_redis_consumers() -> bool:
    try:
        client = Redis.from_url(settings.REDIS_URL)
        queue_exists = bool(client.exists("celery"))
        clients = client.client_list()
        client.close()
    except Exception:
        return False

    if not queue_exists or not clients:
        return False

    for entry in clients:
        cmd = (entry.get("cmd") or "").lower()
        if cmd in {"brpop", "brpoplpush"}:
            return True

    return False


def has_active_workers() -> bool:
    if _ping_worker():
        return True

    return _check_redis_consumers()
