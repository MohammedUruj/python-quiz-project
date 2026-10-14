// Pure logic: hashing, scoring, eligibility, progress and CSV. No DOM access, so tests can load it in Node.
(function (root) {
  const DWM = (root.DWM = root.DWM || {});

  const MISSION_IDS = ["m1", "m2", "m3", "m4", "m5", "m6"];
  const SCHEMA_VERSION = 1;

  // cyrb53: small non-cryptographic hash. Answer keys are stored as hashes so they are not readable
  // in the page source. This deters casual inspection only; see README "Assessment integrity".
  function hash(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  const answerKey = (salt, qid, optionId) => hash(`${salt}|${qid}|${optionId}`, 7);

  function newState() {
    const missions = {};
    MISSION_IDS.forEach((id, i) => {
      missions[id] = { status: i === 0 ? "available" : "locked", step: 0, answers: {}, tries: {}, points: 0, completedAt: null };
    });
    return { schemaVersion: SCHEMA_VERSION, missions, checkpoint: { screen: "hub", label: "Mission Hub" }, assessment: null };
  }

  // Forward-compatible merge: missions added in later versions appear without breaking saved progress.
  function migrateState(saved) {
    const base = newState();
    if (!saved || typeof saved !== "object") return base;
    const out = { ...base, ...saved, missions: { ...base.missions } };
    MISSION_IDS.forEach((id) => {
      if (saved.missions && saved.missions[id]) out.missions[id] = { ...base.missions[id], ...saved.missions[id] };
    });
    unlockMissions(out);
    out.schemaVersion = SCHEMA_VERSION;
    return out;
  }

  function unlockMissions(state) {
    MISSION_IDS.forEach((id, i) => {
      const m = state.missions[id];
      if (m.status === "locked" && (i === 0 || state.missions[MISSION_IDS[i - 1]].status === "completed")) m.status = "available";
    });
    return state;
  }

  const missionsCompleted = (state) => MISSION_IDS.filter((id) => state.missions[id].status === "completed");
  const allMissionsDone = (state) => missionsCompleted(state).length === MISSION_IDS.length;
  const totalPoints = (state) => MISSION_IDS.reduce((s, id) => s + (state.missions[id].points || 0), 0);

  // Progress: six missions + one submitted assessment = seven mandatory activities.
  function progressPct(state, attemptsCount) {
    const done = missionsCompleted(state).length + (attemptsCount > 0 ? 1 : 0);
    return Math.round((done / (MISSION_IDS.length + 1)) * 100);
  }

  function currentMission(state) {
    if (allMissionsDone(state)) return "Assessment";
    const m = MISSION_IDS.find((id) => state.missions[id].status !== "completed");
    return m ? "Mission " + m.slice(1) : "Assessment";
  }

  // questions: [{id, area, key, options:[{id}]}]; answers: {qid: optionId}
  function scoreAttempt(questions, answers, salt) {
    let correct = 0;
    const wrongAreas = new Set();
    const perQuestion = questions.map((q) => {
      const chosen = answers[q.id];
      const ok = chosen != null && answerKey(salt, q.id, chosen) === q.key;
      if (ok) correct++; else wrongAreas.add(q.area);
      return { id: q.id, chosen: chosen ?? null, correct: ok };
    });
    const total = questions.length;
    const scorePct = total ? Math.round((correct / total) * 1000) / 10 : 0;
    return { correct, incorrect: total - correct, total, scorePct, perQuestion, wrongAreas: [...wrongAreas] };
  }

  function isPass(scorePct, passPercent) { return scorePct + 1e-9 >= passPercent; }

  function eligibility({ scorePct, passPercent, missionsDone, requireAllMissions }) {
    const passed = scorePct != null && isPass(scorePct, passPercent);
    const eligible = passed && (!requireAllMissions || missionsDone);
    return { passed, eligible };
  }

  function attemptsAllowed(maxAttempts, used) { return !maxAttempts || used < maxAttempts; }

  function validEmail(email, domains) {
    const e = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return false;
    if (domains && domains.length) return domains.includes(e.split("@")[1]);
    return true;
  }
  const validEmployeeId = (id) => /^[A-Za-z0-9][A-Za-z0-9\-_/]{1,19}$/.test(String(id || "").trim());
  const validName = (n) => { const s = String(n || "").trim(); return s.length >= 2 && s.length <= 80; };

  function csvCell(v) {
    if (v == null) return "";
    let s = String(v);
    // Neutralise spreadsheet formula injection from user-entered text.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(headers, rows) {
    // BOM so Excel opens UTF-8 correctly.
    return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }

  function shuffle(arr, rnd = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function newId(prefix) {
    const r = (root.crypto && root.crypto.getRandomValues) ? Array.from(root.crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("") : Math.random().toString(16).slice(2, 18);
    return `${prefix}-${Date.now().toString(36)}-${r}`;
  }

  DWM.logic = { MISSION_IDS, SCHEMA_VERSION, hash, answerKey, newState, migrateState, unlockMissions, missionsCompleted,
    allMissionsDone, totalPoints, progressPct, currentMission, scoreAttempt, isPass, eligibility, attemptsAllowed,
    validEmail, validEmployeeId, validName, csvCell, toCSV, shuffle, newId };
})(typeof window !== "undefined" ? window : globalThis);
