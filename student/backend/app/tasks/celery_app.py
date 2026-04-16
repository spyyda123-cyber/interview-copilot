from pathlib import Path
import logging

from dotenv import load_dotenv
from celery import Celery
from kombu import Queue

load_dotenv()

env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(env_path)

from app.core.config import settings

logger = logging.getLogger("app.celery")
logging.basicConfig(level=logging.INFO)
logger.info("[CELERY] GEMINI KEY LOADED: %s", "YES" if settings.GEMINI_API_KEY else "NO")

celery_app = Celery(
    "interview_copilot",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Ensure task modules are imported in worker process for registration
from app.tasks import jobs  # noqa: F401,E402

celery_app.conf.update(
    broker_connection_retry_on_startup=True,
    task_default_queue="default",
    task_queues=(
        Queue("default"),
        Queue("llm"),
    ),
    task_routes={
        "app.tasks.jobs.generate_plan_summary": {"queue": "llm"},
    }
)
