# 🌐 Interview Copilot — Next.js Vercel Deployment Automation Script
# Save as: deploy-frontends.ps1
# Usage: Run in PowerShell from this folder.

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "     INTERVIEW COPILOT — VERCEL FRONTEND DEPLOYMENT HELPER" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check for Node/NPM ──
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js and npm are required but were not found on this system. Please install them from https://nodejs.org/"
    exit 1
}

# ── Step 2: Vercel Authentication ──
Write-Host "▶ [1/4] Checking Vercel Authentication..." -ForegroundColor Yellow
Write-Host "This script will use the official Vercel CLI (via npx)." -ForegroundColor Gray
Write-Host "If you are not logged in, a browser window will open automatically for you to authenticate." -ForegroundColor Gray
Write-Host ""
Write-Host "Please press any key to verify/start Vercel login..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

try {
    npx vercel login
    Write-Host "✅ Vercel login successful!" -ForegroundColor Green
} catch {
    Write-Error "Vercel login failed. Please ensure you have internet access and complete the login in your browser."
    exit 1
}

# ── Step 3: Get Backend API domain ──
Write-Host ""
Write-Host "▶ [2/4] Configuring Backend API URLs..." -ForegroundColor Yellow
Write-Host "Vercel serves all frontends securely over HTTPS. Therefore, your backend API must also support HTTPS." -ForegroundColor Gray
Write-Host "Example: https://api.yourdomain.com" -ForegroundColor Gray
Write-Host ""
$BackendDomain = Read-Host "Enter your secure backend base URL (e.g. https://api.yourdomain.com or https://13.235.xxx.xxx)"

if (-not $BackendDomain.StartsWith("http")) {
    $BackendDomain = "https://" + $BackendDomain
}
# Remove trailing slash if present
$BackendDomain = $BackendDomain.TrimEnd('/')

Write-Host "Using base API domain: $BackendDomain" -ForegroundColor Green

# Define APIs
$StudentApi = "$BackendDomain/api/student"
$AdminApi = "$BackendDomain/api/admin"
$SuperAdminApi = "$BackendDomain/api/super-admin"

# ── Step 4: Deploy Selection ──
Write-Host ""
Write-Host "▶ [3/4] Select Frontend to Deploy:" -ForegroundColor Yellow
Write-Host "1) Student Frontend (Runs on port 3000 locally)" -ForegroundColor Gray
Write-Host "2) College Admin Frontend (Runs on port 3001 locally)" -ForegroundColor Gray
Write-Host "3) Super-Admin Frontend (Runs on port 3002 locally)" -ForegroundColor Gray
Write-Host "4) Deploy ALL Frontends" -ForegroundColor Gray
Write-Host ""
$Choice = Read-Host "Choose an option (1-4)"

$RootPath = (Get-Item -Path $PSScriptRoot).Parent.FullName

function Deploy-Frontend {
    param (
        [string]$Name,
        [string]$Subfolder,
        [string]$ApiUrl
    )
    
    $Path = Join-Path $RootPath $Subfolder
    Write-Host ""
    Write-Host "---------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "  Deploying $Name to Vercel..." -ForegroundColor Cyan
    Write-Host "  Path: $Path" -ForegroundColor Gray
    Write-Host "  API URL: $ApiUrl" -ForegroundColor Gray
    Write-Host "---------------------------------------------------------" -ForegroundColor Cyan
    
    if (-not (Test-Path $Path)) {
        Write-Error "Directory not found: $Path"
        return
    }
    
    # Enter directory
    Push-Location $Path
    
    try {
        # Initialize/Deploy Vercel Project (Development/Preview)
        Write-Host "Creating/Linking project on Vercel..." -ForegroundColor Yellow
        npx vercel --yes
        
        # Add the environment variable for production
        Write-Host "Configuring build-time environment variable NEXT_PUBLIC_API_URL..." -ForegroundColor Yellow
        npx vercel env add NEXT_PUBLIC_API_URL production $ApiUrl
        
        # Trigger Production Build & Deploy
        Write-Host "Deploying to production..." -ForegroundColor Yellow
        npx vercel --prod --yes
        
        Write-Host "✅ $Name deployed successfully!" -ForegroundColor Green
    } catch {
        Write-Warning "Failed to deploy $Name. Make sure you accepted the prompts and your code has no compilation errors."
    } finally {
        Pop-Location
    }
}

if ($Choice -eq "1" -or $Choice -eq "4") {
    Deploy-Frontend -Name "Student Frontend" -Subfolder "student/frontend" -ApiUrl $StudentApi
}
if ($Choice -eq "2" -or $Choice -eq "4") {
    Deploy-Frontend -Name "Admin Frontend" -Subfolder "admin/frontend" -ApiUrl $AdminApi
}
if ($Choice -eq "3" -or $Choice -eq "4") {
    Deploy-Frontend -Name "Super-Admin Frontend" -Subfolder "super-admin/frontend" -ApiUrl $SuperAdminApi
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "                      DEPLOYMENT CYCLE COMPLETE! 🎉" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
