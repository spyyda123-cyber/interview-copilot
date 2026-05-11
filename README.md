# Interview Copilot — Complete Setup & Run Guide

> AI-powered interview preparation platform for students, college admins, and platform super admins.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Clone the Repository](#4-clone-the-repository)
5. [Environment Variables Setup](#5-environment-variables-setup)
6. [Infrastructure Setup (PostgreSQL + Redis)](#6-infrastructure-setup-postgresql--redis)
7. [Database Migrations & Seeding](#7-database-migrations--seeding)
8. [Backend Setup & Run](#8-backend-setup--run)
9. [Celery Worker (AI Background Tasks)](#9-celery-worker-ai-background-tasks)
10. [Frontend Setup & Run](#10-frontend-setup--run)
11. [Access URLs](#11-access-urls)
12. [Default Credentials](#12-default-credentials)
13. [How the AI Study Plan Works](#13-how-the-ai-study-plan-works)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Project Overview

Interview Copilot is a multi-service AI platform that generates personalized interview preparation plans for students based on:

- **Company** — the target company the student is interviewing at
- **Role** — the specific job role (Java Backend Developer, ML Engineer, etc.)
- **Current Skill Proficiency** — student's known skills with Advanced/Intermediate/Beginner levels
- **Time Left for Interview** — days remaining until the interview date
- **Job Description** — the actual JD text uploaded by the student
- **Type of Mentor** — Guided coaching / Self-paced / Adaptive learning style

The AI generates a day-by-day study plan with Q&A, quizzes, coding mock tests, and behavioral interview prep — all tailored to the specific company, role, and student profile.

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
├── docker-compose.yml         # PostgreSQL + Redis
└── deploy/                    # EC2 deployment scripts
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

---

## 3. Prerequisites

Install these before starting:

| Tool | Version | Download |
|---|---|---|
| **Python** | 3.11 or 3.12 | https://python.org/downloads |
| **Node.js** | 20+ | https://nodejs.org |
| **Docker Desktop** | Latest | https://docker.com/products/docker-desktop |
| **Git** | Latest | https://git-scm.com |

> **Windows users:** Also install [Git Bash](https://git-scm.com/download/win) for running shell commands.

Verify installations:
```powershell
python --version    # Should show 3.11.x or 3.12.x
node --version      # Should show v20.x.x or higher
docker --version    # Should show Docker version 24+
git --version       # Should show git version 2.x
```

---

## 4. Clone the Repository

```powershell
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd interview-copilot
```

> Replace `YOUR_USERNAME/YOUR_REPO_NAME` with the actual GitHub repository URL.

---

## 5. Environment Variables Setup

You need to create `.env` files for each service. Copy the examples and fill in your API keys.

### 5.1 — Student Backend (MOST IMPORTANT)

```powershell
cd student\backend
copy .env.example .env
```

Open `student/backend/.env` and fill in:

```env
APP_NAME=Interview CoPilot
ENV=dev
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/interview_copilot
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# LLM Provider — choose "openai" or "gemini"
LLM_PROVIDER=openai

# OpenAI API Key (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY_HERE
OPENAI_GENERATION_MODEL=gpt-4o
OPENAI_FALLBACK_MODEL=gpt-4o-mini

# Gemini API Key (get from https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=YOUR_GEMINI_KEY_HERE
GEMINI_GENERATION_MODEL=models/gemini-1.5-flash

# AWS S3 (for resume/marksheet file storage)
USE_S3_STORAGE=false
AWS_ACCESS_KEY_ID=YOUR_AWS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET
AWS_S3_BUCKET_NAME=interview-copilot-files
AWS_S3_REGION=ap-south-1

# Security
ADMIN_SECRET_KEY=any-random-secret-string-here
JWT_SECRET_KEY=another-random-secret-string-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=8

# CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002

# File Storage (used when USE_S3_STORAGE=false)
UPLOAD_DIR=storage/resumes
KNOWLEDGE_DIR=storage/knowledge
```

> **Minimum required:** `OPENAI_API_KEY` OR `GEMINI_API_KEY` (at least one LLM key is needed for AI plan generation).

### 5.2 — Student Frontend

```powershell
cd student\frontend
copy .env.example .env.local
```

`student/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8010
```

### 5.3 — Admin Frontend

```powershell
cd admin\frontend
copy .env.example .env.local
```

`admin/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8020
```

### 5.4 — Super Admin Frontend

```powershell
cd super-admin\frontend
copy .env.example .env.local
```

`super-admin/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8030
```

---

## 6. Infrastructure Setup (PostgreSQL + Redis)

Start PostgreSQL and Redis using Docker:

```powershell
# From the project root (interview-copilot/)
docker compose up -d
```

Verify they're running:
```powershell
docker ps
```

You should see two containers:
- `interview-copilot-postgres-1` (or similar)
- `interview-copilot-redis-1` (or similar)

> **Note:** Docker Desktop must be running before this step.

---

## 7. Database Migrations & Seeding

### 7.1 — Set up PYTHONPATH

**Windows PowerShell** — run this once per terminal session:
```powershell
$env:PYTHONPATH="C:\path\to\your\interview-copilot"
```

> Replace `C:\path\to\your\interview-copilot` with the actual full path to the `interview-copilot` folder.

### 7.2 — Run Migrations

```powershell
cd student\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

Run database migrations:
```powershell
# From student/backend with venv activated
python -c "
import sys
sys.path.insert(0, '.')
from app.db.session import engine
from app.models import *
from shared.db.base import Base
Base.metadata.create_all(bind=engine)
print('Database tables created successfully')
"
```

### 7.3 — Seed Super Admin Account

```powershell
# From student/backend with venv activated and PYTHONPATH set
python ..\..\shared\seed_super_admin.py --email admin2@platform.com --password admin2@platform.com --name "Super Admin" --college-name "Platform"
```

This creates the super admin account used to log into the Super Admin console.

---

## 8. Backend Setup & Run

Open **6 separate terminal windows** (or PowerShell tabs). Run each command in its own terminal.

### Terminal 1 — Student Backend (Port 8010)

```powershell
cd "interview-copilot\student\backend"
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH="C:\path\to\your\interview-copilot"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

Expected output:
```
INFO: Uvicorn running on http://0.0.0.0:8010
INFO: Application startup complete.
```

### Terminal 2 — Admin Backend (Port 8020)

```powershell
cd "interview-copilot\admin\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH="C:\path\to\your\interview-copilot"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8020 --reload
```

### Terminal 3 — Super Admin Backend (Port 8030)

```powershell
cd "interview-copilot\super-admin\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH="C:\path\to\your\interview-copilot"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8030 --reload
```

---

## 9. Celery Worker (AI Background Tasks)

The Celery worker processes AI plan generation in the background. **This must be running for AI study plans to generate.**

### Terminal 4 — Celery Worker

```powershell
cd "interview-copilot\student\backend"
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH="C:\path\to\your\interview-copilot"
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo
```

Expected output:
```
celery@HOSTNAME ready.
[INFO] Connected to redis://localhost:6379/0
```

> **Important:** Without the Celery worker, AI plans will use a fallback rule-based plan instead of the personalized AI-generated plan.

---

## 10. Frontend Setup & Run

### Terminal 5 — Student Frontend (Port 3000)

```powershell
cd "interview-copilot\student\frontend"
npm install
npm run dev -- --port 3000
```

### Terminal 6 — Admin Frontend (Port 3001)

```powershell
cd "interview-copilot\admin\frontend"
npm install
npm run dev -- --port 3001
```

### Terminal 7 — Super Admin Frontend (Port 3002)

```powershell
cd "interview-copilot\super-admin\frontend"
npm install
npm run dev -- --port 3002
```

---

## 11. Access URLs

Once all services are running:

| App | URL | Purpose |
|---|---|---|
| **Student App** | http://localhost:3000 | Students sign up, upload resume, get AI study plan |
| **Admin Console** | http://localhost:3001 | College admins manage students and placements |
| **Super Admin** | http://localhost:3002 | Platform admins manage colleges and tokens |
| Student API Docs | http://localhost:8010/docs | FastAPI Swagger UI |
| Admin API Docs | http://localhost:8020/docs | FastAPI Swagger UI |
| Super Admin API Docs | http://localhost:8030/docs | FastAPI Swagger UI |

---

## 12. Default Credentials

After seeding, use these to log in:

| Console | URL | Email | Password |
|---|---|---|---|
| **Super Admin** | http://localhost:3002 | admin2@platform.com | admin2@platform.com |
| **College Admin (PSG)** | http://localhost:3001 | psgtech@gmail.com | PsgTech@123 |
| **College Admin (Demo)** | http://localhost:3001 | collegeadmin@demo.com | CollegeAdmin@123 |

> **To create college admin accounts**, log into the Super Admin console first, create a college, then create a college admin user.

---

## 13. How the AI Study Plan Works

The AI generates a personalized study plan based on these 6 key inputs:

| Input | Where it comes from | How AI uses it |
|---|---|---|
| **Company** | Student activates a placement | Tailors behavioral tasks ("Why [Company]?"), references company domain |
| **Role** | Job description analysis | Determines ALL technical content (Java role → Java plan, ML role → Python/ML plan) |
| **Skill Proficiency** | Student onboarding (Advanced/Intermediate/Beginner) | Advanced = polish tasks; Beginner + required by JD = intensive study |
| **Time Left** | Interview date from placement | ≤3 days = Sprint mode; >7 days = Full roadmap |
| **Job Description** | Student uploads JD text | Missing skills from JD appear in Day 1-2 as highest priority |
| **Type of Mentor** | Student onboarding (Guided/Self-paced/Adaptive) | Guided = step-by-step explanations; Self-paced = concise tasks |

### Student Flow (Step by Step)

```
1. Student signs up at localhost:3000
2. Student completes onboarding (skills, mentor type, tone)
3. Admin approves student for a company placement
4. Student activates the placement → AI plan generation starts
5. Student uploads resume → gap analysis runs
6. AI generates personalized day-by-day study plan
7. Student studies using Q&A, quizzes, coding sandbox, behavioral prep
```

---

## 14. Troubleshooting

### "ModuleNotFoundError: No module named 'shared'"
Set PYTHONPATH before running any backend:
```powershell
$env:PYTHONPATH="C:\full\path\to\interview-copilot"
```

### "Connection refused" on port 5432 or 6379
Docker containers aren't running. Start them:
```powershell
docker compose up -d
```

### "AI is generating your plan..." never completes
The Celery worker isn't running. Start Terminal 4 (Celery Worker).

### Plan shows Java content for Python role
Reset the plan to regenerate with the correct role:
1. Open browser DevTools (F12) → Console
2. Run: `console.log(sessionStorage.getItem('student_id'), sessionStorage.getItem('target_id'))`
3. Run: `fetch('http://localhost:8010/prep/reset/STUDENT_ID?target_id=TARGET_ID', {method:'DELETE'}).then(r=>r.json()).then(console.log)`

### "bcrypt version" warning in logs
This is harmless — it's a passlib compatibility warning with newer bcrypt versions. The app works correctly.

### Port already in use
Kill the process using the port:
```powershell
# Find process on port 8010
netstat -ano | findstr :8010
# Kill it (replace PID with the number shown)
taskkill /PID <PID> /F
```

### npm install fails
Clear npm cache and retry:
```powershell
npm cache clean --force
npm install
```

---

## Quick Start Summary

```
Terminal 1:  docker compose up -d                          (Infrastructure)
Terminal 2:  cd student\backend  → uvicorn --port 8010     (Student API)
Terminal 3:  cd admin\backend    → uvicorn --port 8020     (Admin API)
Terminal 4:  cd super-admin\backend → uvicorn --port 8030  (Super Admin API)
Terminal 5:  cd student\backend  → celery worker           (AI Worker)
Terminal 6:  cd student\frontend → npm run dev --port 3000 (Student App)
Terminal 7:  cd admin\frontend   → npm run dev --port 3001 (Admin App)
Terminal 8:  cd super-admin\frontend → npm run dev --port 3002 (Super Admin)
```

---

*Built with FastAPI, Next.js, PostgreSQL, Redis, Celery, OpenAI GPT-4o, and Google Gemini.*
