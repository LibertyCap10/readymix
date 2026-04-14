#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-local.sh — Start ReadyMix in local development mode
#
# Starts SAM local API, seeds DynamoDB with timeline-aware data,
# and launches the Vite dev server. Everything runs on localhost.
#
# Usage:
#   ./deploy-local.sh              Full local stack (backend + seed + frontend)
#   ./deploy-local.sh --skip-seed  Skip re-seeding DynamoDB
#   ./deploy-local.sh --seed-only  Just re-seed DynamoDB and exit
#   ./deploy-local.sh --ticker     Invoke the ticker Lambda once (advance orders)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# ── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

step()  { echo -e "\n${BLUE}==>${NC} ${CYAN}$1${NC}"; }
ok()    { echo -e "    ${GREEN}$1${NC}"; }
warn()  { echo -e "    ${YELLOW}$1${NC}"; }
fail()  { echo -e "    ${RED}$1${NC}"; exit 1; }

# ── Parse flags ───────────────────────────────────────────────────────────
SKIP_SEED=false
SEED_ONLY=false
TICKER_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --skip-seed)  SKIP_SEED=true ;;
    --seed-only)  SEED_ONLY=true ;;
    --ticker)     TICKER_ONLY=true ;;
    --help|-h)
      echo "Usage: ./deploy-local.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-seed   Skip DynamoDB re-seeding"
      echo "  --seed-only   Just re-seed DynamoDB and exit"
      echo "  --ticker      Invoke the ticker Lambda once and exit"
      echo "  --help        Show this help"
      exit 0
      ;;
    *) warn "Unknown flag: $arg" ;;
  esac
done

# ── Preflight checks ─────────────────────────────────────────────────────
step "Preflight checks"

command -v sam  >/dev/null 2>&1 || fail "sam CLI not found. Install: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
command -v node >/dev/null 2>&1 || fail "node not found. Install Node.js 20+"
command -v npm  >/dev/null 2>&1 || fail "npm not found"
ok "All tools present (sam, node, npm)"

# ── Ticker-only mode ─────────────────────────────────────────────────────
if [ "$TICKER_ONLY" = true ]; then
  step "Invoking Ticker Lambda locally"
  cd "$BACKEND_DIR"
  sam local invoke TickerFunction --env-vars env.json 2>&1 | tail -20
  ok "Ticker invocation complete"
  exit 0
fi

# ── Seed-only mode ───────────────────────────────────────────────────────
if [ "$SEED_ONLY" = true ]; then
  step "Re-seeding DynamoDB with timeline-aware data"
  cd "$BACKEND_DIR"
  ENVIRONMENT=dev node scripts/seed-dynamodb.mjs --clear
  ok "Seed complete"
  exit 0
fi

# ── Build backend ─────────────────────────────────────────────────────────
step "Building backend (SAM)"
cd "$BACKEND_DIR"
sam build --cached --parallel 2>&1 | tail -5
ok "Backend built"

# ── Seed DynamoDB ─────────────────────────────────────────────────────────
if [ "$SKIP_SEED" = false ]; then
  step "Seeding DynamoDB with timeline-aware data"
  ENVIRONMENT=dev node scripts/seed-dynamodb.mjs --clear
  ok "Seed complete"
else
  warn "Skipping DynamoDB seed (--skip-seed)"
fi

# ── Install frontend deps if needed ──────────────────────────────────────
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  step "Installing frontend dependencies"
  cd "$FRONTEND_DIR"
  npm install
fi

# ── Start everything ─────────────────────────────────────────────────────
step "Starting local development stack"
echo ""
echo -e "  ${CYAN}Backend API:${NC}  http://localhost:3001"
echo -e "  ${CYAN}Frontend:${NC}     http://localhost:3000"
echo ""
echo -e "  ${YELLOW}Starting SAM local API in the background...${NC}"
echo -e "  ${YELLOW}Then starting Vite dev server in the foreground.${NC}"
echo -e "  ${YELLOW}Press Ctrl+C to stop both.${NC}"
echo ""

# Start SAM in background, capture PID for cleanup
cd "$BACKEND_DIR"
sam local start-api --port 3001 --env-vars env.json --warm-containers EAGER 2>&1 &
SAM_PID=$!

# Cleanup on exit
cleanup() {
  echo ""
  step "Shutting down"
  kill $SAM_PID 2>/dev/null && ok "SAM local API stopped" || true
}
trap cleanup EXIT

# Give SAM a moment to start
sleep 2

# Start frontend dev server (foreground — Ctrl+C stops everything)
cd "$FRONTEND_DIR"
npm run dev
