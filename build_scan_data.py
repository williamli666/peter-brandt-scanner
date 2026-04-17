#!/usr/bin/env python3
"""
Build scan_latest.json for the web gallery's Live Scan tab.

Merges pattern_scan.json (detected patterns) with weekly OHLC from yfinance
for the top-scored symbols, emitting a minimal frontend-friendly payload.
"""
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import yfinance as yf

ROOT = Path(__file__).resolve().parent
SCAN_DIR = Path.home() / "Desktop/peter-brandt-cheatsheet/scan_results"
PATTERN_JSON = SCAN_DIR / "pattern_scan.json"
RANKED_JSON = SCAN_DIR / "pattern_ranked.json"
REPORT_MD = SCAN_DIR / "pattern_scan_report.md"
OUTPUT_JSON = ROOT / "data" / "scan_latest.json"
OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)

WEEKS = 104
TOP_N_CANDIDATES = None  # None = include every ranked candidate

# Import symbol dicts from the scanner for single source of truth
sys.path.insert(0, str(Path.home() / "Desktop/peter-brandt-cheatsheet"))
from scan_patterns import FUTURES, FOREX, STOCKS_ETF, CRYPTO  # noqa: E402

# Grouped universe: category -> { symbol: "cn_cn en_en" }
UNIVERSE_GROUPS = [
    ("futures", ("期货", "Futures"), FUTURES),
    ("forex", ("外汇", "Forex"), FOREX),
    ("stocks_etf", ("股票与ETF", "Stocks & ETFs"), STOCKS_ETF),
    ("crypto", ("加密货币", "Crypto"), CRYPTO),
]


def split_bilingual(value: str) -> tuple[str, str]:
    """Split 'ChinesePrefix English' label into (zh, en).

    Heuristic: find the boundary where Chinese characters end and
    non-Chinese starts. If no Chinese, use the string for both sides.
    """
    value = value.strip()
    if not value:
        return "", ""

    # Find index where Chinese ends
    zh_end = 0
    for i, ch in enumerate(value):
        if "\u4e00" <= ch <= "\u9fff":
            zh_end = i + 1

    if zh_end == 0:
        # No Chinese: use the whole string for both
        return value, value

    zh = value[:zh_end].strip()
    en = value[zh_end:].strip()
    if not en:
        en = zh
    return zh, en


# Build metadata lookup: symbol -> {nameEn, nameZh, category}
SYMBOL_META: dict[str, dict[str, str]] = {}
for category_key, _, mapping in UNIVERSE_GROUPS:
    for symbol, label in mapping.items():
        zh, en = split_bilingual(label)
        SYMBOL_META[symbol] = {
            "nameEn": en,
            "nameZh": zh,
            "category": category_key,
        }

# Pattern Chinese → EN canonical mapping (detected in pattern_scan.json)
PATTERN_ENMAP = {
    "头肩顶 H&S Top":                   "H&S Top",
    "头肩底 Inv H&S":                   "Inverse H&S",
    "矩形整理中 Rectangle Forming":       "Rectangle",
    "矩形突破 Rectangle Breakout":        "Rectangle Breakout",
    "上升楔形 Rising Wedge":             "Rising Wedge",
    "下降楔形 Falling Wedge":             "Falling Wedge",
    "扩展三角形 Expanding Triangle":       "Expanding Triangle",
    "宽体K线 Wide Bodied Bar (WBB)":    "Wide Bodied Bar",
}
PATTERN_ZHMAP = {k: k.split(" ")[0] for k in PATTERN_ENMAP}  # "头肩顶"


DIRECTION_MAP = {"看涨": "bull", "看跌": "bear", "观望": "neutral", "多空争夺": "neutral"}
STATUS_MAP = {
    "测试颈线中": {"en": "Testing neckline",      "zh": "测试颈线中"},
    "已突破颈线": {"en": "Neckline breached",      "zh": "已突破颈线"},
    "形成中":    {"en": "Forming",                 "zh": "形成中"},
}


def load_ranked() -> dict[str, dict]:
    """Return {symbol: ranked_entry}."""
    raw = json.loads(RANKED_JSON.read_text(encoding="utf-8"))
    return {e["symbol"]: e for e in raw}


RANKED_BY_SYMBOL: dict[str, dict] = {}


def get_trade_info(symbol: str) -> dict:
    """Extract trade info from pattern_ranked.json entry."""
    entry = RANKED_BY_SYMBOL.get(symbol)
    if not entry:
        return {}
    # Compute R:R from stop/target/current-price
    last_price = entry.get("last_price")
    stop = entry.get("stop_loss")
    target = entry.get("primary_target")
    rr = None
    if last_price and stop and target:
        risk = abs(last_price - stop)
        reward = abs(target - last_price)
        if risk > 0:
            rr = round(reward / risk, 2)
    return {
        "score": entry.get("score", 0),
        "finalScore": entry.get("final_score"),
        "lastPrice": last_price,
        "direction": DIRECTION_MAP.get(entry.get("net_direction", ""), "neutral"),
        "stop": stop,
        "target": target,
        "riskPct": entry.get("risk_pct"),
        "rr": rr,
        "primaryPattern": entry.get("primary_pattern"),
    }


def fetch_weekly_closes(symbol: str, weeks: int = WEEKS) -> list[float]:
    """Pull last `weeks` weekly closes from yfinance."""
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period=f"{weeks + 8}wk", interval="1wk", auto_adjust=False)
    closes = hist["Close"].dropna().tail(weeks).tolist()
    return [round(float(c), 4) for c in closes]


def build_candidate(symbol: str, all_patterns: list[dict]) -> dict:
    meta = SYMBOL_META[symbol]
    symbol_patterns = [p for p in all_patterns if p["symbol"] == symbol]

    patterns_out = []
    for p in symbol_patterns:
        p_cn = p["pattern"]
        patterns_out.append({
            "type": PATTERN_ENMAP.get(p_cn, p_cn),
            "typeZh": PATTERN_ZHMAP.get(p_cn, p_cn),
            "direction": DIRECTION_MAP.get(p["direction"], "neutral"),
            "status": _map_status_en(p.get("status", "")),
            "statusZh": p.get("status", ""),
            "resistance": p.get("resistance"),
            "support": p.get("support"),
            "ageWeeks": p.get("age_weeks"),
        })

    trade = get_trade_info(symbol)

    return {
        "symbol": symbol,
        "nameEn": meta["nameEn"],
        "nameZh": meta["nameZh"],
        "category": meta["category"],
        "lastPrice": trade.get("lastPrice") or (symbol_patterns[0]["last_price"] if symbol_patterns else None),
        "lastDate": symbol_patterns[0]["last_date"] if symbol_patterns else None,
        "score": trade.get("score", 0),
        "finalScore": trade.get("finalScore"),
        "direction": trade.get("direction", "neutral"),
        "primaryPattern": trade.get("primaryPattern"),
        "patterns": patterns_out,
        "trade": {
            "entry": _pick_entry(patterns_out),
            "stop": trade.get("stop"),
            "target": trade.get("target"),
            "riskPct": trade.get("riskPct"),
            "rr": trade.get("rr"),
        },
    }


def _map_status_en(zh_status: str) -> str:
    for key, val in STATUS_MAP.items():
        if key in zh_status:
            return val["en"]
    return zh_status


def _pick_entry(patterns: list[dict]) -> float | None:
    """Use first breakout resistance/support as entry trigger."""
    for p in patterns:
        if p.get("resistance"):
            return p["resistance"]
    return None


def pick_top_symbols(limit: int | None) -> list[str]:
    """Return symbols by final_score (desc). If limit is None, returns all."""
    raw = json.loads(RANKED_JSON.read_text(encoding="utf-8"))
    ordered = [e["symbol"] for e in raw if e["symbol"] in SYMBOL_META]
    if limit is None:
        return ordered
    return ordered[:limit]


def fetch_closes_safe(symbol: str) -> tuple[str, list[float]]:
    """Wrapper for parallel fetch — returns (symbol, closes) or (symbol, [])."""
    try:
        return symbol, fetch_weekly_closes(symbol, WEEKS)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! {symbol}: {exc}", flush=True)
        return symbol, []


def fetch_universe_closes(symbols: list[str]) -> dict[str, list[float]]:
    """Parallel fetch weekly closes for the whole universe."""
    print(f"\nFetching weekly closes for {len(symbols)} symbols (parallel)…", flush=True)
    out: dict[str, list[float]] = {}
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(fetch_closes_safe, s) for s in symbols]
        for i, fut in enumerate(as_completed(futures), 1):
            sym, closes = fut.result()
            out[sym] = closes
            if i % 20 == 0:
                print(f"  … {i}/{len(symbols)}", flush=True)
    print(f"  done: {sum(1 for v in out.values() if v)}/{len(symbols)} with data", flush=True)
    return out


def build_universe(all_patterns: list[dict], closes_map: dict[str, list[float]]) -> list[dict]:
    """Emit one entry per symbol with weekly closes for overview charts."""
    groups = []
    for category_key, group_label, mapping in UNIVERSE_GROUPS:
        group_zh, group_en = group_label
        entries = []
        for symbol, label in mapping.items():
            zh, en = split_bilingual(label)
            entries.append({
                "symbol": symbol,
                "nameEn": en,
                "nameZh": zh,
                "weeklyCloses": closes_map.get(symbol, []),
            })
        groups.append({
            "key": category_key,
            "labelEn": group_en,
            "labelZh": group_zh,
            "count": len(entries),
            "symbols": entries,
        })
    return groups


def main():
    all_patterns = json.loads(PATTERN_JSON.read_text(encoding="utf-8"))
    global RANKED_BY_SYMBOL
    RANKED_BY_SYMBOL = load_ranked()

    # Aggregate summary
    totals = {"bull": 0, "bear": 0, "neutral": 0}
    unique_symbols = set()
    for p in all_patterns:
        totals[DIRECTION_MAP.get(p["direction"], "neutral")] += 1
        unique_symbols.add(p["symbol"])

    top_symbols = pick_top_symbols(TOP_N_CANDIDATES)
    raw_candidates = [build_candidate(sym, all_patterns) for sym in top_symbols]

    # Filter 1: drop 观望/neutral — no clear direction is not actionable
    after_dir = [c for c in raw_candidates if c.get("direction") in ("bull", "bear")]

    # Filter 2: minimum R:R 3:1 (Brandt's core risk rule) — nulls dropped
    MIN_RR = 3.0
    candidates = [c for c in after_dir if (c.get("trade", {}).get("rr") or 0) >= MIN_RR]

    # Sort by recommendation strength:
    #   primary = finalScore (percentile score)
    #   secondary = rule score (count of strong patterns)
    def _strength(c: dict) -> tuple[float, int]:
        return (c.get("finalScore") or 0, c.get("score", 0))
    candidates.sort(key=_strength, reverse=True)
    print(
        f"Built {len(candidates)} actionable candidates "
        f"(raw {len(raw_candidates)} → -{len(raw_candidates) - len(after_dir)} neutral "
        f"→ -{len(after_dir) - len(candidates)} below R:R {MIN_RR}:1)",
        flush=True,
    )

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataAsOf": candidates[0]["lastDate"] if candidates else None,
        "summary": {
            "symbolsWithSignal": len(unique_symbols),
            "signalsFound": len(all_patterns),
            "bullish": totals["bull"],
            "bearish": totals["bear"],
            "neutral": totals["neutral"],
        },
        "candidates": candidates,
    }

    OUTPUT_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {OUTPUT_JSON} ({OUTPUT_JSON.stat().st_size} bytes)")
    print(f"Actionable candidates: {len(candidates)}")


if __name__ == "__main__":
    main()
