# Interview CoPilot — Full System Onboarding Manual

Version: 1.0  
Last Updated: 2026-02-25  
Audience: New engineers (Backend, Frontend, DevOps), QA, Support

---

## Table of Contents
1. Product Overview  
2. Complete Tech Stack and Rationale  
3. Full User Flow (Page-by-Page)  
4. Backend Architecture  
5. Database Design  
6. Background Workers and Queues  
7. AI and LLM Integration  
8. Complete Setup Guide (Windows + Mac)  
9. Operations and Runtime Behavior  
10. Troubleshooting Runbook  
11. Textual System Diagram  
12. File-by-File Responsibility Map  
13. Known Inconsistencies and Notes

---

## 1) Product Overview

### What this application does
Interview CoPilot is a licensed interview preparation platform. It collects user profile preferences, target job description, and resume data, then generates a personalized interview preparation plan and an asynchronous AI advisory summary.

### What problem it solves
Candidates typically prepare without structure and without tailored feedback for a specific company/role. This system creates a focused preparation path using:
- License-bound company context
- Job-description requirement analysis
- Resume gap analysis
- Candidate preference profile

### Who the user is
- Primary user: candidate/student preparing for a company interview.
- Admin user: internal operator who issues license keys.
- Engineering/Operations users: maintain services, queues, database, and deployment scripts.

### Complete high-level user journey
1. User opens app and activates license.  
2. User submits onboarding profile and learning preferences.  
3. User submits target JD for analysis.  
4. User uploads resume and receives ATS + missing skills feedback.  
5. User opens prep page and gets plan status.  
6. Plan appears when ready; summary is generated asynchronously.  
7. Status page can be used anytime for system health diagnostics.

---

## 2) Complete Tech Stack and Rationale

## Backend

### FastAPI
- What it does in this project:
  - Exposes all REST endpoints for license, student, target, resume, prep, company, knowledge, system, and admin routes.
- Why chosen:
  - Fast Python API framework with typed schema support and straightforward dependency injection.
- What breaks if removed:
  - No API surface for frontend flow; entire product becomes unusable.

### SQLAlchemy
- What it does:
  - Defines ORM models and query/update patterns for all business entities.
- Why chosen:
  - Mature ORM with explicit relational modeling and transaction management.
- What breaks if removed:
  - All model layer and most service logic must be rewritten.

### PostgreSQL
- What it does:
  - Primary persistence for students, licenses, targets, resumes, plans, tasks, and knowledge records.
- Why chosen:
  - Strong relational guarantees and mature ecosystem.
- What breaks if removed:
  - No durable business state, no user progression, no plan records.

### Redis
- What it does:
  - Broker/result backend for Celery task queue.
- Why chosen:
  - Lightweight, high-throughput queue transport.
- What breaks if removed:
  - Background tasks won’t run; long operations block/fail.

### Celery
- What it does:
  - Executes asynchronous jobs (target analysis, plan generation, summary generation, ingestion tasks).
- Why chosen:
  - Standard Python task queue with queue routing and worker model.
- What breaks if removed:
  - Async workload cannot be processed; status polling never reaches completion.

### Gemini / OpenAI client layer
- What it does:
  - Active runtime path uses Gemini for generation/analysis and embeddings integrations.
  - OpenAI settings exist but runtime business flow is Gemini-centric.
- Why chosen:
  - AI-based semantic extraction and guidance generation.
- What breaks if removed:
  - Target/JD analysis quality degrades or fails; summary generation fails.

### Pydantic
- What it does:
  - Validates API request/response DTOs and environment settings.
- Why chosen:
  - Strong type safety and runtime validation.
- What breaks if removed:
  - Increased runtime errors and weak contract validation.

### Uvicorn
- What it does:
  - Runs FastAPI ASGI application.
- Why chosen:
  - Native ASGI server for FastAPI.
- What breaks if removed:
  - Backend server won’t run.

---

## Frontend

### Next.js
- What it does:
  - Routing, React runtime integration, app structure.
- Why chosen:
  - Productive full-stack frontend framework with first-class route model.
- What breaks if removed:
  - Entire web UI layer lost.

### React
- What it does:
  - Page state, forms, polling loops, conditional rendering.
- Why chosen:
  - Component-driven architecture and ecosystem.
- What breaks if removed:
  - All client interactions must be rewritten.

### TypeScript
- What it does:
  - Enforces typed API contracts and state handling.
- Why chosen:
  - Reduces integration mistakes with backend contracts.
- What breaks if removed:
  - Loss of static safety and maintainability.

### Tailwind CSS
- What it does:
  - Styling system for all pages/components.
- Why chosen:
  - Consistent, utility-first styling with fast iteration.
- What breaks if removed:
  - UI styling requires significant rewrite.

### SessionStorage
- What it does:
  - Stores activation/session keys (student_id/license_key + flow context).
- Why chosen:
  - Lightweight client-managed session without JWT/cookies.
- What breaks if removed:
  - Route protection and flow continuity collapse.

### Polling pattern
- What it does:
  - Frontend polls status endpoints for async target analysis and prep generation.
- Why chosen:
  - Simpler than websocket infrastructure.
- What breaks if removed:
  - Users cannot observe async completion.

---

## 3) Full User Flow (Critical, in exact order)

## Step 0: Browser opens /
- Route `/` is an alias to `/license`.
- No API call at this point.

## Step 1: /license
User enters:
- Email
- Name
- License key

Frontend sessionStorage writes on success:
- student_id
- student_name
- student_email
- license_key
- company_name
- interview_date
- role (optional)

Backend API:
- POST /license/activate

DB affected:
- prep_licenses (activate/bind/update status)
- students (create or reuse)

Background task:
- None

Next page:
- /onboarding

## Step 2: /onboarding
User enters:
- Primary skill
- Known skills (comma list)
- Support mode
- Tone
- Coding required boolean
- Name/email may be prefilled from session

SessionStorage writes:
- student_id (confirmed)
- student_name
- student_email
- primary_skill
- known_skills
- support_mode
- tone
- coding_required

Backend API:
- POST /student/create

DB affected:
- students (name update if existing)
- student_profiles (create/update)

Background task:
- None

Next page:
- /target

## Step 3: /target (or /company alias)
User enters:
- Role (optional)
- JD text
- Company is read-only from activated license session

SessionStorage writes:
- role
- jd_text
- target_id
- company_name (persisted context)

Backend APIs:
- POST /target/analyze (creates target + enqueues worker)
- GET /target/status?target_id=... (polling loop)

DB affected:
- target_interviews insert on analyze call
- target_interviews updated by worker (skills/difficulty/round structure/status)

Background tasks:
- analyze_target_task (default queue)

Next page:
- /resume (after target status becomes ready)

## Step 4: /resume
User enters:
- Resume PDF upload

SessionStorage writes:
- resume_id

Backend API:
- POST /resume/upload (multipart)

DB affected:
- resumes
- resume_sections
- resume_gap_analyses
- may trigger generation path depending on license/plan state

Background tasks:
- plan generation may be enqueued fire-and-forget
- (parse is currently handled in request path in current code flow)

Next page:
- /prep (or /plan)

## Step 5: /prep (alias /plan)
User actions:
- Usually no form input; page initializes and polls for result.

SessionStorage reads:
- student_id
- license_key
- target_id
- resume_id
- company_name
- role
- interview_date

Backend APIs:
- POST /prep/generate
- GET /prep/status/{student_id}?license_key=...&target_id=...
- GET /prep/latest/{student_id}?license_key=...&target_id=...

DB affected:
- learning_plans (status transitions + plan JSON + summary fields)
- learning_tasks
- prep_licenses.plan_generated updates

Background tasks:
- generate_plan_task (default queue)
- generate_plan_summary (llm queue)

Next behavior:
- Plan JSON rendered when ready.
- `summary_generated` flag indicates async summary completion.

## Step 6: /status
User actions:
- Opens diagnostics page.

Backend API:
- GET /system/status (polling)
- NavBar also checks GET /health

DB affected:
- none

Background tasks:
- none

---

## 4) Backend Architecture

### Layering model
- API routes -> Service layer -> Models/DB -> Celery tasks -> LLM clients

### Folder responsibilities
- app/api: endpoint orchestration and request handling
- app/services: business logic, orchestration, external integrations
- app/models: SQLAlchemy entities and relationships
- app/schemas: Pydantic request/response contracts
- app/tasks: Celery app + async jobs
- app/security: admin auth dependency
- app/utils: helper functions (PDF/text/license key/worker checks)
- app/core: settings/config loading
- app/db: session/engine/init and migration scripts

### License validation system
- Validates license existence, status, student binding, company match, and expiry.
- Used by protected flows like target, resume, prep.

### Plan signature caching
- Signature includes normalized student + company + role + interview_date.
- Prevents duplicate plan generation for same context.

### Summary generation system
- Plan skeleton is generated fast and marked ready.
- Summary job is queued on dedicated llm queue.
- `summary_generated` controls frontend readiness for summary section.

### Polling design
- Frontend continuously polls status endpoints.
- Backend endpoints return explicit states (`generating`, `ready`, `failed`, `missing`).

---

## 5) Database Design (From SQLAlchemy + migrations)

## Student
- Table: students
- Columns: id, full_name, email, created_at
- Purpose: canonical user identity
- Relationships: one-to-one profile, one-to-many targets/resumes/gaps/plans/licenses
- Written: license activation, student create
- Read: all major flows

## StudentProfile
- Table: student_profiles
- Columns: id, student_id(unique), primary_skill, known_skills(JSON), support_mode, tone, coding_required, created_at
- Purpose: personalization settings
- Relationships: belongs to student
- Written: onboarding submit
- Read: prep + summary

## PrepLicense
- Table: prep_licenses
- Columns: license_key(unique), student_id(nullable), company_name, role, interview_date, activated_at, status, plan_generated, created_at
- Purpose: access control and business licensing
- Relationships: optional link to student
- Written: admin create, activate, expire updates, plan flag
- Read: protected endpoint validation and plan context

## TargetInterview
- Table: target_interviews
- Columns: student_id, company_name, role, required_skills(JSON), difficulty, round_structure, analysis_status, analysis_error, jd_text, created_at
- Purpose: JD analysis result storage
- Relationships: belongs to student; referenced by gap analysis
- Written: analyze endpoint + async task updates
- Read: resume and prep generation

## Resume
- Table: resumes
- Columns: student_id, file_path, raw_text, created_at
- Purpose: resume storage metadata/content
- Relationships: belongs to student; has many resume_sections
- Written: upload + parse
- Read: gap analysis + summary context

## ResumeGapAnalysis
- Table: resume_gap_analyses
- Columns: student_id, target_id, resume_id, missing_skills(JSON), keyword_score, ats_score, created_at
- Purpose: skill gap between resume and target JD
- Relationships: links student/target/resume
- Written: resume upload flow
- Read: plan generation and summary

## LearningPlan
- Table: learning_plans
- Columns: student_id, company_name, role, days_available, plan_signature(unique), status, plan_json(JSON), tasks_generated(INTEGER), summary_generated(BOOLEAN), plan_summary(TEXT), created_at
- Purpose: plan state and payload
- Relationships: has many learning_tasks
- Written: prep generation and async summary flows
- Read: prep status/latest

### Key fields
- plan_signature: deterministic cache key to avoid duplicates
- summary_generated: indicates summary completion
- plan_type: migration exists for diagnostics/typing (model mapping handled defensively)
- failure_reason: migration exists for failure diagnostics (model mapping handled defensively)

## LearningTask
- Table: learning_tasks
- Columns: plan_id, day, task_order, title, description, duration_minutes, created_at
- Purpose: normalized plan tasks
- Relationships: belongs to learning_plan
- Written: skeleton/fallback generation
- Read: plan display/backward compatibility

## KnowledgeDocument
- Table: knowledge_documents
- Columns: title, source, company_name, role, created_at
- Purpose: metadata for ingested knowledge assets
- Written: ingest endpoint/task
- Read: retrieval context filtering

## KnowledgeChunk
- Table: knowledge_chunks
- Columns: document_id, content, embedding(vector), created_at
- Purpose: vector-retrievable chunks for RAG
- Written: ingestion processing
- Read: semantic retrieval for company context

---

## 6) Background Workers and Queues

### What Celery does here
Runs expensive and asynchronous workflows outside HTTP request lifecycle.

### What Redis does here
Acts as Celery broker/result backend to store queue traffic and task results.

### Queue design
- default queue:
  - analyze_target_task
  - generate_plan_task
  - parse_resume_task
  - ingest_document_task
- llm queue:
  - generate_plan_summary only

### Why summary is separated
- Prevents LLM summary tasks from waiting behind default queue workload.
- Improves user-perceived completion time for advisory summary.

### Task-by-task summary
- parse_resume_task: parses uploaded resume and sections.
- ingest_document_task: ingests knowledge text/chunks.
- analyze_target_task: extracts JD requirements and target metadata.
- generate_plan_task: orchestrates plan generation with retries/fallback.
- generate_plan_summary: async summary generation; non-blocking optional enhancement.

---

## 7) AI / LLM Integration

### Where LLM is called
- Target analysis task (JD -> required skills/difficulty/round structure)
- Plan summary task (advisory coaching text)
- Embedding service for knowledge chunk vectors

### Prompt assets
- prompts/system_prompt.txt is used in generation context construction path.
- prompts/plan_prompt.txt exists in repo but active usage should be validated per code path.

### Inputs sent
- Company, role, JD text, retrieved context, profile/gap signals depending on task.

### Expected outputs
- Structured target analysis fields.
- Plain-text summary sections for plan advice.

### Fallback behavior
- generate_plan_task has manual retry loop and deterministic fallback plan creation.
- summary generation failures keep plan usable; summary remains optional.

### Why async
AI calls are latency-variable and costlier; async avoids blocking API requests.

---

## 8) Complete Setup Guide

## 8.1 Prerequisites

### Windows
- Python 3.11+
- Node.js 18+
- Docker Desktop
- Git
- PowerShell

### Mac
- Python 3.11+
- Node.js 18+
- Docker Desktop
- Git
- zsh/bash

---

## 8.2 Backend Setup (exact command sequence)

1) Clone and enter backend
```bash
git clone <repo-url>
cd interview_copilot_backend
```

2) Create/activate venv

Windows:
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Mac:
```bash
python3 -m venv venv
source venv/bin/activate
```

3) Install dependencies
```bash
pip install -r requirements.txt
```

4) Create `.env` (required, not committed)
Use required vars from Section 8.4.

5) Start infra
```bash
docker compose up -d postgres redis
```

6) Run init/migrations

Windows:
```powershell
$env:PYTHONPATH=(Get-Location).Path
python app/db/init_db.py
python app/db/migrate_prep_license.py
python app/db/migrate_plan_signature.py
python app/db/migrate_remove_time_left_days.py
python app/db/migrate_tasks_generated.py
python app/db/migrate_plan_summary.py
python app/db/migrate_summary_generated.py
python app/db/migrate_plan_type.py
python app/db/migrate_failure_reason.py
```

Mac:
```bash
export PYTHONPATH="$(pwd)"
python app/db/init_db.py
python app/db/migrate_prep_license.py
python app/db/migrate_plan_signature.py
python app/db/migrate_remove_time_left_days.py
python app/db/migrate_tasks_generated.py
python app/db/migrate_plan_summary.py
python app/db/migrate_summary_generated.py
python app/db/migrate_plan_type.py
python app/db/migrate_failure_reason.py
```

7) Start API

Windows helper script:
```powershell
.\start-api.ps1
```

Direct command (any OS):
```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
```

8) Start workers

Windows helper script:
```powershell
.\start-worker.ps1
```

Direct commands (two terminals):
```bash
python -m celery -A app.tasks.celery_app worker --pool=solo --loglevel=info --queues default
python -m celery -A app.tasks.celery_app worker --pool=solo --loglevel=info --queues llm
```

---

## 8.3 Frontend Setup

1) Enter frontend repo
```bash
cd ../interview-copilot-frontend
```

2) Install deps
```bash
npm install
```

3) Create `.env.local` (required, not committed)
```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8010
```

4) Start frontend
```bash
npm run dev
```

---

## 8.4 Environment Variables (and purpose)

Backend (.env):
- APP_NAME: app display name
- ENV: runtime environment
- DATABASE_URL: SQLAlchemy database connection string
- REDIS_URL: Redis connection for runtime checks
- CELERY_BROKER_URL: Celery broker URL
- CELERY_RESULT_BACKEND: Celery result backend URL
- GEMINI_API_KEY: required for active LLM generation paths
- GEMINI_EMBEDDING_MODEL: embedding model id
- GEMINI_GENERATION_MODEL: generation model id
- OPENAI_API_KEY: legacy/auxiliary status checks and compatibility paths
- OPENAI_EMBEDDING_MODEL: legacy embedding model setting
- OPENAI_GENERATION_MODEL: legacy generation model setting
- UPLOAD_DIR: resume upload path
- KNOWLEDGE_DIR: knowledge file path
- CORS_ORIGINS: allowed frontend origins
- ADMIN_SECRET_KEY: required for admin license creation route

Frontend (.env.local):
- NEXT_PUBLIC_API_URL: backend base URL used by API client

---

## 9) Operations and Running

### Start scripts
- start-api.ps1:
  - starts postgres/redis via compose
  - waits for ports 5432 and 6379
  - runs uvicorn on 8010
- start-worker.ps1:
  - ensures redis running
  - starts default and llm workers in separate terminals

### Stop scripts
- stop-worker.ps1:
  - kills worker python processes matching Celery worker command pattern
- stop-services.ps1:
  - stops workers
  - stops redis container

### Worker behavior
- If default worker is down:
  - target analysis and plan generation cannot progress.
- If llm worker is down:
  - summary generation does not complete, but plan can still be usable.

### Health checks
- GET /health for API liveness.
- GET /system/status for DB/Redis/Celery/openai key presence diagnostics.

### Debugging a stuck plan
1. Call /prep/status for student/license/target.  
2. Call /system/status and verify celery_worker + redis.  
3. Ensure both workers are running (default and llm).  
4. Review worker logs for plan generation or summary errors.  
5. Re-trigger /prep/generate if status is terminal failure.  
6. Validate license and target context consistency.

---

## 10) Troubleshooting

### Issue: Plan stuck generating
Possible causes:
- Worker down or not consuming queue
- Redis down
- plan context mismatch
- previous task failed and wasn’t retried

Fix:
- Start redis and workers
- check /system/status
- retry /prep/generate
- inspect Celery logs for generate_plan_task

### Issue: License invalid/expired
Possible causes:
- wrong key
- wrong student or company context
- expired interview_date

Fix:
- verify active prep_license row
- activate with correct user context
- issue new license if expired

### Issue: Redis not running
Fix:
```bash
docker compose up -d redis
```

### Issue: DB connection failure
Fix:
- verify postgres container up
- validate DATABASE_URL
- re-run init/migrations if schema incomplete

### Issue: LLM key not working
Fix:
- verify GEMINI_API_KEY in backend .env
- restart API + workers
- inspect worker logs for provider-specific errors

---

## 11) System Diagram (Text)

```text
Browser (User)
   |
   v
Next.js Frontend (session + polling)
   |
   v
FastAPI Backend (routes/services/validation)
   |
   +--> PostgreSQL (business data)
   |
   +--> Redis (task broker/result)
          |
          v
      Celery Workers
      - default queue (analysis/generation)
      - llm queue (summary)
          |
          v
      LLM/Embedding Provider (Gemini-centric runtime)
```

---

## 12) File-by-File Responsibility Map (key files)

## Backend key files
- app/main.py: app startup + router wiring + health
- app/core/config.py: env config
- app/api/*.py: endpoint modules
- app/services/*.py: business + integrations
- app/models/*.py: SQLAlchemy entities
- app/schemas/*.py: request/response models
- app/tasks/celery_app.py: queue/routing config
- app/tasks/jobs.py: task implementations
- app/db/*.py: db session/init/migrations
- app/security/admin_auth.py: admin key validation
- app/utils/*.py: utilities
- start-api.ps1/start-worker.ps1/stop-worker.ps1/stop-services.ps1: ops scripts
- docker-compose.yml: postgres + redis

## Frontend key files
- app/layout.tsx: global app shell + ActivationGuard
- app/license/page.tsx: activation page
- app/onboarding/page.tsx: profile page
- app/target/page.tsx: JD analyze + polling
- app/resume/page.tsx: resume upload
- app/plan/page.tsx: prep generation orchestration + render
- app/prep/page.tsx: alias to plan
- src/lib/api.ts: all backend client calls + global error/session handling
- app/components/ActivationGuard.tsx: route protection
- app/components/NavBar.tsx: health + session reset
- app/docs/session-contract.ts: session key contract
- src/app/status/page.tsx: diagnostics page

---

## 13) Known Inconsistencies and Engineering Notes

1. Documentation drift exists between some comments/README and active runtime behavior.  
2. .env.example may not fully reflect Gemini-first runtime needs.  
3. Status naming in comments may differ from actual endpoint status values in some files.  
4. OpenAI key is still surfaced in system status while active AI flow is Gemini-centric.

These should be normalized in a follow-up documentation and config hygiene pass.
