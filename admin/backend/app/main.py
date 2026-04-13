import logging
import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis import Redis
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from shared import models  # noqa: F401
from shared.config import settings
from shared.db.base import Base
from shared.db.session import engine

from app.api import auth, dashboard, reports, students, tokens, student_db, companies


logger = logging.getLogger("admin.startup")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Interview Copilot Admin API")

cors_origins = [
    origin.strip()
    for origin in settings.CORS_ORIGINS.split(",")
    if origin.strip()
]
if "http://localhost:3001" not in cors_origins:
    cors_origins.append("http://localhost:3001")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)

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


app.include_router(auth.router, prefix="/auth")
app.include_router(dashboard.router, prefix="/dashboard")
app.include_router(students.router, prefix="/students")
app.include_router(student_db.router, prefix="/student-db")
app.include_router(companies.router)
app.include_router(tokens.router)
app.include_router(reports.router)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
