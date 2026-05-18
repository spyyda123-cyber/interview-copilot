import logging
import os
import sys

from fastapi import FastAPI
from redis import Redis
from sqlalchemy import text
from celery.exceptions import CeleryError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from app.api import (
    admin,
    company,
    knowledge,
    auth,
    resume,
    system,
    student,
    target,
    prep,
    scorm,
    feedback,
    placement,
    topic,
)
from app.core.config import masked_gemini_key, settings
from app.db.base import Base
from app.db.session import create_extension, engine, init_db
from app import models  # noqa: F401
from fastapi.middleware.cors import CORSMiddleware
from app.tasks.celery_app import celery_app



logger = logging.getLogger("app.startup")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title=settings.APP_NAME)

cors_origins = [
    origin.strip()
    for origin in settings.CORS_ORIGINS.split(",")
    if origin.strip()
]
logger.info("[CORS] Allowed Origins: %s", cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup() -> None:
    logger.info("[PLAN-TRACE] Gemini key detected: %s", masked_gemini_key())
    create_extension()
    Base.metadata.create_all(bind=engine)
    init_db()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connected")
    except Exception as exc:
        logger.warning("Database connection failed: %s", exc)

    try:
        client = Redis.from_url(settings.REDIS_URL)
        client.ping()
        client.close()
        logger.info("Redis reachable")
    except Exception as exc:
        logger.warning("Redis unreachable: %s", exc)

    try:
        with celery_app.connection() as connection:
            connection.ensure_connection(max_retries=1)
        logger.info("Celery broker reachable")
    except (CeleryError, Exception) as exc:
        logger.warning("Celery broker unreachable: %s", exc)


app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(student.router)
app.include_router(target.router)
app.include_router(resume.router)
app.include_router(prep.router)
app.include_router(company.router)
app.include_router(knowledge.router)
app.include_router(system.router)
app.include_router(scorm.router)
app.include_router(feedback.router)
app.include_router(placement.router)
app.include_router(topic.router)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
