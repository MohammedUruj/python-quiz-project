"""SQLite persistence for assessment results and host settings."""

import json
import sqlite3
import threading
from datetime import datetime, timezone

from .scoring import DEFAULT_CONFIG

SCHEMA = """
CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id TEXT UNIQUE NOT NULL,
    participant_name TEXT NOT NULL,
    team TEXT,
    employee_id TEXT,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    percent REAL NOT NULL,
    band TEXT NOT NULL,
    passed INTEGER NOT NULL,
    passing_threshold REAL NOT NULL,
    practice_points INTEGER,
    badges TEXT,
    levels_completed INTEGER,
    duration_seconds INTEGER,
    review TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

PUBLIC_COLUMNS = (
    "id", "submission_id", "participant_name", "team", "employee_id", "score", "total",
    "percent", "band", "passed", "passing_threshold", "practice_points", "badges",
    "levels_completed", "duration_seconds", "created_at",
)


class Storage:
    def __init__(self, db_path):
        self.db_path = str(db_path)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock, self._conn:
            self._conn.executescript(SCHEMA)

    # ---------- settings ----------
    def get_config(self):
        with self._lock:
            row = self._conn.execute("SELECT value FROM settings WHERE key='config'").fetchone()
        if row is None:
            return json.loads(json.dumps(DEFAULT_CONFIG))
        cfg = json.loads(json.dumps(DEFAULT_CONFIG))
        cfg.update(json.loads(row["value"]))
        return cfg

    def save_config(self, cfg):
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO settings(key, value) VALUES('config', ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (json.dumps(cfg),),
            )

    # ---------- results ----------
    def save_result(self, submission_id, participant, result, meta):
        """Insert a result once. A repeated submission_id returns the stored result unchanged."""
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self._lock:
            try:
                with self._conn:
                    self._conn.execute(
                        "INSERT INTO results(submission_id, participant_name, team, employee_id, score,"
                        " total, percent, band, passed, passing_threshold, practice_points, badges,"
                        " levels_completed, duration_seconds, review, created_at)"
                        " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (
                            submission_id, participant["name"], participant.get("team", ""),
                            participant.get("employee_id", ""), result["score"], result["total"],
                            result["percent"], result["band"], int(result["passed"]),
                            result["passing_threshold"], meta.get("practice_points", 0),
                            json.dumps(meta.get("badges", [])), meta.get("levels_completed", 0),
                            meta.get("duration_seconds", 0), json.dumps(result["review"]), now,
                        ),
                    )
                created = True
            except sqlite3.IntegrityError:
                created = False
        return self.get_result(submission_id), created

    def get_result(self, submission_id):
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM results WHERE submission_id=?", (submission_id,)
            ).fetchone()
        return self._row_to_result(row, include_review=True) if row else None

    def list_results(self):
        with self._lock:
            rows = self._conn.execute("SELECT * FROM results ORDER BY created_at DESC, id DESC").fetchall()
        return [self._row_to_result(r, include_review=False) for r in rows]

    def all_reviews(self):
        with self._lock:
            rows = self._conn.execute("SELECT review FROM results").fetchall()
        return [json.loads(r["review"]) for r in rows]

    def delete_result(self, result_id):
        with self._lock, self._conn:
            cur = self._conn.execute("DELETE FROM results WHERE id=?", (result_id,))
        return cur.rowcount > 0

    def delete_all_results(self):
        with self._lock, self._conn:
            cur = self._conn.execute("DELETE FROM results")
        return cur.rowcount

    @staticmethod
    def _row_to_result(row, include_review):
        data = {k: row[k] for k in PUBLIC_COLUMNS}
        data["passed"] = bool(data["passed"])
        data["badges"] = json.loads(data["badges"] or "[]")
        if include_review:
            data["review"] = json.loads(row["review"])
        return data

    def close(self):
        with self._lock:
            self._conn.close()
