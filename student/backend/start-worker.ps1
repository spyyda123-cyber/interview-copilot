$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "[1/2] Ensuring Redis is running via Docker Compose..." -ForegroundColor Cyan
docker compose up -d redis | Out-Null

$pythonExe = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python"
}

Write-Host "[2/2] Starting Celery workers (default + llm)..." -ForegroundColor Cyan

$defaultWorkerCommand = "Set-Location '$PSScriptRoot'; & '$pythonExe' -m celery -A app.tasks.celery_app worker --pool=solo --loglevel=info --queues default"
$llmWorkerCommand = "Set-Location '$PSScriptRoot'; & '$pythonExe' -m celery -A app.tasks.celery_app worker --pool=solo --loglevel=info --queues llm"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $defaultWorkerCommand
Start-Process powershell -ArgumentList "-NoExit", "-Command", $llmWorkerCommand

Write-Host "Started default queue worker." -ForegroundColor Green
Write-Host "Started llm queue worker." -ForegroundColor Green
