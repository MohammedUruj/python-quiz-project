"""Quiz bank loading, question selection, scoring and performance bands.

All scoring happens on the server so that the browser never needs the answer key
before the participant submits.
"""

import json
import random
from pathlib import Path

BANK_PATH = Path(__file__).with_name("quiz_bank.json")

DEFAULT_CONFIG = {
    "passing_threshold": 75,
    "question_count": 20,
    "allow_review": True,
    "shuffle_questions": True,
    "require_levels_before_quiz": True,
    "bands": [
        {"min": 90, "label": "Quality Champion"},
        {"min": 75, "label": "Quality Practitioner"},
        {"min": 60, "label": "Developing Quality Skills"},
        {"min": 0, "label": "Further Learning Recommended"},
    ],
}


def load_bank(path=BANK_PATH):
    with open(path, encoding="utf-8") as fh:
        questions = json.load(fh)["questions"]
    ids = set()
    for q in questions:
        if q["id"] in ids:
            raise ValueError(f"Duplicate question id {q['id']}")
        ids.add(q["id"])
        if not 0 <= q["answer"] < len(q["options"]):
            raise ValueError(f"Question {q['id']} has an invalid answer index")
    return questions


def public_question(q):
    """Strip the answer key and explanation before sending a question to a participant."""
    keep = ("id", "topic", "type", "prompt", "scenario", "options", "chart")
    return {k: q[k] for k in keep if k in q}


def select_questions(bank, count, shuffle=True, rng=None):
    """Core questions first (so the default assessment covers every topic), then extras."""
    rng = rng or random.Random()
    count = max(1, min(int(count), len(bank)))
    core = [q for q in bank if q.get("core")]
    extra = [q for q in bank if not q.get("core")]
    if shuffle:
        rng.shuffle(core)
        rng.shuffle(extra)
    chosen = (core + extra)[:count]
    if shuffle:
        rng.shuffle(chosen)
    return chosen


def band_for(percent, bands):
    for band in sorted(bands, key=lambda b: b["min"], reverse=True):
        if percent >= band["min"]:
            return band["label"]
    return bands[-1]["label"] if bands else ""


def score_submission(bank, answers, config):
    """Score a dict {question_id: selected_option_index}.

    Returns (result, error). Unknown ids or a wrong number of answers are rejected so a
    participant cannot shrink the assessment.
    """
    by_id = {q["id"]: q for q in bank}
    if not isinstance(answers, dict) or not answers:
        return None, "No answers were submitted."
    expected = max(1, min(int(config["question_count"]), len(bank)))
    if len(answers) != expected:
        return None, f"Expected {expected} answers but received {len(answers)}."
    review = []
    correct = 0
    for qid, selected in answers.items():
        q = by_id.get(qid)
        if q is None:
            return None, f"Unknown question id: {qid}"
        if selected is not None and (not isinstance(selected, int) or isinstance(selected, bool)
                                     or not 0 <= selected < len(q["options"])):
            return None, f"Invalid answer for {qid}"
        ok = selected == q["answer"]
        correct += ok
        review.append({
            "id": qid,
            "topic": q["topic"],
            "prompt": q["prompt"],
            "options": q["options"],
            "selected": selected,
            "correct": q["answer"],
            "is_correct": ok,
            "explanation": q["explanation"],
        })
    total = len(review)
    percent = round(correct / total * 100, 1)
    result = {
        "score": correct,
        "total": total,
        "percent": percent,
        "band": band_for(percent, config["bands"]),
        "passed": percent >= float(config["passing_threshold"]),
        "passing_threshold": float(config["passing_threshold"]),
        "review": review,
    }
    return result, None


def validate_config(new, bank_size):
    """Merge a partial config update into a validated full config. Returns (config, error)."""
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    if not isinstance(new, dict):
        return None, "Config must be an object."
    try:
        if "passing_threshold" in new:
            v = float(new["passing_threshold"])
            if not 0 <= v <= 100:
                return None, "Passing threshold must be between 0 and 100."
            cfg["passing_threshold"] = v
        if "question_count" in new:
            v = int(new["question_count"])
            if not 1 <= v <= bank_size:
                return None, f"Question count must be between 1 and {bank_size}."
            cfg["question_count"] = v
        for key in ("allow_review", "shuffle_questions", "require_levels_before_quiz"):
            if key in new:
                cfg[key] = bool(new[key])
        if "bands" in new:
            bands = []
            for b in new["bands"]:
                label = str(b["label"]).strip()[:60]
                lo = float(b["min"])
                if not label or not 0 <= lo <= 100:
                    return None, "Each band needs a label and a minimum between 0 and 100."
                bands.append({"min": lo, "label": label})
            if not bands or min(b["min"] for b in bands) != 0:
                return None, "Bands must include one band starting at 0%."
            cfg["bands"] = sorted(bands, key=lambda b: b["min"], reverse=True)
    except (TypeError, ValueError, KeyError):
        return None, "Invalid configuration values."
    return cfg, None
