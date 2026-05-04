#!/bin/bash
set -e

echo "=========================================================="
echo " INTERVIEW COPILOT - EC2 DEPLOYMENT SCRIPT (BACKEND)"
echo "=========================================================="

# 1. Update system and install Docker & Docker Compose
echo "[1/4] Installing dependencies..."
sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose-v2 git

# Ensure docker service is running
sudo systemctl enable docker
sudo systemctl start docker

# Add current user to docker group (might require re-login to take effect)
if ! groups $USER | grep -q '\bdocker\b'; then
    sudo usermod -aG docker $USER
    echo "Added $USER to docker group."
fi

# 2. Set up environment variables
echo "[2/4] Setting up environment variables..."
if [ ! -f .env.prod ]; then
    echo "Creating a template .env.prod file..."
    cat <<EOF > .env.prod
LLM_PROVIDER=gemini
OPENAI_API_KEY=your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=interview-copilot-files
AWS_S3_REGION=ap-south-1
ADMIN_SECRET_KEY=zaheer-super-secret-2026
JWT_SECRET_KEY=interview-copilot-jwt-super-secret-key-2026
EOF
    echo "ATTENTION: Please edit .env.prod with your actual API keys before continuing!"
    echo "Run: nano .env.prod"
    exit 0
fi

# 3. Build and deploy using docker-compose
echo "[3/4] Building and starting Docker containers..."
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 4. Run database migrations (only needed first time or on updates)
echo "[4/4] Running database migrations..."
# Give postgres a few seconds to fully initialize
sleep 5
# Run alembic upgrade head using the student-api container
sudo docker exec copilot_student_api sh -c "cd /app/shared && python run_alembic.py" || echo "Migration script failed or already up to date."

echo "=========================================================="
echo " DEPLOYMENT COMPLETE! 🚀"
echo "=========================================================="
echo "Backend Services are running on:"
echo " - Student API:     http://<EC2_PUBLIC_IP>:8010"
echo " - Admin API:       http://<EC2_PUBLIC_IP>:8020"
echo " - Super-Admin API: http://<EC2_PUBLIC_IP>:8030"
echo ""
echo "To view logs: sudo docker compose -f docker-compose.prod.yml logs -f"
echo "=========================================================="
