#!/usr/bin/env bash
# ==============================================================================
#  JIBU AI - Unified Ubuntu Server & Linux Startup Script
#  One-click launcher: Detects first run, provisions dependencies,
#  starts Docker infrastructure, runs DB migrations, and launches all services.
# ==============================================================================

set -e

# --- Colors for Terminal Output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# --- Helper Log Functions ---
log_info() {
    echo -e "${BLUE}${BOLD}[INFO]${NC} $1"
}
log_success() {
    echo -e "${GREEN}${BOLD}[OK]${NC} $1"
}
log_warn() {
    echo -e "${YELLOW}${BOLD}[WARN]${NC} $1"
}
log_error() {
    echo -e "${RED}${BOLD}[ERROR]${NC} $1"
}
log_step() {
    echo -e "\n${CYAN}${BOLD}==>${NC} ${BOLD}$1${NC}"
}

print_banner() {
    echo -e "${CYAN}${BOLD}"
    cat << "EOF"
  ===================================================================
     __ _  _                _     ___ 
    / /(_)| |__   _   _    /_\   / _ \
   / / | || '_ \ | | | |  //_\\ / /_)/
  / /__| || |_) || |_| | /  _  / ___/ 
  \____/_||_.__/  \__,_| \_/ \_\/     
                                      
             Unified Ubuntu Server & Linux Launcher
  ===================================================================
EOF
    echo -e "${NC}"
}

# --- Parse Command Line Arguments ---
MODE="dev" # dev, daemon (pm2), setup-only, stop, status
AUTO_INSTALL_DEPS=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --daemon|--pm2|-d) MODE="daemon" ;;
        --dev) MODE="dev" ;;
        --setup-only) MODE="setup-only" ;;
        --stop) MODE="stop" ;;
        --status) MODE="status" ;;
        --install-deps) AUTO_INSTALL_DEPS=true ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dev           Start in interactive development mode with live logs (default)"
            echo "  --daemon, --pm2 Start in persistent background mode using PM2"
            echo "  --setup-only    Run setup & migrations without starting app services"
            echo "  --install-deps  Auto-install missing system dependencies (Docker, Node, pnpm, Python)"
            echo "  --status        Check health and status of all running services"
            echo "  --stop          Stop all background services and Docker containers"
            echo "  --help, -h      Show this help message"
            exit 0
            ;;
        *) log_warn "Unknown option: $1"; ;;
    esac
    shift
done

# --- Check & Stop Mode ---
if [ "$MODE" = "stop" ]; then
    print_banner
    log_step "Stopping Jibu AI Services..."
    if command -v pm2 &> /dev/null; then
        pm2 stop ecosystem.config.js 2>/dev/null || true
        pm2 delete ecosystem.config.js 2>/dev/null || true
    fi
    pkill -f "apps/backend" 2>/dev/null || true
    pkill -f "apps/worker" 2>/dev/null || true
    pkill -f "apps/frontend" 2>/dev/null || true
    pkill -f "livekit-agent" 2>/dev/null || true
    
    if command -v docker &> /dev/null; then
        log_info "Stopping Docker containers..."
        docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true
    fi
    log_success "All Jibu AI services and containers stopped."
    exit 0
fi

# --- Check Status Mode ---
if [ "$MODE" = "status" ]; then
    print_banner
    log_step "Checking Jibu AI Status..."
    
    check_port() {
        local name=$1
        local port=$2
        if nc -z 127.0.0.1 "$port" 2>/dev/null || timeout 1 bash -c "</dev/tcp/127.0.0.1/$port" 2>/dev/null; then
            echo -e "  [${GREEN}ONLINE${NC}] $name (Port: $port)"
        else
            echo -e "  [${RED}OFFLINE${NC}] $name (Port: $port)"
        fi
    }
    
    echo -e "${BOLD}Infrastructure Services:${NC}"
    check_port "PostgreSQL" 5432
    check_port "Redis" 6379
    check_port "Qdrant Vector DB" 6333
    check_port "LiveKit Server" 7880
    check_port "Vault" 8200
    check_port "n8n Workflow Engine" 5678
    check_port "Ollama (Embeddings)" 11435
    
    echo -e "\n${BOLD}Application Services:${NC}"
    check_port "Frontend (Next.js)" 3000
    check_port "Backend (NestJS API)" 4000
    check_port "Worker (BullMQ)" 3001
    
    if command -v pm2 &> /dev/null; then
        echo -e "\n${BOLD}PM2 Process Status:${NC}"
        pm2 status
    fi
    exit 0
fi

print_banner

# ==============================================================================
# STEP 1: System & Prerequisites Check
# ==============================================================================
log_step "Step 1: Checking System Dependencies & Environment"

MISSING_DEPS=()

check_dependency() {
    local cmd=$1
    local name=$2
    if ! command -v "$cmd" &> /dev/null; then
        MISSING_DEPS+=("$name")
    else
        log_success "Found $name ($($cmd --version 2>/dev/null | head -n 1 || echo 'installed'))"
    fi
}

check_dependency "git" "Git"
check_dependency "curl" "cURL"
check_dependency "node" "Node.js (v20+ recommended)"
check_dependency "pnpm" "pnpm"
check_dependency "python3" "Python 3"
check_dependency "docker" "Docker"

# Check Docker Compose (plugin or standalone)
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
    log_success "Found Docker Compose Plugin"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
    log_success "Found docker-compose standalone"
else
    MISSING_DEPS+=("Docker Compose")
fi

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    log_error "Missing required system dependencies: ${MISSING_DEPS[*]}"
    
    if [ "$AUTO_INSTALL_DEPS" = true ]; then
        log_info "Auto-installing missing dependencies via apt..."
        sudo apt-get update -y
        sudo apt-get install -y git curl build-essential python3 python3-pip python3-venv
        
        if [[ " ${MISSING_DEPS[*]} " =~ " Node.js " ]]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
        
        if [[ " ${MISSING_DEPS[*]} " =~ " pnpm " ]]; then
            curl -fsSL https://get.pnpm.io/install.sh | sh -
            export PNPM_HOME="$HOME/.local/share/pnpm"
            export PATH="$PNPM_HOME:$PATH"
        fi
        
        if [[ " ${MISSING_DEPS[*]} " =~ " Docker " ]]; then
            curl -fsSL https://get.docker.com | sh
            sudo usermod -aG docker "$USER" || true
            sudo systemctl enable --now docker
        fi
    else
        echo -e "\nTo auto-install dependencies on Ubuntu, run:\n  ${YELLOW}sudo $0 --install-deps${NC}\n"
        exit 1
    fi
fi

# Ensure Docker Daemon is active
if ! docker info &> /dev/null; then
    log_warn "Docker daemon is not running. Attempting to start it..."
    sudo systemctl start docker || sudo service docker start || true
    sleep 2
    if ! docker info &> /dev/null; then
        log_error "Could not connect to Docker. Ensure your user is in the 'docker' group: sudo usermod -aG docker \$USER (then log out and log back in)."
        exit 1
    fi
fi

# ==============================================================================
# STEP 2: First-Run Detection & Environment Configuration
# ==============================================================================
log_step "Step 2: Checking Environment Configuration (.env files)"

FIRST_RUN=false

ensure_env_file() {
    local target=$1
    local example=$2
    local label=$3
    
    if [ ! -f "$target" ]; then
        FIRST_RUN=true
        log_warn "$label environment file not found at '$target'. Generating from example..."
        if [ -f "$example" ]; then
            cp "$example" "$target"
        else
            touch "$target"
        fi
        log_success "Created '$target'"
    else
        log_success "$label environment file is ready."
    fi
}

ensure_env_file "apps/backend/.env" "apps/backend/.env.example" "Backend"
ensure_env_file "apps/worker/.env" "apps/worker/.env.example" "Worker"
ensure_env_file "apps/frontend/.env.local" "apps/frontend/.env.local" "Frontend"
ensure_env_file "apps/livekit-agent/.env" "apps/livekit-agent/.env.example" "LiveKit Agent"

# Ensure backend .env has necessary base settings for local docker infra
if ! grep -q "DATABASE_URL=" apps/backend/.env || grep -q "DATABASE_URL=$" apps/backend/.env; then
    sed -i '/DATABASE_URL=/d' apps/backend/.env 2>/dev/null || true
    echo "DATABASE_URL=\"postgresql://postgres:postgres@localhost:5432/jibu?schema=public\"" >> apps/backend/.env
fi

if ! grep -q "PORT=" apps/backend/.env; then
    echo "PORT=4000" >> apps/backend/.env
fi

if ! grep -q "ENCRYPTION_MASTER_KEY=" apps/backend/.env || grep -q "ENCRYPTION_MASTER_KEY=$" apps/backend/.env; then
    MASTER_KEY=$(openssl rand -hex 16 2>/dev/null || echo "0123456789abcdef0123456789abcdef")
    sed -i '/ENCRYPTION_MASTER_KEY=/d' apps/backend/.env 2>/dev/null || true
    echo "ENCRYPTION_MASTER_KEY=\"$MASTER_KEY\"" >> apps/backend/.env
fi

# ==============================================================================
# STEP 3: Dependencies Installation (Node + Python venv)
# ==============================================================================
log_step "Step 3: Checking Node & Python Dependencies"

# 1. Node modules
if [ ! -d "node_modules" ] || [ "$FIRST_RUN" = true ]; then
    log_info "Installing Node workspace dependencies via pnpm..."
    pnpm install --frozen-lockfile=false
    log_success "Node dependencies installed."
else
    log_success "Node workspace dependencies already installed."
fi

# 2. Python virtualenv for LiveKit Voice Agent
VENV_DIR="apps/livekit-agent/venv"
if [ ! -d "$VENV_DIR" ]; then
    log_info "Creating Python virtual environment for LiveKit Voice Agent..."
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install --upgrade pip
    if [ -f "apps/livekit-agent/requirements.txt" ]; then
        log_info "Installing Python dependencies from requirements.txt..."
        "$VENV_DIR/bin/pip" install -r apps/livekit-agent/requirements.txt
    fi
    log_success "Python virtual environment created & dependencies installed."
else
    log_success "Python virtual environment for LiveKit Agent exists."
fi

# ==============================================================================
# STEP 4: Start Docker Infrastructure
# ==============================================================================
log_step "Step 4: Starting Docker Infrastructure Containers"

log_info "Running '$DOCKER_COMPOSE up -d' for databases & middleware..."
$DOCKER_COMPOSE up -d postgres redis qdrant vault livekit n8n ollama

# Wait for essential services
log_info "Waiting for database and message brokers to be healthy..."

wait_for_port() {
    local service=$1
    local port=$2
    local max_retries=30
    local count=0
    
    while ! nc -z 127.0.0.1 "$port" 2>/dev/null && ! timeout 1 bash -c "</dev/tcp/127.0.0.1/$port" 2>/dev/null; do
        sleep 1
        count=$((count + 1))
        if [ "$count" -ge "$max_retries" ]; then
            log_warn "$service did not respond on port $port within $max_retries seconds, proceeding anyway..."
            return 1
        fi
    done
    log_success "$service is ready on port $port."
}

wait_for_port "PostgreSQL" 5432
wait_for_port "Redis" 6379
wait_for_port "Qdrant" 6333
wait_for_port "LiveKit Server" 7880

# ==============================================================================
# STEP 5: Prisma Database Migrations & Client Generation
# ==============================================================================
log_step "Step 5: Database Migrations & Prisma Generation"

log_info "Generating Prisma Client..."
pnpm dlx dotenv-cli -e apps/backend/.env -- prisma generate --schema=./apps/backend/prisma/schema.prisma

log_info "Deploying Prisma database migrations..."
pnpm dlx dotenv-cli -e apps/backend/.env -- prisma migrate deploy --schema=./apps/backend/prisma/schema.prisma 2>/dev/null || {
    log_warn "Prisma migrate deploy had an issue, falling back to 'prisma db push'..."
    pnpm dlx dotenv-cli -e apps/backend/.env -- prisma db push --schema=./apps/backend/prisma/schema.prisma --accept-data-loss
}
log_success "Database schema is synchronized."

if [ "$MODE" = "setup-only" ]; then
    echo -e "\n${GREEN}${BOLD}Setup completed successfully!${NC}"
    echo "To run Jibu AI in development mode: ./start.sh --dev"
    echo "To run Jibu AI in background mode (PM2): ./start.sh --daemon"
    exit 0
fi

# Detect Server Public / LAN IP
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

# ==============================================================================
# STEP 6: Service Orchestration & Execution
# ==============================================================================
log_step "Step 6: Launching Jibu AI Services"

print_dashboard() {
    echo -e "${GREEN}${BOLD}"
    cat << "EOF"
  ===================================================================
                         JIBU AI IS LIVE 🚀
  ===================================================================
EOF
    echo -e "${NC}"
    echo -e "  🌐 ${BOLD}Frontend Web Console:${NC}    http://${SERVER_IP}:3000 (or http://localhost:3000)"
    echo -e "  ⚙️  ${BOLD}Backend API:${NC}             http://${SERVER_IP}:4000/api"
    echo -e "  📚 ${BOLD}Swagger API Docs:${NC}        http://${SERVER_IP}:4000/api/docs"
    echo -e "  🔄 ${BOLD}Queue Worker:${NC}            http://${SERVER_IP}:3001 (Active)"
    echo -e "  🎙️  ${BOLD}LiveKit Voice Server:${NC}    ws://${SERVER_IP}:7880"
    echo -e "  🗄️  ${BOLD}Qdrant Vector DB:${NC}        http://${SERVER_IP}:6333"
    echo -e "  🤖 ${BOLD}n8n Automation:${NC}         http://${SERVER_IP}:5678"
    echo -e "  📊 ${BOLD}Grafana Dashboards:${NC}      http://${SERVER_IP}:3100 (admin/admin)"
    echo -e "${GREEN}${BOLD}  ===================================================================${NC}"
}

# --- MODE: DAEMON / PM2 (Production background) ---
if [ "$MODE" = "daemon" ]; then
    log_info "Starting services in persistent background mode via PM2..."
    
    if ! command -v pm2 &> /dev/null; then
        log_info "Installing PM2 globally..."
        npm install -g pm2 2>/dev/null || pnpm add -g pm2
    fi
    
    pm2 start ecosystem.config.js
    pm2 save
    print_dashboard
    
    echo -e "\n${BOLD}Helpful PM2 Commands on Ubuntu:${NC}"
    echo "  - View live logs:     ${CYAN}pm2 logs${NC}"
    echo "  - View status:        ${CYAN}pm2 status${NC}"
    echo "  - Stop all services:  ${CYAN}./start.sh --stop${NC}"
    echo "  - Restart all:        ${CYAN}pm2 restart all${NC}"
    exit 0
fi

# --- MODE: INTERACTIVE DEV (Foreground with log prefixes & graceful trap) ---
print_dashboard
echo -e "\n${YELLOW}${BOLD}Streaming logs from all services. Press [Ctrl + C] to stop.${NC}\n"

# Array to store child PIDs
CHILD_PIDS=()

cleanup() {
    echo -e "\n\n${YELLOW}${BOLD}[SHUTDOWN] Stopping all Jibu AI services...${NC}"
    for pid in "${CHILD_PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    wait 2>/dev/null || true
    echo -e "${GREEN}[SHUTDOWN] All application services stopped.${NC}"
    echo -e "Docker containers are still running. To stop them, run: ${CYAN}./start.sh --stop${NC}\n"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Function to run command and prefix output with color tags
run_with_prefix() {
    local color=$1
    local tag=$2
    shift 2
    "$@" 2>&1 | while IFS= read -r line; do
        echo -e "${color}[${tag}]${NC} $line"
    done
}

# 1. Start Backend (NestJS)
run_with_prefix "$BLUE" "BACKEND" pnpm exec nx serve backend &
CHILD_PIDS+=($!)

# 2. Start Worker (BullMQ)
run_with_prefix "$MAGENTA" "WORKER " pnpm exec nx run worker:worker &
CHILD_PIDS+=($!)

# 3. Start Frontend (Next.js)
run_with_prefix "$CYAN" "FRONTEND" pnpm exec nx serve frontend &
CHILD_PIDS+=($!)

# 4. Start LiveKit Python Voice Agent
if [ -f "$VENV_DIR/bin/python" ]; then
    run_with_prefix "$YELLOW" "VOICE-AG" bash -c "cd apps/livekit-agent && ./venv/bin/python src/main.py dev" &
    CHILD_PIDS+=($!)
fi

# Wait for all background tasks
wait
