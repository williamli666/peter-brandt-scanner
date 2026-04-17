#!/bin/bash
# Per-tab refresh dispatcher called by trigger_server.py.
# Usage: trigger_update.sh <scan|daily|futures|munger|backtest>
set -euo pipefail

SRC="${1:-}"
ROOT="$HOME/Documents/claudcode/math-curve-loaders"
VPS_HOST="23.95.146.192"
VPS_USER="root"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

VPS_PASS="${VPS_PASS:-$(security find-generic-password -s 'peter-brandt-vps' -w 2>/dev/null || echo '')}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

push() {
  local args=("$@")
  if [ -z "$VPS_PASS" ]; then
    log "  (no VPS_PASS, skipping scp)"
    return
  fi
  sshpass -p "$VPS_PASS" scp -o StrictHostKeyChecking=no -q "${args[@]}"
}

# Commit only the paths listed for this source — keep git history per-project.
commit_paths() {
  local msg="$1"
  shift
  cd "$ROOT"
  git add "$@" 2>/dev/null || true
  if git diff --cached --quiet; then
    log "  (no git changes for this source)"
    return
  fi
  git commit -m "$msg" >/dev/null 2>&1 || { log "  (commit failed)"; return; }
  git push >/dev/null 2>&1 || log "  (push failed, continuing)"
  log "  git: committed + pushed"
}

case "$SRC" in
  scan)
    log "=== refreshing Live Scan (weekly pattern scanner) ==="
    cd "$HOME/Desktop/peter-brandt-cheatsheet"
    python3 scan_patterns.py
    cd "$ROOT"
    python3 build_scan_data.py
    python3 build_pattern_debug.py --all
    # Archive this week's candidates for the backtest pipeline
    mkdir -p "$ROOT/data/archive"
    cp "$ROOT/data/scan_latest.json" "$ROOT/data/archive/$(date +%Y-%m-%d).json"
    push "$ROOT/data/scan_latest.json" "$VPS_USER@$VPS_HOST:/var/www/charts/data/"
    push "$ROOT/data/"debug-*.json "$VPS_USER@$VPS_HOST:/var/www/charts/data/"
    commit_paths "data(scan): refresh $(date +%Y-%m-%d)" \
      data/scan_latest.json data/debug-*.json data/archive/
    ;;
  daily)
    log "=== refreshing Daily Gary Norden ==="
    cd "$HOME/Desktop/gary-norden-book"
    /usr/bin/python3 gary_analysis.py || log "  (analysis skipped/failed)"
    cd "$ROOT"
    python3 build_reports.py daily
    sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
      "mkdir -p /var/www/charts/data/daily" 2>/dev/null || true
    push "$ROOT/data/daily_index.json" "$VPS_USER@$VPS_HOST:/var/www/charts/data/"
    push "$ROOT/data/daily/"*.html "$VPS_USER@$VPS_HOST:/var/www/charts/data/daily/"
    commit_paths "data(daily): Gary Norden $(date +%Y-%m-%d)" \
      data/daily/ data/daily_index.json
    ;;
  futures)
    log "=== refreshing Futures daily report ==="
    cd "$HOME/Desktop/期货日日报"
    /usr/bin/python3 daily_report.py || log "  (report skipped/failed)"
    cd "$ROOT"
    python3 build_reports.py futures
    sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
      "mkdir -p /var/www/charts/data/futures" 2>/dev/null || true
    push "$ROOT/data/futures_index.json" "$VPS_USER@$VPS_HOST:/var/www/charts/data/"
    push "$ROOT/data/futures/"*.html "$VPS_USER@$VPS_HOST:/var/www/charts/data/futures/"
    commit_paths "data(futures): $(date +%Y-%m-%d)" \
      data/futures/ data/futures_index.json
    ;;
  munger)
    log "=== refreshing Munger 200-week MA scan ==="
    cd "$HOME/Desktop/芒格200周均线"
    /usr/bin/python3 scan.py || log "  (scan skipped/failed)"
    cd "$ROOT"
    python3 build_reports.py munger
    sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
      "mkdir -p /var/www/charts/data/munger" 2>/dev/null || true
    push "$ROOT/data/munger_index.json" "$VPS_USER@$VPS_HOST:/var/www/charts/data/"
    push "$ROOT/data/munger/"*.html "$VPS_USER@$VPS_HOST:/var/www/charts/data/munger/"
    commit_paths "data(munger): $(date +%Y-%m-%d)" \
      data/munger/ data/munger_index.json
    ;;
  backtest)
    log "=== rerunning backtest over archived scans ==="
    cd "$ROOT"
    python3 build_backtest.py
    push "$ROOT/data/backtest_summary.json" "$VPS_USER@$VPS_HOST:/var/www/charts/data/"
    commit_paths "data(backtest): $(date +%Y-%m-%d)" data/backtest_summary.json
    ;;
  *)
    echo "Usage: $0 {scan|daily|futures|munger|backtest}" >&2
    exit 2
    ;;
esac

log "=== done ($SRC) ==="
