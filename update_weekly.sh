#!/bin/bash
# Weekly update: run scanner, rebuild data, deploy to VPS.
# Cron-friendly: logs to weekly_update.log, exits non-zero on failure.
set -euo pipefail

ROOT="$HOME/Documents/claudcode/math-curve-loaders"
SCANNER_DIR="$HOME/Desktop/peter-brandt-cheatsheet"
LOG="$ROOT/weekly_update.log"
VPS_HOST="23.95.146.192"
VPS_USER="root"
# shellcheck disable=SC2155
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

log "=== Weekly update starting ==="

# 1. Run the scanner
log "Step 1: running scan_patterns.py"
cd "$SCANNER_DIR"
python3 scan_patterns.py >> "$LOG" 2>&1 || { log "FAIL: scanner"; exit 1; }

# 2. Rebuild scan_latest.json
log "Step 2: building scan_latest.json"
cd "$ROOT"
python3 build_scan_data.py >> "$LOG" 2>&1 || { log "FAIL: build_scan_data"; exit 1; }

# 3. Archive this week's scan (for later backtest)
log "Step 3: archiving scan_latest.json"
ARCHIVE_DIR="$ROOT/data/archive"
mkdir -p "$ARCHIVE_DIR"
ARCHIVE_FILE="$ARCHIVE_DIR/$(date +%Y-%m-%d).json"
cp "$ROOT/data/scan_latest.json" "$ARCHIVE_FILE" && log "  → $ARCHIVE_FILE"

# 4. Regenerate debug JSONs for all symbols
log "Step 4: building debug JSONs (101 symbols)"
python3 build_pattern_debug.py --all >> "$LOG" 2>&1 || { log "FAIL: build_pattern_debug"; exit 1; }

# 5. Commit archive + refreshed data to git
log "Step 5: committing weekly snapshot to git"
cd "$ROOT"
git add data/ >> "$LOG" 2>&1 || true
git commit -m "data: weekly scan snapshot $(date +%Y-%m-%d)" >> "$LOG" 2>&1 || log "  (nothing to commit)"
git push >> "$LOG" 2>&1 || log "  (git push failed, continuing)"

# 6. Deploy to VPS
log "Step 6: deploying to VPS $VPS_HOST"
# Read VPS password from keychain or env — fall back to file-based secret
VPS_PASS="${VPS_PASS:-$(security find-generic-password -s 'peter-brandt-vps' -w 2>/dev/null || echo '')}"
if [ -z "$VPS_PASS" ]; then
  log "FAIL: no VPS_PASS in env or keychain (service=peter-brandt-vps)"
  exit 1
fi

sshpass -p "$VPS_PASS" scp -o StrictHostKeyChecking=no -q \
  "$ROOT/data/scan_latest.json" "$VPS_USER@$VPS_HOST:/var/www/charts/data/" \
  >> "$LOG" 2>&1

sshpass -p "$VPS_PASS" scp -o StrictHostKeyChecking=no -q \
  "$ROOT/data/"debug-*.json "$VPS_USER@$VPS_HOST:/var/www/charts/data/" \
  >> "$LOG" 2>&1

log "=== Weekly update complete ==="
