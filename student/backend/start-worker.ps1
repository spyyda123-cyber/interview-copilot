$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "[1/2] Ensuring Redis is running via Docker Compose..." -ForegroundColor Cyan
docker compose up -d redis | Out-Null

$pythonExe = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
}
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python"
}

Write-Host "[2/2] Starting Celery workers (default + llm + agent)..." -ForegroundColor Cyan

$defaultWorkerCommand = "Set-Location '$PSScriptRoot'; & '$pythonExe' -m celery -A app.tasks.celery_app worker --pool=solo --loglevel=info --queues default"
$llmWorkerCommand     = "Set-Location '$PSScriptRoot'; & '$pythonExe' -m celery -A app.tasks.celery_app worker --pool=solo --loglevel=info --queues llm"
$agentWorkerCommand   = "Set-Location '$PSScriptRoot'; & '$pythonExe' -m celery -A app.tasks.celery_app worker --pool=solo --loglevel=info --queues agent"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $defaultWorkerCommand
Start-Process powershell -ArgumentList "-NoExit", "-Command", $llmWorkerCommand
Start-Process powershell -ArgumentList "-NoExit", "-Command", $agentWorkerCommand

Write-Host "Started default queue worker." -ForegroundColor Green
Write-Host "Started llm queue worker."     -ForegroundColor Green
Write-Host "Started agent queue worker (Gemini feedback analysis)." -ForegroundColor Green
Write-Host ""
Write-Host "Agent worker handles:" -ForegroundColor Yellow
Write-Host "  - POST /feedback/submit  -> auto-triggers analyze_company_feedback" -ForegroundColor Yellow
Write-Host "  - POST /feedback/agent/run -> manual full batch" -ForegroundColor Yellow
Write-Host "  - Nightly 2AM beat schedule -> analyze_feedback_batch" -ForegroundColor Yellow
