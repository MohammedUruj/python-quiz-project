// Run: node dwm_quest/tests/logic.test.mjs   (after python dwm_quest/build.py)
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..", "src");
const ctx = { console, Math, Date, JSON };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["config.js", "logic.js", "questions.gen.js", "content.js"]) vm.runInContext(fs.readFileSync(path.join(src, f), "utf8"), ctx, { filename: f });
const { DWM } = ctx;
const L = DWM.logic;
const bank = JSON.parse(fs.readFileSync(path.join(here, "..", "content", "assessment_bank.json"), "utf8"));
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("exactly 15 questions, at least half scenario-based, every learning area covered", () => {
  const qs = DWM.QUESTION_BANK.questions;
  assert.equal(qs.length, 15);
  assert.equal(DWM.CONFIG.questionCount, 15);
  assert.ok(qs.filter((q) => q.scenario).length >= 8);
  assert.equal([...new Set(qs.map((q) => q.area))].sort().join(), Object.keys(DWM.LEARNING_AREAS).sort().join());
});
t("shipped bank has no plain answers; Python and JS hashes agree", () => {
  for (const q of DWM.QUESTION_BANK.questions) {
    assert.equal(q.answer, undefined);
    const src = bank.questions.find((x) => x.id === q.id);
    assert.equal(L.answerKey(bank.salt, q.id, src.answer), q.key, q.id);
    for (const o of q.options) if (o.id !== src.answer) assert.notEqual(L.answerKey(bank.salt, q.id, o.id), q.key);
  }
});
const answersWith = (k) => {
  const a = {};
  bank.questions.forEach((q, i) => { a[q.id] = i < k ? q.answer : q.options.find((o) => o.id !== q.answer).id; });
  return a;
};
t("15/15 = 100%, 12/15 = 80% passes, 11/15 = 73.3% fails", () => {
  const qs = DWM.QUESTION_BANK.questions;
  const s15 = L.scoreAttempt(qs, answersWith(15), bank.salt);
  assert.equal(s15.scorePct, 100);
  const s12 = L.scoreAttempt(qs, answersWith(12), bank.salt);
  assert.equal(s12.correct, 12); assert.equal(s12.scorePct, 80); assert.ok(L.isPass(s12.scorePct, 80));
  const s11 = L.scoreAttempt(qs, answersWith(11), bank.salt);
  assert.equal(s11.correct, 11); assert.equal(s11.scorePct, 73.3); assert.ok(!L.isPass(s11.scorePct, 80));
  assert.equal(s11.wrongAreas.length, 4);
});
t("unanswered questions count as incorrect", () => {
  const r = L.scoreAttempt(DWM.QUESTION_BANK.questions, {}, bank.salt);
  assert.equal(r.correct, 0); assert.equal(r.incorrect, 15);
});
t("eligibility needs pass AND all missions", () => {
  assert.equal(L.eligibility({ scorePct: 80, passPercent: 80, missionsDone: true, requireAllMissions: true }).eligible, true);
  assert.equal(L.eligibility({ scorePct: 100, passPercent: 80, missionsDone: false, requireAllMissions: true }).eligible, false);
  assert.equal(L.eligibility({ scorePct: 73.3, passPercent: 80, missionsDone: true, requireAllMissions: true }).eligible, false);
  assert.equal(L.eligibility({ scorePct: null, passPercent: 80, missionsDone: true, requireAllMissions: true }).eligible, false);
});
t("progress and unlocking", () => {
  const s = L.newState();
  assert.equal(s.missions.m1.status, "available"); assert.equal(s.missions.m2.status, "locked");
  s.missions.m1.status = "completed"; s.missions.m2.status = "completed"; L.unlockMissions(s);
  assert.equal(s.missions.m3.status, "available");
  assert.equal(L.currentMission(s), "Mission 3");
  assert.equal(L.progressPct(s, 0), 29);
  for (const id of L.MISSION_IDS) s.missions[id].status = "completed";
  assert.equal(L.progressPct(s, 0), 86); assert.equal(L.progressPct(s, 1), 100);
});
t("migrateState keeps saved progress and fills new fields", () => {
  const old = { missions: { m1: { status: "completed", points: 40 }, m2: { status: "in_progress", step: 3 } } };
  const m = L.migrateState(old);
  assert.equal(m.missions.m1.points, 40); assert.equal(m.missions.m2.step, 3); assert.equal(JSON.stringify(m.missions.m2.answers), "{}");
  assert.equal(m.missions.m6.status, "locked"); assert.equal(m.schemaVersion, 1);
});
t("validation", () => {
  assert.ok(L.validEmail("a.b@jkmail.com", ["jkmail.com"])); assert.ok(!L.validEmail("a@gmail.com", ["jkmail.com"]));
  assert.ok(!L.validEmail("bad@", [])); assert.ok(L.validEmployeeId("JK-10234")); assert.ok(!L.validEmployeeId("x"));
});
t("CSV escapes quotes/commas and neutralises formulas", () => {
  const csv = L.toCSV(["a", "b"], [['x,"y"', "=SUM(A1)"]]);
  assert.ok(csv.includes('"x,""y"""')); assert.ok(csv.includes("'=SUM(A1)"));
});
t("mission content: 6 missions, station has hotspots A–H, choice steps have exactly one correct option", () => {
  assert.equal(DWM.MISSIONS.length, 6);
  assert.equal(Object.keys(DWM.MISSIONS[2].board).join(""), "ABCDEFGH");
  for (const m of DWM.MISSIONS) for (const s of m.steps) {
    if (s.type === "choice" || s.type === "why") assert.equal(s.options.filter((o) => o.ok).length, 1, `${m.id}/${s.id}`);
    if (s.type === "multi") assert.ok(s.options.some((o) => o.ok) && s.options.some((o) => !o.ok), `${m.id}/${s.id}`);
    if (s.type === "classify") for (const it of s.items) assert.ok((it.options || s.categories).includes(it.a), `${m.id}/${s.id}: ${it.t}`);
    if (s.requires) for (const k of s.requires) assert.ok(DWM.MISSIONS[2].board[k]);
  }
});
console.log(`\n${n} tests passed`);
