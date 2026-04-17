#!/usr/bin/env python3
"""
Local HTTP trigger service for manual "Update this tab" buttons on the site.

Listens on 127.0.0.1:8800 (and 0.0.0.0:8800 so the VPS-served page can reach
it from the same Mac's browser). Accepts POST /trigger?src=<key> and runs the
matching refresh script in the background. GET /status?job=<id> returns
progress/result.

Runs as launchd agent com.peter-brandt.trigger (loaded at login).
"""
import json
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
SCRIPT = ROOT / "trigger_update.sh"
PORT = 8800

JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()

# Keep only the last N jobs in memory
MAX_JOBS = 30


def run_job(job_id: str, src: str) -> None:
    with JOBS_LOCK:
        JOBS[job_id]["status"] = "running"
        JOBS[job_id]["startedAt"] = time.time()
    try:
        result = subprocess.run(
            ["/bin/bash", str(SCRIPT), src],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=600,  # 10 min hard cap
        )
        with JOBS_LOCK:
            JOBS[job_id]["status"] = "done" if result.returncode == 0 else "error"
            JOBS[job_id]["returncode"] = result.returncode
            JOBS[job_id]["stdout"] = result.stdout[-4000:]
            JOBS[job_id]["stderr"] = result.stderr[-2000:]
            JOBS[job_id]["finishedAt"] = time.time()
    except subprocess.TimeoutExpired:
        with JOBS_LOCK:
            JOBS[job_id]["status"] = "timeout"
            JOBS[job_id]["finishedAt"] = time.time()
    except Exception as exc:
        with JOBS_LOCK:
            JOBS[job_id]["status"] = "error"
            JOBS[job_id]["error"] = str(exc)
            JOBS[job_id]["finishedAt"] = time.time()


def trim_jobs() -> None:
    with JOBS_LOCK:
        if len(JOBS) > MAX_JOBS:
            ordered = sorted(JOBS.items(), key=lambda kv: kv[1].get("createdAt", 0))
            for jid, _ in ordered[: len(JOBS) - MAX_JOBS]:
                JOBS.pop(jid, None)


class Handler(BaseHTTPRequestHandler):
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        if parsed.path == "/":
            self._json(200, {"ok": True, "service": "peter-brandt-trigger"})
            return
        if parsed.path == "/status":
            job_id = (qs.get("job") or [""])[0]
            with JOBS_LOCK:
                job = JOBS.get(job_id)
            if not job:
                self._json(404, {"error": "unknown job"})
                return
            self._json(200, job)
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        if parsed.path != "/trigger":
            self._json(404, {"error": "not found"})
            return
        src = (qs.get("src") or [""])[0]
        if src not in {"scan", "daily", "futures", "munger", "backtest"}:
            self._json(400, {"error": f"invalid src: {src}"})
            return

        job_id = uuid.uuid4().hex[:10]
        with JOBS_LOCK:
            JOBS[job_id] = {
                "id": job_id,
                "src": src,
                "status": "queued",
                "createdAt": time.time(),
            }
        trim_jobs()
        threading.Thread(target=run_job, args=(job_id, src), daemon=True).start()
        self._json(202, {"jobId": job_id, "src": src, "status": "queued"})

    def log_message(self, fmt, *args) -> None:  # silence noisy default logs
        sys.stderr.write(f"[{self.log_date_time_string()}] {fmt % args}\n")


def main() -> None:
    bind = "0.0.0.0"
    server = ThreadingHTTPServer((bind, PORT), Handler)
    print(f"Trigger server listening on {bind}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
