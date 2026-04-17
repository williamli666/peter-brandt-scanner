#!/usr/bin/env python3
"""
Build per-source report indices used by the website's report tabs.

Currently handles three sources:
  - daily    : ~/Desktop/gary-norden-book/YYYY-MM-DD.{md,html}
  - futures  : ~/Desktop/期货日日报/reports/期货日日报_YYYY-MM-DD.html
  - munger   : ~/Desktop/芒格200周均线/YYYY-MM-DD.html

For each source, copies HTMLs into data/<subdir>/ and emits
data/<index_file>.json with [{date, title, preview, file, bytes}, ...].
"""
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DESKTOP = Path.home() / "Desktop"
DATA = ROOT / "data"

SOURCES = [
    {
        "key": "daily",
        "src_dir": DESKTOP / "gary-norden-book",
        "pattern": re.compile(r"^(\d{4}-\d{2}-\d{2})\.html$"),
        "out_subdir": "daily",
        "index_file": "daily_index.json",
        "md_companion": True,  # md lives next to html
    },
    {
        "key": "futures",
        "src_dir": DESKTOP / "期货日日报/reports",
        "pattern": re.compile(r"^期货日日报_(\d{4}-\d{2}-\d{2})\.html$"),
        "out_subdir": "futures",
        "index_file": "futures_index.json",
        "md_companion": False,
    },
    {
        "key": "munger",
        "src_dir": DESKTOP / "芒格200周均线",
        "pattern": re.compile(r"^(\d{4}-\d{2}-\d{2})\.html$"),
        "out_subdir": "munger",
        "index_file": "munger_index.json",
        "md_companion": False,
    },
]


# ───────────────────────── extractors ─────────────────────────

def extract_from_md(md_path: Path, max_len: int = 160) -> tuple[str, str]:
    text = md_path.read_text(encoding="utf-8")
    title = ""
    preview_parts: list[str] = []
    for ln in text.splitlines():
        ln = ln.strip()
        if not title and ln.startswith("# "):
            title = ln[2:].strip()
            continue
        if not ln or ln.startswith("#") or ln.startswith("---"):
            continue
        clean = re.sub(r"\*\*|\*|`|>", "", ln).strip()
        if len(clean) > 20:
            preview_parts.append(clean)
        if len(preview_parts) >= 2:
            break
    preview = " ".join(preview_parts)
    if len(preview) > max_len:
        preview = preview[: max_len - 1].rstrip() + "…"
    return title, preview


_TAG_RE = re.compile(r"<[^>]+>")
_ENTITY_RE = re.compile(r"&(nbsp|amp|lt|gt|quot|#\d+);")


def strip_html(s: str) -> str:
    s = _TAG_RE.sub(" ", s)
    s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    return re.sub(r"\s+", " ", s).strip()


def extract_from_html(html_path: Path, max_len: int = 200) -> tuple[str, str]:
    text = html_path.read_text(encoding="utf-8", errors="replace")
    title_match = re.search(r"<title>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
    title = strip_html(title_match.group(1)) if title_match else html_path.stem

    # Extract body, then gather text from first few headings/paragraphs/divs
    body_match = re.search(r"<body[^>]*>(.*?)</body>", text, re.IGNORECASE | re.DOTALL)
    body_text = body_match.group(1) if body_match else text

    # Heuristic preview: first non-empty textual chunk > 25 chars
    chunks = re.split(r"</(?:p|div|h1|h2|h3|li|section|tr)>", body_text, flags=re.IGNORECASE)
    preview_parts: list[str] = []
    for chunk in chunks:
        clean = strip_html(chunk)
        if len(clean) >= 25:
            preview_parts.append(clean)
        if len(preview_parts) >= 2:
            break
    preview = " ".join(preview_parts)
    if len(preview) > max_len:
        preview = preview[: max_len - 1].rstrip() + "…"
    return title, preview


# ───────────────────────── main ─────────────────────────

def build_one_source(cfg: dict) -> dict:
    src_dir: Path = cfg["src_dir"]
    if not src_dir.exists():
        print(f"[{cfg['key']}] source missing: {src_dir}")
        return {"key": cfg["key"], "count": 0, "entries": []}

    out_dir = DATA / cfg["out_subdir"]
    out_dir.mkdir(parents=True, exist_ok=True)

    entries = []
    for html_path in sorted(src_dir.glob("*.html")):
        m = cfg["pattern"].match(html_path.name)
        if not m:
            continue
        date = m.group(1)

        # Prefer markdown companion for accurate title/preview
        title, preview = "", ""
        if cfg["md_companion"]:
            md_path = html_path.with_suffix(".md")
            if md_path.exists():
                title, preview = extract_from_md(md_path)
        if not title:
            title, preview = extract_from_html(html_path)

        dest_html = out_dir / html_path.name
        shutil.copy2(html_path, dest_html)

        entries.append({
            "date": date,
            "title": title,
            "preview": preview,
            "file": f"{cfg['out_subdir']}/{html_path.name}",
            "bytes": dest_html.stat().st_size,
        })

    entries.sort(key=lambda e: e["date"], reverse=True)

    index_path = DATA / cfg["index_file"]
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "key": cfg["key"],
        "count": len(entries),
        "entries": entries,
    }
    index_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{cfg['key']}] {len(entries)} reports → {index_path.name}")
    return payload


def main() -> None:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for cfg in SOURCES:
        if only and cfg["key"] != only:
            continue
        build_one_source(cfg)


if __name__ == "__main__":
    main()
