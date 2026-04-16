$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "[1/2] Stopping Celery worker..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "stop-worker.ps1")

Write-Host "[2/2] Stopping Redis service..." -ForegroundColor Cyan
docker compose stop redis | Out-Null

Write-Host "Backend services stopped." -ForegroundColor Green
