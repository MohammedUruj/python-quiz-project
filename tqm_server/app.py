"""HTTP server: serves the game from ./web and a small JSON API.

Public API
  GET  /api/health                 -> {"ok": true}
  GET  /api/config                 -> assessment settings the game needs
  GET  /api/quiz                   -> questions for one attempt (no answers)
  POST /api/results                -> score and save a final assessment (idempotent)
  GET  /api/results/<submission>   -> a participant's stored result

Host API (requires "Authorization: Bearer <token>" from /api/host/login)
  POST   /api/host/login           {"pin": "..."} -> {"token": "..."}
  POST   /api/host/logout
  GET    /api/host/results
  GET    /api/host/summary
  GET    /api/host/export.csv
  PUT    /api/host/config
  DELETE /api/host/results         (all)    | /api/host/results/<id>
"""

import csv
import functools
import hmac
import io
import json
import re
import secrets
import threading
import time
import traceback
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import scoring
from .storage import Storage

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"
MAX_BODY = 256 * 1024
SESSION_TTL = 8 * 3600
SUBMISSION_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'"
    ),
}


def clean_text(value, limit):
    text = str(value or "").strip()
    text = re.sub(r"[\x00-\x1f\x7f]", "", text)
    return text[:limit]


def csv_safe(value):
    """Prevent spreadsheet formula injection when results are opened in Excel."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


class AppState:
    def __init__(self, data_dir, host_pin, quiet=False):
        self.quiet = quiet
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.storage = Storage(self.data_dir / "tqm_results.sqlite3")
        self.bank = scoring.load_bank()
        self.host_pin = host_pin
        self.sessions = {}
        self.failed_logins = []
        self.lock = threading.Lock()

    def new_session(self):
        token = secrets.token_urlsafe(32)
        with self.lock:
            self.sessions[token] = time.time() + SESSION_TTL
        return token

    def valid_session(self, token):
        with self.lock:
            expiry = self.sessions.get(token)
            if expiry and expiry > time.time():
                return True
            self.sessions.pop(token, None)
            return False

    def end_session(self, token):
        with self.lock:
            self.sessions.pop(token, None)

    def login_allowed(self):
        """At most 10 failed host logins per 5 minutes (protects the PIN from guessing)."""
        now = time.time()
        with self.lock:
            self.failed_logins = [t for t in self.failed_logins if now - t < 300]
            return len(self.failed_logins) < 10

    def record_failed_login(self):
        with self.lock:
            self.failed_logins.append(time.time())


def json_errors(method):
    """Turn unexpected server errors into a JSON 500 instead of a dropped connection."""
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        try:
            return method(self, *args, **kwargs)
        except (BrokenPipeError, ConnectionResetError):
            return None
        except Exception:  # noqa: BLE001 - last-resort guard, logged below
            self.log_error("Unhandled error:\n%s", traceback.format_exc())
            try:
                self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "Server error. Check the server window for details.")
            except OSError:
                pass
            return None
    return wrapper


class Handler(SimpleHTTPRequestHandler):
    server_version = "TQMSimulator/1.0"
    app: AppState = None  # set by make_server

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".svg": "image/svg+xml",
    }

    # ----- plumbing -----
    def log_message(self, fmt, *args):  # quieter console for non-technical hosts
        if self.app.quiet:
            return
        if self.path.startswith("/api/") and not self.path.startswith("/api/health"):
            super().log_message(fmt, *args)

    def list_directory(self, path):  # never show folder listings
        self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")
        return None

    def translate_path(self, path):
        if path.split("?", 1)[0] == "/host":
            path = "/host.html"
        return super().translate_path(path)

    def end_headers(self):
        for k, v in SECURITY_HEADERS.items():
            self.send_header(k, v)
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status, message):
        self.send_json({"error": message}, status)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            raise ValueError("Request body missing or too large.")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def is_host(self):
        auth = self.headers.get("Authorization", "")
        return auth.startswith("Bearer ") and self.app.valid_session(auth[7:].strip())

    # ----- routing -----
    @json_errors
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if not path.startswith("/api/"):
            if path == "/host/":
                self.send_response(HTTPStatus.MOVED_PERMANENTLY)
                self.send_header("Location", "/host")
                self.end_headers()
                return None
            return super().do_GET()
        if path == "/api/health":
            return self.send_json({"ok": True})
        if path == "/api/config":
            return self.send_json(self.public_config())
        if path == "/api/quiz":
            cfg = self.app.storage.get_config()
            chosen = scoring.select_questions(self.app.bank, cfg["question_count"], cfg["shuffle_questions"])
            return self.send_json({"questions": [scoring.public_question(q) for q in chosen],
                                   "config": self.public_config(cfg)})
        m = re.fullmatch(r"/api/results/([A-Za-z0-9-]{8,64})", path)
        if m:
            result = self.app.storage.get_result(m.group(1))
            if not result:
                return self.send_error_json(HTTPStatus.NOT_FOUND, "Result not found.")
            return self.send_json(result)
        if path.startswith("/api/host/"):
            if not self.is_host():
                return self.send_error_json(HTTPStatus.UNAUTHORIZED, "Host login required.")
            if path == "/api/host/results":
                return self.send_json({"results": self.app.storage.list_results()})
            if path == "/api/host/summary":
                return self.send_json(self.summary())
            if path == "/api/host/export.csv":
                return self.send_csv()
            if path == "/api/host/config":
                return self.send_json({"config": self.app.storage.get_config(),
                                       "bank_size": len(self.app.bank)})
        return self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")

    @json_errors
    def do_POST(self):
        path = self.path.split("?", 1)[0]
        try:
            body = self.read_json()
        except (ValueError, json.JSONDecodeError):
            if path != "/api/host/logout":
                return self.send_error_json(HTTPStatus.BAD_REQUEST, "Invalid JSON body.")
            body = {}
        if path == "/api/results":
            return self.post_result(body)
        if path == "/api/host/login":
            if not self.app.login_allowed():
                return self.send_error_json(HTTPStatus.TOO_MANY_REQUESTS,
                                            "Too many attempts. Wait five minutes and try again.")
            pin = str(body.get("pin", ""))
            if hmac.compare_digest(pin.encode(), self.app.host_pin.encode()):
                return self.send_json({"token": self.app.new_session()})
            self.app.record_failed_login()
            return self.send_error_json(HTTPStatus.UNAUTHORIZED, "Incorrect host PIN.")
        if path == "/api/host/logout":
            auth = self.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                self.app.end_session(auth[7:].strip())
            return self.send_json({"ok": True})
        return self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")

    @json_errors
    def do_PUT(self):
        path = self.path.split("?", 1)[0]
        if path != "/api/host/config":
            return self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")
        if not self.is_host():
            return self.send_error_json(HTTPStatus.UNAUTHORIZED, "Host login required.")
        try:
            body = self.read_json()
        except (ValueError, json.JSONDecodeError):
            return self.send_error_json(HTTPStatus.BAD_REQUEST, "Invalid JSON body.")
        merged = {**self.app.storage.get_config(), **body}
        cfg, err = scoring.validate_config(merged, len(self.app.bank))
        if err:
            return self.send_error_json(HTTPStatus.BAD_REQUEST, err)
        self.app.storage.save_config(cfg)
        return self.send_json({"config": cfg})

    @json_errors
    def do_DELETE(self):
        path = self.path.split("?", 1)[0]
        if not path.startswith("/api/host/results"):
            return self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")
        if not self.is_host():
            return self.send_error_json(HTTPStatus.UNAUTHORIZED, "Host login required.")
        if path == "/api/host/results":
            return self.send_json({"deleted": self.app.storage.delete_all_results()})
        m = re.fullmatch(r"/api/host/results/(\d+)", path)
        if m and self.app.storage.delete_result(int(m.group(1))):
            return self.send_json({"deleted": 1})
        return self.send_error_json(HTTPStatus.NOT_FOUND, "Result not found.")

    # ----- handlers -----
    def public_config(self, cfg=None):
        cfg = cfg or self.app.storage.get_config()
        return {k: cfg[k] for k in ("passing_threshold", "question_count", "allow_review",
                                     "require_levels_before_quiz", "bands")}

    def post_result(self, body):
        submission_id = str(body.get("submission_id", ""))
        if not SUBMISSION_RE.fullmatch(submission_id):
            return self.send_error_json(HTTPStatus.BAD_REQUEST, "Invalid submission id.")
        existing = self.app.storage.get_result(submission_id)
        if existing:  # duplicate click / retry: return the original result unchanged
            return self.send_json({"result": existing, "duplicate": True})
        p = body.get("participant") or {}
        participant = {
            "name": clean_text(p.get("name"), 80),
            "team": clean_text(p.get("team"), 80),
            "employee_id": clean_text(p.get("employee_id"), 40),
        }
        if not participant["name"]:
            return self.send_error_json(HTTPStatus.BAD_REQUEST, "Participant name is required.")
        cfg = self.app.storage.get_config()
        result, err = scoring.score_submission(self.app.bank, body.get("answers"), cfg)
        if err:
            return self.send_error_json(HTTPStatus.BAD_REQUEST, err)

        def as_int(value, hi):
            try:
                return max(0, min(int(value), hi))
            except (TypeError, ValueError):
                return 0

        badges = body.get("badges") if isinstance(body.get("badges"), list) else []
        meta = {
            "practice_points": as_int(body.get("practice_points"), 100000),
            "levels_completed": as_int(body.get("levels_completed"), 20),
            "duration_seconds": as_int(body.get("duration_seconds"), 10 * 24 * 3600),
            "badges": [clean_text(b, 40) for b in badges[:20]],
        }
        stored, created = self.app.storage.save_result(submission_id, participant, result, meta)
        return self.send_json({"result": stored, "duplicate": not created},
                              HTTPStatus.CREATED if created else HTTPStatus.OK)

    def summary(self):
        results = self.app.storage.list_results()
        n = len(results)
        bands = {}
        for r in results:
            bands[r["band"]] = bands.get(r["band"], 0) + 1
        per_q = {}
        for review in self.app.storage.all_reviews():
            for item in review:
                s = per_q.setdefault(item["id"], {"id": item["id"], "topic": item["topic"],
                                                  "prompt": item["prompt"], "attempts": 0, "correct": 0})
                s["attempts"] += 1
                s["correct"] += int(item["is_correct"])
        questions = sorted(per_q.values(), key=lambda s: s["correct"] / s["attempts"])
        for s in questions:
            s["percent_correct"] = round(s["correct"] / s["attempts"] * 100, 1)
        return {
            "participants": n,
            "average_percent": round(sum(r["percent"] for r in results) / n, 1) if n else 0,
            "pass_rate": round(sum(r["passed"] for r in results) / n * 100, 1) if n else 0,
            "highest_percent": max((r["percent"] for r in results), default=0),
            "bands": bands,
            "questions": questions,
        }

    def send_csv(self):
        buf = io.StringIO()
        w = csv.writer(buf)
        cols = ["created_at", "participant_name", "team", "employee_id", "score", "total", "percent",
                "band", "passed", "passing_threshold", "practice_points", "levels_completed",
                "duration_seconds", "badges", "submission_id"]
        w.writerow(cols)
        for r in self.app.storage.list_results():
            row = dict(r, badges="; ".join(r["badges"]), passed="yes" if r["passed"] else "no")
            w.writerow([csv_safe(row[c]) for c in cols])
        body = ("﻿" + buf.getvalue()).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="tqm_results.csv"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def make_server(host, port, data_dir, host_pin, quiet=False):
    app = AppState(data_dir, host_pin, quiet)
    handler = type("BoundHandler", (Handler,), {"app": app})
    server = ThreadingHTTPServer((host, port), partial(handler, directory=str(WEB_DIR)))
    server.daemon_threads = True
    server.app = app
    return server
