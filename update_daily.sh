#!/bin/bash
# Daily Gary Norden analysis update: generate new report if needed, refresh
# the website's daily_index.json, copy HTMLs, deploy to VPS.
set -euo pipefail

ROOT="$HOME/Documents/claudcode/math-curve-loaders"
GARY_DIR="$HOME/Desktop/gary-norden-book"
LOG="$ROOT/daily_update.log"
VPS_HOST="23.95.146.192"
VPS_USER="root"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

log "=== Daily update starting ==="

# 1. Generate today's Gary analysis (skips if already exists)
log "Step 1: running gary_analysis.py"
cd "$GARY_DIR"
/usr/bin/python3 gary_analysis.py >> "$LOG" 2>&1 || log "  (analysis skipped or failed)"

# 2. Sync to website data folder
log "Step 2: syncing to data/daily/"
cd "$ROOT"
python3 build_daily_index.py >> "$LOG" 2>&1

# 3. Deploy to VPS
log "Step 3: deploying to VPS"
VPS_PASS="${VPS_PASS:-$(security find-generic-password -s 'peter-brandt-vps' -w 2>/dev/null || echo '')}"
if [ -z "$VPS_PASS" ]; then
  log "FAIL: no VPS_PASS"
  exit 1
fi

sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  "mkdir -p /var/www/charts/data/daily" >> "$LOG" 2>&1

sshpass -p "$VPS_PASS" scp -o StrictHostKeyChecking=no -q \
  "$ROOT/data/daily_index.json" "$VPS_USER@$VPS_HOST:/var/www/charts/data/" \
  >> "$LOG" 2>&1

sshpass -p "$VPS_PASS" scp -o StrictHostKeyChecking=no -q \
  "$ROOT/data/daily/"*.html "$VPS_USER@$VPS_HOST:/var/www/charts/data/daily/" \
  >> "$LOG" 2>&1

# 4. Commit new report to git
cd "$ROOT"
git add data/daily/ data/daily_index.json >> "$LOG" 2>&1 || true
git commit -m "data: daily Gary Norden analysis $(date +%Y-%m-%d)" >> "$LOG" 2>&1 || log "  (nothing to commit)"
git push >> "$LOG" 2>&1 || log "  (push failed, continuing)"

log "=== Daily update complete ==="
