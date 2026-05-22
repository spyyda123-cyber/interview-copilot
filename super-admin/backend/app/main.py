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

from app.api import auth, colleges, dashboard, tokens, token_requests


logger = logging.getLogger("super_admin.startup")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Interview Copilot Super Admin API")

cors_origins = {
    origin.strip()
    for origin in settings.CORS_ORIGINS.split(",")
    if origin.strip()
}
cors_origins.add("http://localhost:3002")

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(cors_origins),
    allow_origin_regex=r"https://.*\.vercel\.app",
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
app.include_router(colleges.router, prefix="/colleges")
app.include_router(tokens.router)
app.include_router(token_requests.router)


@app.get("/health")
@app.head("/health")
def health_check() -> dict:
    return {"status": "ok"}
