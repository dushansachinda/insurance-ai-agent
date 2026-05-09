#!/usr/bin/env bash

# Stop Services Script - Companion to start-services.sh.
# Reads logs/*.pid, kills those processes, and as a safety net kills anything
# still listening on the demo's well-known ports.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_DIR="$SCRIPT_DIR/logs"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status()  { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

trap 'print_error "stop-services.sh failed at line $LINENO"' ERR

stop_service() {
    local name=$1
    local pid_file="${LOG_DIR}/${name}.pid"

    if [ -f "${pid_file}" ]; then
        local pid
        pid=$(cat "${pid_file}")
        if [ -n "${pid}" ] && ps -p "${pid}" > /dev/null 2>&1; then
            print_status "Stopping ${name} (PID: ${pid})..."
            kill "${pid}" 2>/dev/null || true
            sleep 2
            if ps -p "${pid}" > /dev/null 2>&1; then
                print_warning "Force killing ${name}..."
                kill -9 "${pid}" 2>/dev/null || true
            fi
            print_success "${name} stopped"
        else
            print_warning "${name} was not running"
        fi
        rm -f "${pid_file}"
    else
        print_warning "No PID file for ${name}"
    fi
}

kill_port() {
    local port=$1
    local label=$2
    local pid
    pid=$(lsof -ti:"${port}" 2>/dev/null || true)
    if [ -n "${pid}" ]; then
        print_status "Killing ${label} on port ${port} (PID: ${pid})"
        kill -9 ${pid} 2>/dev/null || true
        print_success "${label} stopped"
    fi
}

print_status "Stopping Insurance AI Agent services"
echo "=========================================="

stop_service "backend"
stop_service "mcp-credit-check"
stop_service "supervisor-agent"
stop_service "frontend"

print_status "Cleaning up any remaining processes on demo ports..."
kill_port 8001 "backend"
kill_port 8003 "mcp-credit-check"
kill_port 8000 "supervisor-agent"
kill_port 3000 "frontend"

print_success "All services stopped."
