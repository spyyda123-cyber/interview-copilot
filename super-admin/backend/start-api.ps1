$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot
uvicorn app.main:app --host 0.0.0.0 --port 8030 --reload
