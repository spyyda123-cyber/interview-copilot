$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

function Wait-ForTcpPort {
    param(
        [string]$HostName,
        [int]$Port,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $iar = $client.BeginConnect($HostName, $Port, $null, $null)
            $connected = $iar.AsyncWaitHandle.WaitOne(1000, $false)
            if ($connected -and $client.Connected) {
                $client.EndConnect($iar)
                $client.Close()
                return $true
            }
            $client.Close()
        } catch {
        }
        Start-Sleep -Seconds 1
    }

    return $false
}

Write-Host "Ensuring Postgres and Redis are running via Docker Compose..." -ForegroundColor Cyan
docker compose up -d postgres redis | Out-Null

Write-Host "Waiting for Postgres (5432)..." -ForegroundColor Cyan
if (-not (Wait-ForTcpPort -HostName "127.0.0.1" -Port 5432 -TimeoutSeconds 60)) {
    throw "Postgres did not become ready on port 5432 within 60 seconds."
}

Write-Host "Waiting for Redis (6379)..." -ForegroundColor Cyan
if (-not (Wait-ForTcpPort -HostName "127.0.0.1" -Port 6379 -TimeoutSeconds 30)) {
    throw "Redis did not become ready on port 6379 within 30 seconds."
}

$pythonExe = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python"
}

Write-Host "Starting FastAPI server..." -ForegroundColor Cyan
& $pythonExe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
