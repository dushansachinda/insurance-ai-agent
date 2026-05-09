#!/usr/bin/env bash

# Start Services Script - Local development alternative to docker-compose.
# Brings up backend, mcp-credit-check-server, supervisor-agent, and frontend
# locally with venvs and npm. Tolerant: a single failed service does not abort.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status()  { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

trap 'print_error "start-services.sh failed at line $LINENO"' ERR

command_exists() { command -v "$1" >/dev/null 2>&1; }

check_port() {
    local port=$1
    if lsof -Pi ":${port}" -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

kill_port() {
    local port=$1
    local pid
    pid=$(lsof -ti:"${port}" 2>/dev/null || true)
    if [ -n "${pid}" ]; then
        print_warning "Killing existing process on port ${port} (PID: ${pid})"
        kill -9 ${pid} 2>/dev/null || true
        sleep 1
    fi
}

# Start a Python service inside its own venv. Tolerates failure of any single
# service: prints the log path and continues with the next service.
#
# Usage: start_python_service <name> <dir> <port> [command...]
# If no command is given, defaults to `uvicorn app.main:app`.
start_python_service() {
    local name=$1
    local dir=$2
    local port=$3
    shift 3
    local cmd=("$@")
    if [ ${#cmd[@]} -eq 0 ]; then
        cmd=(uvicorn "app.main:app" --host 0.0.0.0 --port "${port}")
    fi

    print_status "Setting up ${name} (port ${port})..."

    if [ ! -d "${SCRIPT_DIR}/${dir}" ]; then
        print_error "Directory ${dir} does not exist - skipping ${name}"
        return 0
    fi

    if [ ! -f "${SCRIPT_DIR}/${dir}/requirements.txt" ]; then
        print_warning "${dir}/requirements.txt missing - skipping ${name}"
        return 0
    fi

    set +e
    (
        cd "${SCRIPT_DIR}/${dir}"

        if [ ! -d "venv" ]; then
            print_status "Creating venv for ${name}..."
            python3 -m venv venv
        fi

        # shellcheck disable=SC1091
        source venv/bin/activate
        pip install --upgrade pip >/dev/null
        pip install -r requirements.txt >/dev/null

        export PYTHONPATH="$(pwd)"
        # For local dev, point inter-service URLs at localhost; the .env file
        # may carry docker-compose hostnames which don't resolve outside the
        # docker network. Exporting here wins over python-dotenv's load_dotenv.
        export BACKEND_BASE_URL="http://localhost:8001"
        export MCP_CREDIT_CHECK_URL="http://localhost:8003/mcp"
        export BUREAU_ALPHA_URL="http://localhost:8004"
        export BUREAU_BETA_URL="http://localhost:8005"

        nohup "${cmd[@]}" > "${LOG_DIR}/${name}.log" 2>&1 &
        local pid=$!
        echo "${pid}" > "${LOG_DIR}/${name}.pid"
        deactivate
    )
    local rc=$?
    set -e

    if [ ${rc} -ne 0 ]; then
        print_error "${name} failed to start. Log: ${LOG_DIR}/${name}.log"
    else
        print_success "${name} launched (log: ${LOG_DIR}/${name}.log)"
    fi
}

print_status "Starting Insurance AI Agent services"
echo "=========================================="

# Prerequisites
print_status "Checking prerequisites..."
missing=0
for cmd in python3 node npm; do
    if ! command_exists "${cmd}"; then
        print_error "${cmd} is required but not installed"
        missing=1
    fi
done
if [ ${missing} -ne 0 ]; then
    exit 1
fi

# Free up the ports we use
print_status "Clearing ports 8000, 8001, 8003, 8004, 8005, 3000..."
for port in 8000 8001 8003 8004 8005 3000; do
    if ! check_port "${port}"; then
        kill_port "${port}"
    fi
done

# Backend (FastAPI)
start_python_service "backend" "backend" 8001 \
    uvicorn "app.main:app" --host 0.0.0.0 --port 8001

# Credit bureau services (called by the MCP server)
start_python_service "bureau-alpha" "credit-bureaus" 8004 \
    uvicorn bureau_alpha:app --host 0.0.0.0 --port 8004

start_python_service "bureau-beta" "credit-bureaus" 8005 \
    uvicorn bureau_beta:app --host 0.0.0.0 --port 8005

# MCP Credit Check server (FastMCP, started via its own server.py)
start_python_service "mcp-credit-check" "mcp-credit-check-server" 8003 \
    python server.py

# Supervisor agent (AutoGen + WebSocket)
start_python_service "supervisor-agent" "supervisor-agent" 8000 \
    uvicorn "app.service:app" --host 0.0.0.0 --port 8000

# Frontend (React)
print_status "Setting up frontend (port 3000)..."
if [ -d "${SCRIPT_DIR}/frontend" ]; then
    set +e
    (
        cd "${SCRIPT_DIR}/frontend"
        if [ ! -d "node_modules" ]; then
            print_status "Installing npm dependencies (this may take a minute)..."
            npm install >/dev/null
        fi
        nohup npm start > "${LOG_DIR}/frontend.log" 2>&1 &
        echo $! > "${LOG_DIR}/frontend.pid"
    )
    rc=$?
    set -e
    if [ ${rc} -ne 0 ]; then
        print_error "frontend failed to start. Log: ${LOG_DIR}/frontend.log"
    else
        print_success "frontend launched (log: ${LOG_DIR}/frontend.log)"
    fi
else
    print_warning "frontend directory missing - skipping"
fi

# Wait briefly and report status
print_status "Waiting for services to settle..."
sleep 6

print_status "Health checks:"
check_health() {
    local label=$1
    local url=$2
    if curl -sf -o /dev/null --max-time 3 "${url}"; then
        print_success "${label} responding at ${url}"
    else
        print_warning "${label} not responding at ${url} (may still be starting)"
    fi
}

check_health "backend"          "http://localhost:8001/health"
check_health "bureau-alpha"     "http://localhost:8004/health"
check_health "bureau-beta"      "http://localhost:8005/health"
# MCP server has no /health route; just check that the port is listening.
if lsof -Pi ":8003" -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_success "mcp-credit-check listening on port 8003"
else
    print_warning "mcp-credit-check not listening on port 8003 (may still be starting)"
fi
check_health "supervisor-agent" "http://localhost:8000/health"
check_health "frontend"         "http://localhost:3000"

echo ""
print_success "Startup sequence complete."
echo "=========================================="
echo "URLs:"
echo "  Frontend:         http://localhost:3000"
echo "  Backend API:      http://localhost:8001"
echo "  Supervisor agent: ws://localhost:8000/chat"
echo "  MCP credit check: http://localhost:8003/mcp"
echo "  BureauAlpha:      http://localhost:8004"
echo "  BureauBeta:       http://localhost:8005"
echo ""
echo "Logs:  tail -f logs/<service>.log"
echo "Stop:  ./stop-services.sh"
