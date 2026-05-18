# Interview Copilot

> AI-powered interview preparation platform for students, college admins, and platform super admins.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Clone the Repository](#4-clone-the-repository)
5. [Option A — Run Locally (Developer Setup)](#5-option-a--run-locally-developer-setup)
6. [Option B — Run on EC2 (Production Setup)](#6-option-b--run-on-ec2-production-setup)
7. [Access URLs & Credentials](#7-access-urls--credentials)
8. [How the AI Study Plan Works](#8-how-the-ai-study-plan-works)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Project Overview

Interview Copilot is a multi-service AI platform that generates personalized interview preparation plans for students based on:

| Input | Description |
|---|---|
| **Company** | Target company the student is interviewing at |
| **Role** | Specific job role (Java Backend Developer, ML Engineer, etc.) |
| **Skill Proficiency** | Student's known skills with Advanced / Intermediate / Beginner levels |
| **Time Left** | Days remaining until the interview date |
| **Job Description** | Actual JD text uploaded by the student |
| **Type of Mentor** | Guided coaching / Self-paced / Adaptive learning style |

The AI generates a day-by-day study plan with Q&A pairs, quizzes, coding mock tests, and behavioral interview prep — all tailored to the specific company, role, and student profile.

---

## 2. Architecture

```
interview-copilot/
├── shared/                    # Shared DB models, auth, config
├── student/
│   ├── backend/               # FastAPI — port 8010
│   └── frontend/              # Next.js — port 3000
├── admin/
│   ├── backend/               # FastAPI — port 8020
│   └── frontend/              # Next.js — port 3001
├── super-admin/
│   ├── backend/               # FastAPI — port 8030
│   └── frontend/              # Next.js — port 3002
├── docker-compose.yml         # Local: PostgreSQL + Redis only
└── deploy/
    ├── docker-compose.prod.yml  # EC2: all services in Docker
    ├── deploy_to_ec2.sh         # EC2 deployment script
    └── .env.prod                # EC2 environment variables (template)
```

**Services:**

| Service | Port | Purpose |
|---|---|---|
| Student Backend | 8010 | Student APIs, AI plan generation |
| Admin Backend | 8020 | College admin APIs |
| Super Admin Backend | 8030 | Platform management APIs |
| Student Frontend | 3000 | Student app |
| Admin Frontend | 3001 | College admin console |
| Super Admin Frontend | 3002 | Platform super admin console |
| PostgreSQL | 5432 | Main database |
| Redis | 6379 | Celery task queue |
| Celery Worker | — | AI background task processor |

---

## 3. Prerequisites

### For Local Development

| Tool | Version | Download |
|---|---|---|
| **Python** | 3.10+ | https://python.org/downloads |
| **Node.js** | 18+ | https://nodejs.org |
| **Docker Desktop** | Latest | https://docker.com/products/docker-desktop |
| **Git** | Latest | https://git-scm.com |

### For EC2 Deployment (Production)

- AWS account (e.g. t2.medium or t3.small recommended due to memory requirements)
- OpenAI API key **or** Gemini API key
- SSH key pair (.pem file) for your EC2 instance

---

## 4. Clone the Repository

```bash
git clone https://github.com/spyyda-tech/interview-copilot-frontend.git
cd interview-copilot-frontend
```

---

## 5. Option A — Run Locally (Developer Setup)

Follow these steps to set up the project on your local machine for development.

### Step 1 — Start Infrastructure (PostgreSQL + Redis)

Make sure Docker Desktop is running, then from the project root:

```bash
docker compose up -d
```

### Step 2 — Backend Configurations

Copy the `.env.example` templates to `.env` files in `student/backend/.env`. A standard development `.env` should look like this:

```env
APP_NAME=Interview CoPilot
ENV=dev
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/interview_copilot
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# LLM Config (Primary model is Gemini 2.5 Pro)
LLM_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_GENERATION_MODEL=gemini-2.5-pro
GEMINI_FALLBACK_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=models/text-embedding-004

# Security
ADMIN_SECRET_KEY=local-dev-admin-secret-key-2026
JWT_SECRET_KEY=local-dev-jwt-secret-key-2026
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=8

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
```

### Step 3 — Run Database Migrations & Seeds

Open a terminal at the project root:

```bash
cd shared
python -m venv .venv
# Activate venv:
# Windows: .\.venv\Scripts\Activate.ps1
# Mac/Linux: source .venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt

# Run migrations to create tables
python run_alembic.py

# Seed the super-admin account
python seed_super_admin.py --email admin@interviewcopilot.com --password adminpassword --name "Super Admin"
cd ..
```

### Step 4 — Start All Backend APIs

Open three separate terminals from the project root. For each service, create a virtual environment, install requirements, and run Uvicorn.

**Terminal 1 — Student Backend:**
```bash
cd student/backend
python -m venv .venv
source .venv/bin/activate      # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

**Terminal 2 — Admin Backend:**
```bash
cd admin/backend
python -m venv .venv
source .venv/bin/activate      # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8020 --reload
```

**Terminal 3 — Super Admin Backend:**
```bash
cd super-admin/backend
python -m venv .venv
source .venv/bin/activate      # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8030 --reload
```

### Step 5 — Start Celery Worker (Required for AI Plans)

**Terminal 4 — Celery Worker:**
```bash
cd student/backend
source .venv/bin/activate      # Windows: .\.venv\Scripts\Activate.ps1

# Export PYTHONPATH to the project root so Celery can find the 'shared' module
# Mac/Linux: export PYTHONPATH=$(pwd)/../../
# Windows: $env:PYTHONPATH="$(pwd)\..\..\"

celery -A app.tasks.celery_app worker --loglevel=info --pool=solo
```

### Step 6 — Start Frontends

For each Next.js app, create a `.env.local` file with the correct API URL:
- `student/frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8010`
- `admin/frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8020`
- `super-admin/frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8030`

**Terminal 5 — Student Frontend:**
```bash
cd student/frontend
npm install
npm run dev -- -p 3000
```

**Terminal 6 — Admin Frontend:**
```bash
cd admin/frontend
npm install
npm run dev -- -p 3001
```

**Terminal 7 — Super Admin Frontend:**
```bash
cd super-admin/frontend
npm install
npm run dev -- -p 3002
```

---

## 6. Option B — Run on EC2 (Production Setup)

The production setup uses Docker Compose to run all APIs and background workers in containerized environments. The frontends (Next.js apps) can be hosted on Vercel, Netlify, or AWS Amplify, pointing to the EC2 API endpoint.

### Step 1 — SSH into your EC2 Instance

```bash
ssh -i ~/.ssh/interview-copilot-key.pem ubuntu@<YOUR_EC2_IP>
```

### Step 2 — Clone/Update Repository on EC2

```bash
git clone https://github.com/spyyda-tech/interview-copilot-frontend.git ~/interview-copilot
cd ~/interview-copilot

# To update existing repo later:
# git pull origin main
```

### Step 3 — Configure Production Environment Variables

```bash
cd ~/interview-copilot/deploy
cp .env.prod.template .env.prod
nano .env.prod
```

Configure your secure passwords, `GEMINI_API_KEY`, AWS S3 credentials, and the production `CORS_ORIGINS` (including the frontend URLs).

### Step 4 — Deploy Services

Run the deployment script, which will install Docker (if missing), build the containers, and start them:

```bash
cd ~/interview-copilot/deploy
chmod +x deploy_to_ec2.sh
./deploy_to_ec2.sh
```

### Step 5 — Verify Deployment

```bash
sudo docker ps
```

You should see the following containers running successfully:
- `copilot_student_api`
- `copilot_admin_api`
- `copilot_super_admin_api`
- `copilot_celery_worker`
- `copilot_db`
- `copilot_redis`

Health check:
```bash
curl http://localhost:8010/health
```

### Important EC2 Operations

**Rebuild APIs after pulling latest Git changes:**
```bash
cd ~/interview-copilot/deploy
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache student-api celery-worker
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate
```

**View Logs:**
```bash
sudo docker logs copilot_student_api --tail=50 -f
sudo docker logs copilot_celery_worker --tail=50 -f
```

---

## 7. Access URLs & Credentials

### URLs

| App | Local URL |
|---|---|
| **Student App** | http://localhost:3000 |
| **Admin Console** | http://localhost:3001 |
| **Super Admin** | http://localhost:3002 |
| Student API Docs | http://localhost:8010/docs |
| Admin API Docs | http://localhost:8020/docs |
| Super Admin API Docs | http://localhost:8030/docs |

### Default Login Credentials

| Console | Email | Password | Role |
|---|---|---|---|
| **Super Admin** | admin@interviewcopilot.com | adminpassword | Platform super admin (from seed) |

> **Student accounts** are created by students themselves via the signup page.  
> **College admin accounts** are created by the super admin via the Super Admin console.

---

## 8. How the AI Study Plan Works

1. Student signs up and completes onboarding.
2. College admin approves the student for a specific placement (Company + Role + JD).
3. Student activates the placement → AI plan generation starts as a Celery background task.
4. AI generates a personalized day-by-day study plan (using Gemini 2.5 Pro).
5. Student studies using AI-generated Q&A pairs, topic summaries, coding sandboxes, and behavioral scenarios.

---

## 9. Troubleshooting

### "ModuleNotFoundError: No module named 'shared'"
Make sure `PYTHONPATH` is set correctly so Python can resolve the absolute import paths from the project root.
- **Mac/Linux:** `export PYTHONPATH=$(pwd)/../../` (from `student/backend`)
- **Windows:** `$env:PYTHONPATH="C:\path\to\project\root"`

### AI Plan generation hangs locally
Ensure the **Celery worker** (Terminal 4) is running and correctly connected to your local Redis instance (`redis://localhost:6379/0`).

### "Connection refused" on Port 5432
Ensure Docker Desktop is running and `docker compose up -d` has been executed to spin up PostgreSQL.

*Built with FastAPI · Next.js · PostgreSQL · Redis · Celery · Google Gemini 2.5 Pro*
