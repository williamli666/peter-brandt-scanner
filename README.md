# Peter Brandt Chart Pattern Gallery

Animated gallery of classic Peter Brandt weekly chart patterns + live scanner for ~100 markets.

**Live demo:** http://23.95.146.192/

## Features

- **Gallery** — 11 animated classic patterns (Head & Shoulders, Triangles, Flags, Wedges, Double Top/Bottom)
  with trading points, identification checklists, Brandt's notes, and wisdom quotes
- **Live Scan** — Weekly scanner over ~100 markets (futures, forex, stocks/ETFs, crypto)
  with actionable bull/bear candidates ranked by signal strength
- **Debug / Validation page** — Click any candidate to visualize the scanner's detected pattern anchors
  (left shoulder, head, right shoulder, neckline, target) against the actual weekly OHLC

## Repo layout

```
.
├── index.html              # main page (gallery + live scan tabs)
├── debug.html              # per-symbol pattern validation page
├── main.js                 # gallery animation + scan UI
├── style.css
├── build_scan_data.py      # scan_latest.json builder (candidates only)
├── build_pattern_debug.py  # per-symbol debug JSON builder
├── update_weekly.sh        # weekly refresh: scan → build → deploy
├── com.peter-brandt.weekly.plist  # launchd schedule (Fridays)
└── data/                   # generated JSON (checked in for static hosting)
    ├── scan_latest.json    # actionable candidates
    └── debug-<symbol>.json # per-symbol OHLC + detected pattern anchors
```

## Regenerate data

```bash
# Run scanner (pulls yfinance weekly bars for ~100 symbols, detects patterns)
cd ~/Desktop/peter-brandt-cheatsheet && python3 scan_patterns.py

# Build front-end JSON
cd ~/Documents/claudcode/math-curve-loaders
python3 build_scan_data.py
python3 build_pattern_debug.py --all
```

## Weekly auto-update

See `update_weekly.sh` and `com.peter-brandt.weekly.plist` — scheduled every Friday.

## Deploy

Copy files to the VPS webroot:
```
/var/www/charts/
├── index.html  style.css  main.js  debug.html
└── data/*.json
```
