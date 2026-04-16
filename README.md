# Interview Copilot - Centralized Management System

Interview Copilot is a multi-service platform designed to streamline interview preparation and placement management. It consists of three primary user flows, each with its own frontend and backend, powered by a shared logic and data layer.

## Project Structure

```bash
interview-copilot/
├── shared/             # Shared logic, database models, and authentication
├── student/            # Student Flow (Backend & Frontend)
├── admin/              # College Admin Flow (Backend & Frontend)
├── super-admin/        # Platform Super Admin Flow (Backend & Frontend)
└── src/app/status      # Diagnostics Dashboard (Root Next.js App)
```

---

## Prerequisites

- **Python 3.11+**
- **Node.js 20+** (npm or pnpm)
- **PostgreSQL** with `pgvector` extension
- **Redis** (for session management and task queuing)

---

## 🚀 Setup Instructions

### 1. Environment Configuration
Copy the shared environment template and fill in your credentials:
```bash
cp shared/.env.example .env
```
Main variables to configure:
- `DATABASE_URL`: Your PostgreSQL connection string.
- `REDIS_URL`: Your Redis connection string.
- `GEMINI_API_KEY` / `OPENAI_API_KEY`: API keys for AI evaluation.
- `JWT_SECRET_KEY`: A strong secret for authentication tokens.

### 2. Backend Setup (Python)
You must set up the `shared` library first, as all local backends depend on it.

#### Shared Library
```bash
cd shared
pip install -r requirements.txt
pip install -e .
```

#### Local Backends
Repeat these steps for each backend (`student/backend`, `admin/backend`, `super-admin/backend`):
```bash
cd <component>/backend
python -m venv .venv
# Activate venv:
# Windows: .\.venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Frontend Setup (Next.js)
Repeat these steps for each frontend (`student/frontend`, `admin/frontend`, `super-admin/frontend`, and the root folder for diagnostics):
```bash
cd <component>/frontend
npm install
```

---

## 🏃 Running the Project

### Database Initialization
Run the initialization scripts from the `shared` directory or root:
```bash
# Initialize student/placement DB schemas
python shared/create_student_db.py
python shared/create_placement_db.py

# Seed Super Admin
python shared/seed_super_admin.py
```

### Starting Services
For development, you need to run the backends and frontends separately.

#### Backends
- **Student API**: `uvicorn app.main:app --port 8010 --reload` (in `student/backend`)
- **Admin API**: `uvicorn app.main:app --port 8020 --reload` (in `admin/backend`)
- **Super Admin API**: `uvicorn app.main:app --port 8030 --reload` (in `super-admin/backend`)
- **Worker**: `celery -A app.worker worker --loglevel=info` (in `student/backend`)

#### Frontends
- **Diagnostics Dashboard**: `npm run dev` (Root) -> http://localhost:3000
- **Student Dashboard**: `npm run dev` (in `student/frontend`) -> http://localhost:3000 (standard)
- **Admin Console**: `npm run dev` (in `admin/frontend`) -> http://localhost:3001
- **Super Admin**: `npm run dev` (in `super-admin/frontend`) -> http://localhost:3002

---

## 🛠 Features

- **Multi-Tenant Architecture**: Separate interfaces for Students, College Admins, and Super Admins.
- **AI-Powered Evaluation**: Integration with Gemini and OpenAI for resume parsing and mock interviews.
- **Real-time Monitoring**: Built-in diagnostics page to check service health.
- **Shared Auth Logic**: Consistent security protocols across all micro-services.

---

Made with ❤️ by the Interview Copilot Team
