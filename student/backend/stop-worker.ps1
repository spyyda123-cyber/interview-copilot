$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$workerProcesses = Get-CimInstance Win32_Process | Where-Object {
    $cmd = $_.CommandLine
    $_.Name -ieq "python.exe" -and
    $cmd -and
    $cmd -match "(^|\s)-m\s+celery(\s|$)" -and
    $cmd -match "(^|\s)-A\s+app\.tasks\.celery_app(\s|$)" -and
    $cmd -match "(^|\s)worker(\s|$)"
}

if (-not $workerProcesses) {
    Write-Host "No Celery worker process found." -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($workerProcesses.Count) Celery worker process(es)." -ForegroundColor Cyan

foreach ($proc in $workerProcesses) {
    Stop-Process -Id $proc.ProcessId -Force
    Write-Host "Stopped Celery worker PID $($proc.ProcessId)." -ForegroundColor Green
}
