#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-aws.sh — Deploy ReadyMix to AWS
#
# Builds and deploys the full stack: SAM backend (Lambdas, DynamoDB, API GW,
# Ticker, CloudFront) and frontend (S3 + CDN invalidation).
#
# Usage:
#   ./deploy-aws.sh                     Full deploy (backend + frontend)
#   ./deploy-aws.sh --skip-backend      Frontend only (build + S3 + CDN)
#   ./deploy-aws.sh --skip-frontend     Backend only (SAM build + deploy)
#   ./deploy-aws.sh --seed              Also re-seed DynamoDB after deploy
#   ./deploy-aws.sh --seed --clear      Clear + re-seed DynamoDB
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# ── Config ────────────────────────────────────────────────────────────────
STACK_NAME="readymix-dashboard"
REGION="us-east-1"
ENVIRONMENT="dev"

# ── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

step()  { echo -e "\n${BLUE}==>${NC} ${CYAN}$1${NC}"; }
ok()    { echo -e "    ${GREEN}$1${NC}"; }
warn()  { echo -e "    ${YELLOW}$1${NC}"; }
fail()  { echo -e "    ${RED}$1${NC}"; exit 1; }

# ── Parse flags ───────────────────────────────────────────────────────────
SKIP_BACKEND=false
SKIP_FRONTEND=false
DO_SEED=false
SEED_CLEAR=""
for arg in "$@"; do
  case "$arg" in
    --skip-backend)   SKIP_BACKEND=true ;;
    --skip-frontend)  SKIP_FRONTEND=true ;;
    --seed)           DO_SEED=true ;;
    --clear)          SEED_CLEAR="--clear" ;;
    --help|-h)
      echo "Usage: ./deploy-aws.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-backend    Skip SAM build + deploy (frontend only)"
      echo "  --skip-frontend   Skip frontend build + S3 sync (backend only)"
      echo "  --seed            Re-seed DynamoDB after deploy"
      echo "  --clear           Used with --seed: clear tables before seeding"
      echo "  --help            Show this help"
      echo ""
      echo "Examples:"
      echo "  ./deploy-aws.sh                          # Full deploy"
      echo "  ./deploy-aws.sh --skip-backend            # Just update the frontend"
      echo "  ./deploy-aws.sh --seed --clear            # Full deploy + fresh seed"
      echo "  ./deploy-aws.sh --skip-frontend           # Backend only deploy"
      exit 0
      ;;
    *) warn "Unknown flag: $arg" ;;
  esac
done

# ── Preflight checks ─────────────────────────────────────────────────────
step "Preflight checks"

command -v aws  >/dev/null 2>&1 || fail "aws CLI not found. Install: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
command -v sam  >/dev/null 2>&1 || fail "sam CLI not found. Install: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
command -v node >/dev/null 2>&1 || fail "node not found. Install Node.js 20+"
command -v npm  >/dev/null 2>&1 || fail "npm not found"

# Verify AWS credentials
aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1 || fail "AWS credentials not configured. Run: aws configure"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ok "AWS account: $ACCOUNT_ID  Region: $REGION"
ok "Stack: $STACK_NAME  Environment: $ENVIRONMENT"

DEPLOY_START=$SECONDS

# ══════════════════════════════════════════════════════════════════════════
# BACKEND
# ══════════════════════════════════════════════════════════════════════════

if [ "$SKIP_BACKEND" = false ]; then
  # ── Build ───────────────────────────────────────────────────────────────
  step "Building backend (SAM)"
  cd "$BACKEND_DIR"
  sam build --cached --parallel 2>&1 | tail -5
  ok "Backend built"

  # ── Deploy ──────────────────────────────────────────────────────────────
  step "Deploying backend to AWS"

  sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --parameter-overrides "Environment=$ENVIRONMENT" \
    --capabilities CAPABILITY_IAM \
    --resolve-s3 \
    --s3-prefix "$STACK_NAME" \
    --fail-on-empty-changeset false \
    --no-confirm-changeset \
    --tags "Project=readymix" "Environment=$ENVIRONMENT"

  ok "Backend deployed"
else
  warn "Skipping backend (--skip-backend)"
fi

# ── Read stack outputs ────────────────────────────────────────────────────
step "Reading stack outputs"

get_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}

API_URL=$(get_output "ApiUrl")
BUCKET=$(get_output "FrontendBucketName")
DIST_ID=$(get_output "FrontendDistributionId")
FRONTEND_URL=$(get_output "FrontendUrl")

ok "API:        $API_URL"
ok "S3 Bucket:  $BUCKET"
ok "CloudFront: $DIST_ID"

# ── Seed (optional) ──────────────────────────────────────────────────────
if [ "$DO_SEED" = true ]; then
  step "Seeding DynamoDB"
  if [ -n "$SEED_CLEAR" ]; then
    warn "Clearing all tables before seeding"
  fi
  cd "$BACKEND_DIR"
  ENVIRONMENT="$ENVIRONMENT" node scripts/seed-dynamodb.mjs $SEED_CLEAR
  ok "Seed complete"
fi

# ══════════════════════════════════════════════════════════════════════════
# FRONTEND
# ══════════════════════════════════════════════════════════════════════════

if [ "$SKIP_FRONTEND" = false ]; then
  # ── Build ───────────────────────────────────────────────────────────────
  step "Building frontend"
  cd "$FRONTEND_DIR"

  # Ensure .env.production has the correct API URL
  if ! grep -q "$API_URL" .env.production 2>/dev/null; then
    warn "Updating .env.production with current API URL"
    # Replace the VITE_API_BASE_URL line, preserve MAPBOX token
    sed -i.bak "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$API_URL|" .env.production
    rm -f .env.production.bak
  fi

  npm run build 2>&1 | tail -5
  ok "Frontend built (dist/)"

  # ── Upload to S3 ────────────────────────────────────────────────────────
  step "Uploading to S3"
  aws s3 sync dist/ "s3://$BUCKET" \
    --delete \
    --region "$REGION" \
    2>&1 | tail -5
  ok "S3 sync complete"

  # ── Invalidate CDN ─────────────────────────────────────────────────────
  step "Invalidating CloudFront cache"
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DIST_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)
  ok "Invalidation started: $INVALIDATION_ID"
  ok "Cache will clear in 1-2 minutes"
else
  warn "Skipping frontend (--skip-frontend)"
fi

# ══════════════════════════════════════════════════════════════════════════
# DONE
# ══════════════════════════════════════════════════════════════════════════

ELAPSED=$(( SECONDS - DEPLOY_START ))
MINS=$(( ELAPSED / 60 ))
SECS=$(( ELAPSED % 60 ))

echo ""
echo -e "${GREEN}${BOLD}  Deploy complete!${NC}  (${MINS}m ${SECS}s)"
echo ""
echo -e "  ${CYAN}App:${NC}      https://readymix.earth"
echo -e "  ${CYAN}CDN:${NC}      $FRONTEND_URL"
echo -e "  ${CYAN}API:${NC}      $API_URL"
echo ""

if [ "$SKIP_BACKEND" = false ]; then
  echo -e "  ${YELLOW}Note:${NC} The Ticker Lambda is now running every 1 minute via EventBridge."
  echo -e "  ${YELLOW}      ${NC} It will auto-advance orders through their delivery lifecycle."
  echo ""
fi
