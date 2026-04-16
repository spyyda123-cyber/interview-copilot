# Interview CoPilot

Production-ready MVP for AI-powered interview preparation.

## Features
- Resume upload and parsing (PDF)
- Resume section extraction
- Company knowledge ingestion with embeddings (pgvector)
- Retrieval Augmented Generation for interview prep
- Learning plan generation
- Background processing with Celery + Redis

## Tech Stack
- FastAPI (Python 3.11)
- PostgreSQL + pgvector
- SQLAlchemy ORM
- Redis + Celery
- OpenAI API

## Local Setup
1. Copy environment file:

```
cp .env.example .env
```

2. Start Postgres + Redis:

```
docker compose up -d
```

3. Install dependencies:

```
python -m venv .venv
. .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

4. Run the API:

```
uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
```

Windows shortcut:

```
./start-api.ps1
```

This command ensures Postgres and Redis are running, then starts the API server.
The API will be available at `http://localhost:8010`.

5. Run the Celery worker:

```
celery -A app.tasks.celery_app.celery_app worker --loglevel=info
```

### One-command worker startup (Windows)

This starts Redis (if not running) and then starts the Celery worker:

```
./start-worker.ps1
```

To stop only the Celery worker:

```
./stop-worker.ps1
```

To stop both Celery worker and Redis:

```
./stop-services.ps1
```

## API Endpoints
- POST /resume/upload
- POST /company/analyze
- POST /plan/generate

## Notes
- Ensure `OPENAI_API_KEY` is set in `.env`.
- Resume parsing and plan generation are processed asynchronously by Celery.
