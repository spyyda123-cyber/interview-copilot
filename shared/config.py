from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Interview CoPilot"
    ENV: str = "dev"

    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/interview_copilot"
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    OPENAI_API_KEY: str = ""
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENAI_GENERATION_MODEL: str = "gpt-4o"
    OPENAI_FALLBACK_MODEL: str = "gpt-4o-mini"
    GEMINI_API_KEY: str = ""
    GEMINI_EMBEDDING_MODEL: str = "models/text-embedding-004"
    GEMINI_GENERATION_MODEL: str = "gemini-1.5-flash-latest"
    # LLM provider: "openai" uses GPT-4 API, "gemini" uses Gemini API
    LLM_PROVIDER: str = "openai"

    UPLOAD_DIR: str = "storage/resumes"
    KNOWLEDGE_DIR: str = "storage/knowledge"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # AWS S3 Storage
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET_NAME: str = "interview-copilot-files"
    AWS_S3_REGION: str = "ap-south-1"
    USE_S3_STORAGE: bool = False
    ADMIN_SECRET_KEY: str = ""
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8
    model_config = {
        "env_file": (".env", str(Path(__file__).resolve().parents[1] / ".env")),
        "case_sensitive": True
    }


settings = Settings()


def masked_gemini_key() -> str:
    key = settings.GEMINI_API_KEY or ""
    if not key:
        return "missing"
    return f"{key[:6]}******"

