#!/usr/bin/env python3
"""
Sync Gary Norden daily analyses into the website data folder.

Scans ~/Desktop/gary-norden-book/ for YYYY-MM-DD.{md,html} pairs, copies
each HTML into data/daily/ and emits data/daily_index.json with a preview
snippet per date (sorted newest first).
"""
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC_DIR = Path.home() / "Desktop/gary-norden-book"
OUT_DIR = ROOT / "data/daily"
INDEX_JSON = ROOT / "data/daily_index.json"
OUT_DIR.mkdir(parents=True, exist_ok=True)

DATE_PATTERN = re.compile(r"^(\d{4}-\d{2}-\d{2})\.md$")


def extract_preview(md_path: Path, max_len: int = 160) -> str:
    """Grab the first meaningful paragraph as a preview string."""
    text = md_path.read_text(encoding="utf-8")
    # Skip title line and horizontal rules
    lines = [ln.strip() for ln in text.splitlines()]
    candidates = []
    for ln in lines:
        if not ln:
            continue
        if ln.startswith("#"):
            continue
        if ln.startswith("---"):
            continue
        # Strip markdown bold/italic markers
        stripped = re.sub(r"\*\*|\*|`|>", "", ln)
        stripped = stripped.strip()
        if len(stripped) > 20:
            candidates.append(stripped)
        if len(candidates) >= 2:
            break
    if not candidates:
        return ""
    preview = " ".join(candidates)
    if len(preview) > max_len:
        preview = preview[: max_len - 1].rstrip() + "…"
    return preview


def extract_title(md_path: Path) -> str:
    """First `# ...` line becomes the title."""
    for ln in md_path.read_text(encoding="utf-8").splitlines():
        if ln.startswith("# "):
            return ln[2:].strip()
    return md_path.stem


def main() -> None:
    entries = []
    for md_path in SRC_DIR.glob("*.md"):
        m = DATE_PATTERN.match(md_path.name)
        if not m:
            continue
        date = m.group(1)
        html_path = md_path.with_suffix(".html")
        if not html_path.exists():
            print(f"! {date}: no HTML, skipping")
            continue

        dest_html = OUT_DIR / html_path.name
        shutil.copy2(html_path, dest_html)

        entries.append({
            "date": date,
            "title": extract_title(md_path),
            "preview": extract_preview(md_path),
            "file": f"daily/{html_path.name}",
            "bytes": dest_html.stat().st_size,
        })

    entries.sort(key=lambda e: e["date"], reverse=True)

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Gary Norden framework daily analysis",
        "count": len(entries),
        "entries": entries,
    }
    INDEX_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {INDEX_JSON} ({len(entries)} entries)")
    for e in entries[:5]:
        print(f"  {e['date']} · {e['title'][:40]}")


if __name__ == "__main__":
    main()
