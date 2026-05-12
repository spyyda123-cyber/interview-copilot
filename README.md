# Interview Copilot

> AI-powered interview preparation platform for students, college admins, and platform super admins.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Clone the Repository](#4-clone-the-repository)
5. [Option A — Run Locally (Windows)](#5-option-a--run-locally-windows)
6. [Option B — Run on EC2 (Production)](#6-option-b--run-on-ec2-production)
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
    ├── deploy.sh                # One-click EC2 deployment script
    └── .env.prod.template       # EC2 environment variables template
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

### For Local Development (Windows)

| Tool | Version | Download |
|---|---|---|
| **Python** | 3.11 or 3.12 | https://python.org/downloads |
| **Node.js** | 20+ | https://nodejs.org |
| **Docker Desktop** | Latest | https://docker.com/products/docker-desktop |
| **Git** | Latest | https://git-scm.com |

Verify:
```powershell
python --version    # 3.11.x or 3.12.x
node --version      # v20.x.x or higher
docker --version    # Docker version 24+
git --version       # git version 2.x
```

### For EC2 Deployment

- AWS account (free tier works — t2.micro)
- OpenAI API key **or** Gemini API key
- SSH key pair (.pem file) for your EC2 instance

---

## 4. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd interview-copilot
```

> Replace `YOUR_USERNAME/YOUR_REPO_NAME` with the actual GitHub URL.

---

## 5. Option A — Run Locally (Windows)

Use this if you want to run the project on your own Windows machine for development.

### Step 1 — Start Infrastructure (PostgreSQL + Redis)

Make sure Docker Desktop is running, then:

```powershell
# From the project root: interview-copilot/
docker compose up -d
```

Verify:
```powershell
docker ps
# Should show: postgres container + redis container
```

---

### Step 2 — Set Up Student Backend

Open **Terminal 1**:

```powershell
cd "interview-copilot\student\backend"

# Create virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

Create the `.env` file:

```powershell
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

# Choose "openai" or "gemini"
LLM_PROVIDER=openai

# OpenAI (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
OPENAI_GENERATION_MODEL=gpt-4o
OPENAI_FALLBACK_MODEL=gpt-4o-mini

# Gemini (get from https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=YOUR_GEMINI_KEY_HERE
GEMINI_GENERATION_MODEL=models/gemini-1.5-flash

# Security (any random strings)
ADMIN_SECRET_KEY=any-random-secret-string
JWT_SECRET_KEY=another-random-secret-string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=8

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002

# File storage
UPLOAD_DIR=storage/resumes
KNOWLEDGE_DIR=storage/knowledge
```

---

### Step 3 — Run Database Migrations

Still in **Terminal 1** (student/backend, venv active):

```powershell
# Set PYTHONPATH — replace the path with your actual project root
$env:PYTHONPATH="D:\17.3interview copilot\interview copilot\interview-copilot"

# Create all database tables
python -c "
from app.db.session import engine
from app.models import *
from shared.db.base import Base
Base.metadata.create_all(bind=engine)
print('Database tables created successfully')
"
```

---

### Step 4 — Seed Super Admin Account

```powershell
# Still in student/backend with venv active and PYTHONPATH set
python ..\..\shared\seed_super_admin.py --email admin2@platform.com --password admin2@platform.com --name "Super Admin" --college-name "Platform"
```

---

### Step 5 — Start All Backends

**Terminal 1 — Student Backend (port 8010):**

```powershell
cd "interview-copilot\student\backend"
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH="D:\17.3interview copilot\interview copilot\interview-copilot"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

**Terminal 2 — Admin Backend (port 8020):**

```powershell
cd "interview-copilot\admin\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH="D:\17.3interview copilot\interview copilot\interview-copilot"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8020 --reload
```

**Terminal 3 — Super Admin Backend (port 8030):**

```powershell
cd "interview-copilot\super-admin\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH="D:\17.3interview copilot\interview copilot\interview-copilot"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8030 --reload
```

---

### Step 6 — Start Celery Worker (Required for AI Plans)

**Terminal 4 — Celery Worker:**

```powershell
cd "interview-copilot\student\backend"
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH="D:\17.3interview copilot\interview copilot\interview-copilot"
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo
```

Expected output:
```
celery@HOSTNAME ready.
[INFO] Connected to redis://localhost:6379/0
```

> **Without this running**, AI study plans will fall back to a rule-based plan instead of the personalized GPT-4o plan.

---

### Step 7 — Set Up Frontends

**Terminal 5 — Student Frontend (port 3000):**

```powershell
cd "interview-copilot\student\frontend"
npm install
```

Create `student/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8010
```

```powershell
npm run dev -- --port 3000
```

**Terminal 6 — Admin Frontend (port 3001):**

```powershell
cd "interview-copilot\admin\frontend"
npm install
```

Create `admin/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8020
```

```powershell
npm run dev -- --port 3001
```

**Terminal 7 — Super Admin Frontend (port 3002):**

```powershell
cd "interview-copilot\super-admin\frontend"
npm install
```

Create `super-admin/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8030
```

```powershell
npm run dev -- --port 3002
```

---

### Local Quick-Start Summary

```
Terminal 1:  docker compose up -d                                    ← Infrastructure
Terminal 2:  student\backend   → uvicorn --port 8010 --reload        ← Student API
Terminal 3:  admin\backend     → uvicorn --port 8020 --reload        ← Admin API
Terminal 4:  super-admin\backend → uvicorn --port 8030 --reload      ← Super Admin API
Terminal 5:  student\backend   → celery worker --pool=solo           ← AI Worker
Terminal 6:  student\frontend  → npm run dev --port 3000             ← Student App
Terminal 7:  admin\frontend    → npm run dev --port 3001             ← Admin App
Terminal 8:  super-admin\frontend → npm run dev --port 3002          ← Super Admin App
```

---

## 6. Option B — Run on EC2 (Production)

The project is currently deployed on EC2 at **`13.217.222.70`**.  
All backends run inside Docker containers. Frontends run locally and point to the EC2 APIs.

### Step 1 — SSH into EC2

```bash
ssh -i ~/.ssh/interview-copilot-key1.pem ubuntu@13.217.222.70
```

> If you get a permissions error on Windows (Git Bash):
> ```bash
> chmod 400 ~/.ssh/interview-copilot-key1.pem
> ```

---

### Step 2 — Upload Latest Code to EC2

Run this on your **Windows machine (Git Bash)**:

```bash
cd "D:/17.3interview copilot/interview copilot/interview-copilot"

# Create compressed archive (excludes heavy folders)
tar -czf /tmp/copilot.tar.gz \
  --exclude='.venv' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='__pycache__' \
  --exclude='.git' \
  .

# Upload to EC2
scp -i ~/.ssh/interview-copilot-key1.pem \
  /tmp/copilot.tar.gz \
  ubuntu@13.217.222.70:/home/ubuntu/
```

**OR** if your code is on GitHub, on the EC2 server:

```bash
cd ~/interview-copilot
git pull origin main
```

---

### Step 3 — Extract Code on EC2

On the **EC2 server** (SSH terminal):

```bash
rm -rf ~/interview-copilot
mkdir -p ~/interview-copilot
tar -xzf ~/copilot.tar.gz -C ~/interview-copilot
cd ~/interview-copilot
```

---

### Step 4 — Create the Production .env File

```bash
cd ~/interview-copilot/deploy
cp .env.prod.template .env.prod
nano .env.prod
```

Fill in your values (use the template as a guide):

```env
# Database
POSTGRES_PASSWORD=YourSecurePassword123!

# LLM
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY
OPENAI_GENERATION_MODEL=gpt-4o
OPENAI_FALLBACK_MODEL=gpt-4o-mini
GEMINI_API_KEY=YOUR_GEMINI_KEY

# AWS S3 (for file uploads)
USE_S3_STORAGE=true
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_KEY
AWS_S3_BUCKET_NAME=interview-copilot-files
AWS_S3_REGION=ap-south-1

# Security keys — generate with: python3 -c "import secrets; print(secrets.token_hex(32))"
ADMIN_SECRET_KEY=REPLACE_WITH_RANDOM_STRING
JWT_SECRET_KEY=REPLACE_WITH_ANOTHER_RANDOM_STRING

# CORS — include your EC2 IP
CORS_ORIGINS=http://13.217.222.70:3000,http://13.217.222.70:3001,http://13.217.222.70:3002,http://localhost:3000
```

Save and exit: `Ctrl+X` → `Y` → `Enter`

> **Note:** The `.env.prod` file already exists on the EC2 server from the initial deployment. You only need to update it if API keys or settings change.

---

### Step 5 — Deploy (Build & Start All Containers)

```bash
cd ~/interview-copilot/deploy
chmod +x deploy.sh
bash deploy.sh
```

This script will:
1. Install Docker (if not already installed)
2. Build all Docker images (~5 min first time, ~2 min after)
3. Start all containers: student-api, admin-api, super-admin-api, celery-worker, postgres, redis, nginx
4. Run database migrations
5. Print the live URLs

**Expected output at the end:**
```
╔══════════════════════════════════════════════════════╗
║   DEPLOYMENT COMPLETE! 🚀                           ║
╚══════════════════════════════════════════════════════╝

Your APIs are running at:
  Student API:     http://13.217.222.70:8010
  Admin API:       http://13.217.222.70:8020
  Super-Admin API: http://13.217.222.70:8030
```

---

### Step 6 — Verify All Containers Are Running

```bash
sudo docker ps
```

You should see **7 containers**:

| Container | Status |
|---|---|
| `copilot_student_api` | Up |
| `copilot_admin_api` | Up |
| `copilot_super_admin_api` | Up |
| `copilot_celery_worker` | Up |
| `copilot_db` | Up (healthy) |
| `copilot_redis` | Up (healthy) |
| `copilot_nginx` | Up |

Health check:
```bash
curl http://localhost:8010/health   # → {"status":"ok"}
curl http://localhost:8020/health   # → {"status":"ok"}
curl http://localhost:8030/health   # → {"status":"ok"}
```

---

### Step 7 — Point Frontends to EC2

On your **Windows machine**, update the frontend env files:

**`student/frontend/.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://13.217.222.70:8010
```

**`admin/frontend/.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://13.217.222.70:8020
```

**`super-admin/frontend/.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://13.217.222.70:8030
```

Then start the frontends locally (they call the EC2 backends):

```powershell
# Terminal 1 — Student Frontend
cd "interview-copilot\student\frontend"
npm install
npm run dev -- --port 3000

# Terminal 2 — Admin Frontend
cd "interview-copilot\admin\frontend"
npm install
npm run dev -- --port 3001

# Terminal 3 — Super Admin Frontend
cd "interview-copilot\super-admin\frontend"
npm install
npm run dev -- --port 3002
```

---

### EC2 Useful Commands

```bash
# Check all running containers
sudo docker ps

# View live logs
sudo docker logs copilot_student_api -f        # Student API
sudo docker logs copilot_celery_worker -f      # Celery AI worker
sudo docker logs copilot_db -f                 # Database
sudo docker logs copilot_redis -f              # Redis

# Restart a single service
sudo docker restart copilot_student_api
sudo docker restart copilot_celery_worker

# Rebuild and restart after code changes
cd ~/interview-copilot/deploy
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --force-recreate

# Rebuild only specific services (faster)
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --force-recreate student-api celery-worker

# Stop everything
sudo docker compose -f docker-compose.prod.yml down

# Check disk space
df -h

# Add swap space (if running out of memory on t2.micro)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 7. Access URLs & Credentials

### URLs

| App | Local URL | EC2 URL |
|---|---|---|
| **Student App** | http://localhost:3000 | Frontend runs locally, API at EC2 |
| **Admin Console** | http://localhost:3001 | Frontend runs locally, API at EC2 |
| **Super Admin** | http://localhost:3002 | Frontend runs locally, API at EC2 |
| Student API | http://localhost:8010 | http://13.217.222.70:8010 |
| Admin API | http://localhost:8020 | http://13.217.222.70:8020 |
| Super Admin API | http://localhost:8030 | http://13.217.222.70:8030 |
| Student API Docs | http://localhost:8010/docs | http://13.217.222.70:8010/docs |
| Admin API Docs | http://localhost:8020/docs | http://13.217.222.70:8020/docs |

### Default Login Credentials

| Console | Email | Password | Role |
|---|---|---|---|
| **Super Admin** | admin2@platform.com | admin2@platform.com | Platform super admin |
| **College Admin (PSG)** | psgtech@gmail.com | PsgTech@123 | College admin |
| **College Admin (Demo)** | collegeadmin@demo.com | CollegeAdmin@123 | College admin |

> **Student accounts** are created by students themselves via the signup page at http://localhost:3000.  
> **College admin accounts** are created by the super admin via the Super Admin console.

---

## 8. How the AI Study Plan Works

### Student Flow

```
1. Student signs up at localhost:3000
2. Student completes onboarding (skills, mentor type, tone preference)
3. Super admin creates a college → creates a college admin
4. College admin creates a placement (company + role + JD)
5. College admin approves the student for the placement
6. Student activates the placement → AI plan generation starts (Celery task)
7. Student uploads resume → gap analysis runs automatically
8. AI generates personalized day-by-day study plan (GPT-4o)
9. Student studies using:
   - Q&A pairs with detailed explanations
   - MCQ quizzes per topic
   - Coding sandbox (Monaco editor)
   - Live simulation (system design)
   - Foundation & Gap Analysis page
   - Technical QA Quiz (AI-generated questions)
   - Behavioral interview prep
```

### AI Plan Generation Details

The system prompt (`student/backend/prompts/system_prompt.txt`) instructs GPT-4o to:

- **Role-specific content** — Java role → Java/Spring plan; Python role → FastAPI/Django plan; ML role → Python/ML plan
- **Skill proficiency** — Advanced skills get polish tasks; Beginner skills required by JD get intensive study
- **Time adaptation** — ≤3 days = Sprint mode; ≤7 days = Structured; >7 days = Full roadmap
- **Gap-first prioritization** — Missing skills from JD appear in Day 1-2 as highest priority
- **Mandatory structure** — Every task has Q&A pairs + MCQ quiz; last day = Behavioral Interview; second-to-last = Coding Mock Tests
- **Company-specific tasks** — "Why [Company]?" prep is mandatory; behavioral tasks reference the company

### Celery Worker Role

- Plan generation is a background task (takes 20-40 seconds with GPT-4o)
- The frontend polls `/prep/status` every 3 seconds until status = `ready`
- If Celery is down, a 2-minute timeout triggers a synchronous fallback plan
- On EC2, Celery runs as `copilot_celery_worker` Docker container

---

## 9. Troubleshooting

### "ModuleNotFoundError: No module named 'shared'"

Set PYTHONPATH before running any backend:
```powershell
$env:PYTHONPATH="D:\17.3interview copilot\interview copilot\interview-copilot"
```

---

### "Connection refused" on port 5432 or 6379 (local)

Docker containers aren't running:
```powershell
docker compose up -d
docker ps   # verify both containers show "Up"
```

---

### "AI is generating your plan..." never completes

The Celery worker isn't running.

**Local:** Start Terminal 5 (Celery Worker) from Step 6 above.

**EC2:**
```bash
sudo docker ps | grep celery
sudo docker logs copilot_celery_worker --tail=20
sudo docker restart copilot_celery_worker
```

---

### Plan shows wrong content (Java plan for Python role)

Reset the plan to force regeneration:
```bash
# Replace STUDENT_ID and TARGET_ID with actual values
curl -X DELETE "http://localhost:8010/prep/reset/STUDENT_ID?target_id=TARGET_ID"
```

Or from browser console (F12):
```javascript
// Get IDs
console.log(sessionStorage.getItem('student_id'), sessionStorage.getItem('target_id'))

// Reset plan
fetch('http://localhost:8010/prep/reset/STUDENT_ID?target_id=TARGET_ID', {method:'DELETE'})
  .then(r => r.json()).then(console.log)
```

---

### EC2 containers not starting / out of memory

Add swap space (t2.micro has only 1GB RAM):
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

### "No space left on device" during Docker build

```bash
sudo docker system prune -a   # removes unused images and containers
df -h                          # check disk space after
```

---

### Port already in use (local)

```powershell
# Find what's using port 8010
netstat -ano | findstr :8010

# Kill it (replace PID with the number shown)
taskkill /PID <PID> /F
```

---

### npm install fails

```powershell
npm cache clean --force
npm install
```

---

### Admin login fails after pulling from git

The `.env.local` files are in `.gitignore` and won't be in the repo. You must create them manually after cloning:

```powershell
# student/frontend/.env.local
echo "NEXT_PUBLIC_API_URL=http://13.217.222.70:8010" > student\frontend\.env.local

# admin/frontend/.env.local
echo "NEXT_PUBLIC_API_URL=http://13.217.222.70:8020" > admin\frontend\.env.local

# super-admin/frontend/.env.local
echo "NEXT_PUBLIC_API_URL=http://13.217.222.70:8030" > super-admin\frontend\.env.local
```

---

### EC2 server rebooted and containers stopped

Docker is configured with `restart: always` so containers restart automatically. If they don't:
```bash
cd ~/interview-copilot/deploy
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Make Docker start on boot:
```bash
sudo systemctl enable docker
```

---

## EC2 Security Group — Required Open Ports

If you're setting up a new EC2 instance, open these ports in the AWS Security Group:

| Port | Protocol | Source | Purpose |
|---|---|---|---|
| 22 | TCP | Your IP | SSH access |
| 8010 | TCP | 0.0.0.0/0 | Student API |
| 8020 | TCP | 0.0.0.0/0 | Admin API |
| 8030 | TCP | 0.0.0.0/0 | Super Admin API |
| 80 | TCP | 0.0.0.0/0 | Nginx (optional) |

---

*Built with FastAPI · Next.js · PostgreSQL · Redis · Celery · OpenAI GPT-4o · Google Gemini*
