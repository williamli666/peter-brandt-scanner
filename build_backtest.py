#!/usr/bin/env python3
"""
Backtest the scanner's historical recommendations.

Reads every archived scan in data/archive/YYYY-MM-DD.json. For each candidate,
fetches price action from the scan date to today. Determines outcome:
  - target_hit: price reached the target (success)
  - stop_hit: price hit the stop (failure)
  - pending: still within stop/target band
  - expired: >12 weeks old and neither hit

Emits data/backtest_summary.json with hit-rate stats.
"""
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path

import yfinance as yf

ROOT = Path(__file__).resolve().parent
ARCHIVE = ROOT / "data/archive"
OUT = ROOT / "data/backtest_summary.json"
MAX_WEEKS = 12


def fetch_prices_since(symbol: str, start_date: str) -> list[dict]:
    """Return weekly bars from start_date to today."""
    try:
        end = datetime.now()
        start = datetime.strptime(start_date, "%Y-%m-%d")
        # Fetch daily for precision, then aggregate
        df = yf.Ticker(symbol).history(start=start, end=end + timedelta(days=1), interval="1wk")
        return [
            {"date": idx.strftime("%Y-%m-%d"), "high": float(r["High"]), "low": float(r["Low"])}
            for idx, r in df.iterrows()
        ]
    except Exception:
        return []


def judge_candidate(candidate: dict, scan_date: str) -> dict:
    """Return outcome dict for one candidate."""
    sym = candidate["symbol"]
    direction = candidate["direction"]
    trade = candidate.get("trade") or {}
    entry = trade.get("entry")
    stop = trade.get("stop")
    target = trade.get("target")
    if not (entry and stop and target):
        return {"symbol": sym, "outcome": "no_levels"}

    bars = fetch_prices_since(sym, scan_date)
    if not bars:
        return {"symbol": sym, "outcome": "no_data"}

    weeks = 0
    for bar in bars:
        weeks += 1
        if weeks > MAX_WEEKS:
            return {"symbol": sym, "outcome": "expired", "weeks": weeks}
        hi, lo = bar["high"], bar["low"]
        if direction == "bull":
            # Stop hit first? (intra-bar: conservative - check both)
            if lo <= stop:
                return {"symbol": sym, "outcome": "stop_hit", "weeks": weeks, "date": bar["date"]}
            if hi >= target:
                return {"symbol": sym, "outcome": "target_hit", "weeks": weeks, "date": bar["date"]}
        else:  # bear
            if hi >= stop:
                return {"symbol": sym, "outcome": "stop_hit", "weeks": weeks, "date": bar["date"]}
            if lo <= target:
                return {"symbol": sym, "outcome": "target_hit", "weeks": weeks, "date": bar["date"]}

    return {"symbol": sym, "outcome": "pending", "weeks": weeks}


def main() -> None:
    if not ARCHIVE.exists():
        print(f"No archive directory at {ARCHIVE}. Run update_weekly.sh first.")
        return

    archive_files = sorted(ARCHIVE.glob("*.json"))
    if not archive_files:
        print("No archived scans yet. Run update_weekly.sh to start collecting.")
        return

    all_results = []
    for f in archive_files:
        scan = json.loads(f.read_text())
        scan_date = f.stem  # YYYY-MM-DD
        candidates = scan.get("candidates", [])
        print(f"\n{scan_date}: {len(candidates)} candidates")
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda c: judge_candidate(c, scan_date), candidates))
        for c, r in zip(candidates, results):
            r["scanDate"] = scan_date
            r["direction"] = c["direction"]
            r["primaryPattern"] = c.get("primaryPattern")
            r["finalScore"] = c.get("finalScore")
            all_results.append(r)
            print(f"  {r['symbol']:10s} {c['direction']:4s} {r['outcome']}")

    outcomes = Counter(r["outcome"] for r in all_results)
    total = sum(outcomes.values())
    resolved = outcomes["target_hit"] + outcomes["stop_hit"]
    hit_rate = (outcomes["target_hit"] / resolved) if resolved else None

    summary = {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds"),
        "scansProcessed": len(archive_files),
        "candidatesTotal": total,
        "outcomes": dict(outcomes),
        "hitRate": round(hit_rate, 3) if hit_rate is not None else None,
        "results": all_results,
    }
    OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"\nWrote {OUT}")
    print(f"  outcomes: {dict(outcomes)}")
    if hit_rate is not None:
        print(f"  hit rate: {hit_rate:.1%} (resolved {resolved}/{total})")


if __name__ == "__main__":
    main()
