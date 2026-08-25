# ==============================================================================
#  JIBU AI - Windows RDP / Local Startup Script (PowerShell)
#  One-click launcher: Detects first run, provisions dependencies,
#  starts Docker infrastructure, runs DB migrations, and launches all services.
# ==============================================================================

param (
    [switch]$SetupOnly,
    [switch]$Stop,
    [switch]$Status
)

$ErrorActionPreference = "Stop"
$RootDir = $PSScriptRoot
Set-Location $RootDir

function Log-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Log-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Log-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Log-Err($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

Write-Host @"
===================================================================
     __ _  _                _     ___ 
    / /(_)| |__   _   _    /_\   / _ \
   / / | || '_ \ | | | |  //_\\ / /_)/
  / /__| || |_) || |_| | /  _  / ___/ 
  \____/_||_.__/  \__,_| \_/ \_\/     
                                      
             Windows RDP & Desktop Launcher
===================================================================
"@ -ForegroundColor Cyan

if ($Stop) {
    Log-Info "Stopping all Docker services..."
    docker compose down
    Log-Ok "Services stopped."
    Exit 0
}

# --- Step 1: Environment Check ---
Write-Host "`n==> Step 1: Checking Environment Configuration (.env files)" -ForegroundColor Cyan
$FirstRun = $false

function Ensure-EnvFile($target, $example, $label) {
    if (-not (Test-Path $target)) {
        $script:FirstRun = $true
        Log-Warn "$label .env not found. Copying from $example..."
        if (Test-Path $example) {
            Copy-Item $example $target
        } else {
            New-Item -ItemType File -Path $target | Out-Null
        }
        Log-Ok "Created $target"
    } else {
        Log-Ok "$label .env is ready."
    }
}

Ensure-EnvFile "apps\backend\.env" "apps\backend\.env.example" "Backend"
Ensure-EnvFile "apps\worker\.env" "apps\worker\.env.example" "Worker"
Ensure-EnvFile "apps\frontend\.env.local" "apps\frontend\.env.local" "Frontend"
Ensure-EnvFile "apps\livekit-agent\.env" "apps\livekit-agent\.env.example" "LiveKit Agent"

# --- Step 2: Dependencies ---
Write-Host "`n==> Step 2: Checking Node & Python Dependencies" -ForegroundColor Cyan
if (-not (Test-Path "node_modules") -or $FirstRun) {
    Log-Info "Installing Node packages via pnpm..."
    pnpm install
    Log-Ok "Node dependencies installed."
} else {
    Log-Ok "Node dependencies are installed."
}

$VenvPython = "apps\livekit-agent\venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Log-Info "Setting up Python virtual environment for LiveKit Agent..."
    python -m venv apps\livekit-agent\venv
    & "$RootDir\apps\livekit-agent\venv\Scripts\pip.exe" install --upgrade pip
    if (Test-Path "apps\livekit-agent\requirements.txt") {
        & "$RootDir\apps\livekit-agent\venv\Scripts\pip.exe" install -r apps\livekit-agent\requirements.txt
    }
    Log-Ok "Python venv configured."
} else {
    Log-Ok "Python venv ready."
}

# --- Step 3: Docker Infrastructure ---
Write-Host "`n==> Step 3: Starting Docker Containers" -ForegroundColor Cyan
docker compose up -d postgres redis qdrant vault livekit n8n ollama
Start-Sleep -Seconds 5
Log-Ok "Docker containers started."

# --- Step 4: Prisma Database Migrations ---
Write-Host "`n==> Step 4: Prisma Client & Migrations" -ForegroundColor Cyan
Log-Info "Generating Prisma client..."
pnpm dlx dotenv-cli -e apps/backend/.env -- prisma generate --schema=./apps/backend/prisma/schema.prisma

Log-Info "Running Prisma migrations..."
try {
    pnpm dlx dotenv-cli -e apps/backend/.env -- prisma migrate deploy --schema=./apps/backend/prisma/schema.prisma
} catch {
    Log-Warn "Prisma migrate deploy fallback to db push..."
    pnpm dlx dotenv-cli -e apps/backend/.env -- prisma db push --schema=./apps/backend/prisma/schema.prisma --accept-data-loss
}
Log-Ok "Database synchronized."

if ($SetupOnly) {
    Log-Ok "Setup complete. Exiting (--SetupOnly was specified)."
    Exit 0
}

# --- Step 5: Start Services ---
Write-Host @"

===================================================================
                       JIBU AI IS LIVE 🚀
===================================================================
  🌐 Frontend UI:          http://localhost:3000
  ⚙️  Backend API:          http://localhost:4000/api
  📚 Swagger API Docs:     http://localhost:4000/api/docs
  🔄 Queue Worker:         http://localhost:3001 (Active)
  🎙️  LiveKit Voice Server: ws://localhost:7880
  🗄️  Qdrant Vector DB:     http://localhost:6333
  🤖 n8n Automation:       http://localhost:5678
  📊 Grafana Monitoring:   http://localhost:3100 (admin/admin)
===================================================================
"@ -ForegroundColor Green

Log-Info "Starting Backend, Worker, Frontend, and LiveKit Voice Agent in separate windows..."

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '[BACKEND API]' -ForegroundColor Cyan; pnpm exec nx serve backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '[QUEUE WORKER]' -ForegroundColor Magenta; pnpm exec nx run worker:worker"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '[FRONTEND UI]' -ForegroundColor Green; pnpm exec nx serve frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '[LIVEKIT VOICE AGENT]' -ForegroundColor Yellow; cd apps\livekit-agent; .\venv\Scripts\python.exe src\main.py dev"

Log-Ok "All 4 application services launched successfully!"
