#!/usr/bin/env python3
"""
Build pattern debug JSON for a single symbol, used by debug.html to visualize
the exact structure the scanner detected (left shoulder / head / right shoulder
/ neckline / target) against the actual weekly OHLC series.
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf

ROOT = Path(__file__).resolve().parent
SCAN_DIR = Path.home() / "Desktop/peter-brandt-cheatsheet/scan_results"
RANKED_JSON = SCAN_DIR / "pattern_ranked.json"
PATTERN_JSON = SCAN_DIR / "pattern_scan.json"
OUTPUT_DIR = ROOT / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(Path.home() / "Desktop/peter-brandt-cheatsheet"))
from scan_patterns import FUTURES, FOREX, STOCKS_ETF, CRYPTO  # noqa: E402

ALL_SYMBOLS = {**FUTURES, **FOREX, **STOCKS_ETF, **CRYPTO}


def fetch_weekly_bars(symbol: str) -> list[dict]:
    """Fetch the same 2y weekly data the scanner uses."""
    df = yf.Ticker(symbol).history(period="2y", interval="1wk", auto_adjust=False)
    df = df.dropna(subset=["Close"])
    bars = []
    for idx, row in df.iterrows():
        bars.append({
            "date": idx.strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 4),
            "high": round(float(row["High"]), 4),
            "low": round(float(row["Low"]), 4),
            "close": round(float(row["Close"]), 4),
        })
    return bars


def symbol_to_filename(symbol: str) -> str:
    return f"debug-{symbol.replace('=', '').replace('-', '').lower()}.json"


def build_one(symbol: str, all_patterns: list[dict], ranked: dict[str, dict]) -> tuple[str, int | None]:
    """Build debug JSON for a single symbol. Returns (symbol, size) or (symbol, None) on failure."""
    try:
        bars = fetch_weekly_bars(symbol)
        if not bars:
            return symbol, None
        entry = ranked.get(symbol, {})
        symbol_patterns = [p for p in all_patterns if p["symbol"] == symbol]
        payload = {
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "symbol": symbol,
            "name": ALL_SYMBOLS.get(symbol, symbol),
            "lastPrice": bars[-1]["close"],
            "lastDate": bars[-1]["date"],
            "netDirection": entry.get("net_direction"),
            "stopLoss": entry.get("stop_loss"),
            "primaryPattern": entry.get("primary_pattern"),
            "primaryTarget": entry.get("primary_target"),
            "bars": bars,
            "patterns": symbol_patterns,
        }
        out_path = OUTPUT_DIR / symbol_to_filename(symbol)
        out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return symbol, out_path.stat().st_size
    except Exception as exc:  # noqa: BLE001
        print(f"  ! {symbol}: {exc}", flush=True)
        return symbol, None


def build_all() -> None:
    """Batch-generate debug JSON for every universe symbol."""
    ranked = {e["symbol"]: e for e in json.loads(RANKED_JSON.read_text(encoding="utf-8"))}
    all_patterns = json.loads(PATTERN_JSON.read_text(encoding="utf-8"))
    symbols = list(ALL_SYMBOLS.keys())
    print(f"Generating debug JSON for {len(symbols)} symbols (parallel)…", flush=True)

    ok = 0
    total_bytes = 0
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(build_one, s, all_patterns, ranked) for s in symbols]
        for i, fut in enumerate(as_completed(futures), 1):
            _, size = fut.result()
            if size:
                ok += 1
                total_bytes += size
            if i % 20 == 0:
                print(f"  … {i}/{len(symbols)}", flush=True)
    print(f"\n{ok}/{len(symbols)} debug files written, {total_bytes / 1024:.0f} KB total.")


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--all":
        build_all()
        return

    target = sys.argv[1] if len(sys.argv) > 1 else "HE=F"
    ranked = {e["symbol"]: e for e in json.loads(RANKED_JSON.read_text(encoding="utf-8"))}
    all_patterns = json.loads(PATTERN_JSON.read_text(encoding="utf-8"))
    print(f"→ Fetching weekly bars for {target}…", flush=True)
    sym, size = build_one(target, all_patterns, ranked)
    if size:
        print(f"\nWrote {OUTPUT_DIR / symbol_to_filename(sym)} ({size} bytes)")
        anchors = [p for p in all_patterns if p["symbol"] == target and "left_shoulder" in p]
        for p in anchors:
            print(
                f"  {p['pattern']}: LS={p['left_shoulder']} LP={p.get('left_peak')}"
                f" Head={p['head']} RP={p.get('right_peak')} RS={p['right_shoulder']}"
                f" neckline={p['neckline']}"
            )


if __name__ == "__main__":
    main()
