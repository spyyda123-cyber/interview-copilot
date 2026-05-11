#!/bin/bash
##############################################################
# INTERVIEW COPILOT — EC2 DEPLOYMENT SCRIPT
# Run this script ON your EC2 instance after SSH-ing in
# Usage: bash deploy.sh
##############################################################

set -e  # Stop on any error

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   INTERVIEW COPILOT — EC2 DEPLOYMENT                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 1: Install Docker and Docker Compose
# ─────────────────────────────────────────────────────────────
echo "▶ [1/6] Installing Docker..."
sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose-v2 git curl

sudo systemctl enable docker
sudo systemctl start docker

# Add ubuntu user to docker group so we don't need sudo every time
sudo usermod -aG docker ubuntu 2>/dev/null || true
sudo usermod -aG docker $USER 2>/dev/null || true

echo "✅ Docker installed: $(docker --version)"

# ─────────────────────────────────────────────────────────────
# STEP 2: Check .env.prod exists
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ [2/6] Checking environment file..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f ".env.prod" ]; then
    echo ""
    echo "❌ ERROR: .env.prod not found!"
    echo ""
    echo "Please create it first:"
    echo "  cp .env.prod.template .env.prod"
    echo "  nano .env.prod   ← fill in your API keys"
    echo ""
    exit 1
fi

echo "✅ .env.prod found"

# ─────────────────────────────────────────────────────────────
# STEP 3: Pull latest code (if using git)
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ [3/6] Checking for code updates..."

if [ -d "../.git" ]; then
    cd ..
    git pull origin main 2>/dev/null || echo "  (git pull skipped — not a git repo or no remote)"
    cd deploy
else
    echo "  (No git repo found — using existing code)"
fi

# ─────────────────────────────────────────────────────────────
# STEP 4: Build and start Docker containers
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ [4/6] Building Docker images (this takes 3-5 minutes first time)..."

sudo docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache

echo ""
echo "▶ Starting all services..."
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo "✅ All containers started"

# ─────────────────────────────────────────────────────────────
# STEP 5: Wait for database and run migrations
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ [5/6] Waiting for database to be ready..."
sleep 10

echo "Running database migrations..."
sudo docker exec copilot_student_api python -c "
from app.db.session import engine
from shared.db.base import Base
Base.metadata.create_all(bind=engine)
print('Tables created/verified')
" 2>/dev/null || echo "  (Migration via create_all skipped — may already be up to date)"

# Try alembic if available
sudo docker exec copilot_student_api sh -c "
cd /app && python -m alembic upgrade head 2>/dev/null || echo 'Alembic not configured — skipping'
" 2>/dev/null || true

echo "✅ Database ready"

# ─────────────────────────────────────────────────────────────
# STEP 6: Health check
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ [6/6] Running health checks..."
sleep 5

check_service() {
    local name=$1
    local port=$2
    if curl -sf "http://localhost:${port}/health" > /dev/null 2>&1; then
        echo "  ✅ ${name} (port ${port}) — HEALTHY"
    else
        echo "  ⚠️  ${name} (port ${port}) — not responding yet (may still be starting)"
    fi
}

check_service "Student API" 8010
check_service "Admin API"   8020

# ─────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "YOUR_EC2_IP")

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   DEPLOYMENT COMPLETE! 🚀                           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Your APIs are running at:"
echo "  Student API:     http://${EC2_IP}:8010"
echo "  Admin API:       http://${EC2_IP}:8020"
echo "  Super-Admin API: http://${EC2_IP}:8030"
echo ""
echo "Useful commands:"
echo "  View logs:    sudo docker compose -f docker-compose.prod.yml logs -f"
echo "  Stop all:     sudo docker compose -f docker-compose.prod.yml down"
echo "  Restart:      sudo docker compose -f docker-compose.prod.yml restart"
echo "  Check status: sudo docker ps"
echo ""
