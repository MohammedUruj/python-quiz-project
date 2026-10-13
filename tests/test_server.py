"""Server tests. Run with:  python -m unittest discover -s tests -v"""

import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import uuid

from tqm_server import scoring
from tqm_server.app import make_server, csv_safe

PIN = "24681357"


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.server = make_server("127.0.0.1", 0, cls.tmp.name, PIN, quiet=True)
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.bank = {q["id"]: q for q in scoring.load_bank()}

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.server.app.storage.close()
        cls.tmp.cleanup()

    # ---------- helpers ----------
    def request(self, method, path, body=None, token=None, raw=False):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req) as res:
                payload = res.read()
                return res.status, (payload if raw else json.loads(payload or b"null"))
        except urllib.error.HTTPError as err:
            payload = err.read()
            return err.code, (payload if raw else json.loads(payload or b"null"))

    def login(self):
        status, data = self.request("POST", "/api/host/login", {"pin": PIN})
        self.assertEqual(status, 200)
        return data["token"]

    def answers_for(self, questions, correct_count):
        answers = {}
        for i, q in enumerate(questions):
            key = self.bank[q["id"]]["answer"]
            answers[q["id"]] = key if i < correct_count else (key + 1) % len(q["options"])
        return answers

    def submit(self, correct_count, name="Ada Tester", submission_id=None):
        _, quiz = self.request("GET", "/api/quiz")
        body = {
            "submission_id": submission_id or str(uuid.uuid4()),
            "participant": {"name": name, "team": "Curing B"},
            "answers": self.answers_for(quiz["questions"], correct_count),
            "practice_points": 420,
            "badges": ["Pareto Pro"],
            "levels_completed": 8,
            "duration_seconds": 900,
        }
        return body, self.request("POST", "/api/results", body)

    # ---------- tests ----------
    def test_static_pages_served(self):
        for path in ("/", "/host", "/js/main.js", "/css/style.css"):
            req = urllib.request.Request(self.base + path)
            with urllib.request.urlopen(req) as res:
                self.assertEqual(res.status, 200, path)
                self.assertIn("Content-Security-Policy", res.headers)

    def test_no_directory_listing(self):
        status, _ = self.request("GET", "/js/", raw=True)
        self.assertEqual(status, 404)

    def test_quiz_bank_not_exposed_as_static_file(self):
        status, _ = self.request("GET", "/../tqm_server/quiz_bank.json", raw=True)
        self.assertEqual(status, 404)

    def test_quiz_hides_answers_and_covers_all_core_questions(self):
        status, quiz = self.request("GET", "/api/quiz")
        self.assertEqual(status, 200)
        self.assertEqual(len(quiz["questions"]), 20)
        for q in quiz["questions"]:
            self.assertNotIn("answer", q)
            self.assertNotIn("explanation", q)
        core = {qid for qid, q in self.bank.items() if q.get("core")}
        self.assertEqual({q["id"] for q in quiz["questions"]}, core)

    def test_scoring_bands_and_pass(self):
        _, (status, data) = self.submit(18)
        self.assertEqual(status, 201)
        r = data["result"]
        self.assertEqual((r["score"], r["total"], r["percent"]), (18, 20, 90.0))
        self.assertEqual(r["band"], "Quality Champion")
        self.assertTrue(r["passed"])
        _, (_, low) = self.submit(11)
        self.assertEqual(low["result"]["percent"], 55.0)
        self.assertEqual(low["result"]["band"], "Further Learning Recommended")
        self.assertFalse(low["result"]["passed"])

    def test_duplicate_submission_returns_original_result(self):
        sid = str(uuid.uuid4())
        body, (status1, first) = self.submit(15, submission_id=sid)
        self.assertEqual(status1, 201)
        body["answers"] = {k: 0 for k in body["answers"]}  # a changed re-submit must not re-score
        status2, second = self.request("POST", "/api/results", body)
        self.assertEqual(status2, 200)
        self.assertTrue(second["duplicate"])
        self.assertEqual(second["result"]["percent"], first["result"]["percent"])
        status3, fetched = self.request("GET", f"/api/results/{sid}")
        self.assertEqual(status3, 200)
        self.assertEqual(fetched["percent"], 75.0)

    def test_rejects_invalid_submissions(self):
        _, quiz = self.request("GET", "/api/quiz")
        ids = [q["id"] for q in quiz["questions"]]
        bad = [
            {"submission_id": "x", "participant": {"name": "A"}, "answers": {}},
            {"submission_id": str(uuid.uuid4()), "participant": {"name": ""}, "answers": {i: 0 for i in ids}},
            {"submission_id": str(uuid.uuid4()), "participant": {"name": "A"}, "answers": {ids[0]: 0}},
            {"submission_id": str(uuid.uuid4()), "participant": {"name": "A"}, "answers": {**{i: 0 for i in ids[1:]}, "nope": 0}},
            {"submission_id": str(uuid.uuid4()), "participant": {"name": "A"}, "answers": {**{i: 0 for i in ids[1:]}, ids[0]: 9}},
        ]
        for body in bad:
            status, data = self.request("POST", "/api/results", body)
            self.assertEqual(status, 400, body)
            self.assertIn("error", data)

    def test_unanswered_questions_count_as_wrong(self):
        _, quiz = self.request("GET", "/api/quiz")
        answers = {q["id"]: None for q in quiz["questions"]}
        status, data = self.request("POST", "/api/results", {"submission_id": str(uuid.uuid4()), "participant": {"name": "Blank"}, "answers": answers})
        self.assertEqual(status, 201)
        self.assertEqual(data["result"]["score"], 0)

    def test_host_endpoints_require_login(self):
        for method, path in (("GET", "/api/host/results"), ("GET", "/api/host/summary"), ("PUT", "/api/host/config"), ("DELETE", "/api/host/results")):
            status, _ = self.request(method, path, {} if method == "PUT" else None)
            self.assertEqual(status, 401, path)
        status, _ = self.request("POST", "/api/host/login", {"pin": "wrong"})
        self.assertEqual(status, 401)

    def test_host_results_summary_and_csv(self):
        self.submit(20, name="=HYPERLINK(evil)")
        token = self.login()
        status, data = self.request("GET", "/api/host/results", token=token)
        self.assertEqual(status, 200)
        self.assertTrue(any(r["participant_name"] == "=HYPERLINK(evil)" for r in data["results"]))
        status, summary = self.request("GET", "/api/host/summary", token=token)
        self.assertEqual(status, 200)
        self.assertGreaterEqual(summary["participants"], 1)
        self.assertTrue(summary["questions"])
        status, csv_bytes = self.request("GET", "/api/host/export.csv", token=token, raw=True)
        self.assertEqual(status, 200)
        text = csv_bytes.decode("utf-8-sig")
        self.assertIn("participant_name", text.splitlines()[0])
        self.assertIn("'=HYPERLINK(evil)", text)  # formula injection neutralised

    def test_config_update_and_validation(self):
        token = self.login()
        status, data = self.request("PUT", "/api/host/config", {"passing_threshold": 80, "question_count": 10, "allow_review": False}, token=token)
        self.assertEqual(status, 200)
        self.assertEqual(data["config"]["passing_threshold"], 80)
        _, public = self.request("GET", "/api/config")
        self.assertEqual(public["question_count"], 10)
        self.assertFalse(public["allow_review"])
        _, quiz = self.request("GET", "/api/quiz")
        self.assertEqual(len(quiz["questions"]), 10)
        for bad in ({"passing_threshold": 150}, {"question_count": 0}, {"bands": [{"label": "Only", "min": 50}]}):
            status, _ = self.request("PUT", "/api/host/config", bad, token=token)
            self.assertEqual(status, 400, bad)
        # restore defaults for other tests
        self.request("PUT", "/api/host/config", {"passing_threshold": 75, "question_count": 20, "allow_review": True}, token=token)

    def test_delete_results(self):
        _, (_, data) = self.submit(10, name="Delete Me")
        token = self.login()
        status, _ = self.request("DELETE", f"/api/host/results/{data['result']['id']}", token=token)
        self.assertEqual(status, 200)
        status, _ = self.request("DELETE", f"/api/host/results/{data['result']['id']}", token=token)
        self.assertEqual(status, 404)


class ScoringUnitTest(unittest.TestCase):
    def test_bank_is_valid(self):
        bank = scoring.load_bank()
        self.assertGreaterEqual(len(bank), 20)
        self.assertEqual(sum(1 for q in bank if q.get("core")), 20)
        for q in bank:
            self.assertTrue(q["explanation"].strip())
            self.assertEqual(len(set(q["options"])), len(q["options"]), q["id"])

    def test_band_for(self):
        bands = scoring.DEFAULT_CONFIG["bands"]
        self.assertEqual(scoring.band_for(100, bands), "Quality Champion")
        self.assertEqual(scoring.band_for(89.9, bands), "Quality Practitioner")
        self.assertEqual(scoring.band_for(60, bands), "Developing Quality Skills")
        self.assertEqual(scoring.band_for(0, bands), "Further Learning Recommended")

    def test_csv_safe(self):
        self.assertEqual(csv_safe("=1+1"), "'=1+1")
        self.assertEqual(csv_safe("Sam"), "Sam")


if __name__ == "__main__":
    unittest.main()
