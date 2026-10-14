// End-to-end playthrough in DEMO mode (localStorage), driving a real Chromium.
//   python dwm_quest/build.py && node dwm_quest/tests/e2e.cjs
// Checks: registration, all six missions (incl. walking to the DWM station), resume after closing the
// browser mid-game (Mission 2 done -> resumes at Mission 3), start time preserved, 12/15 passes and is
// eligible, 11/15 fails, save failures are reported (never "saved"), the demo dashboard and CSV export.
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright")); }
const path = require("path");
const fs = require("fs");
const assert = require("assert/strict");

const FILE = "file://" + path.resolve(__dirname, "../dist/dwm-quest-standalone.html");
const bank = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../content/assessment_bank.json"), "utf8"));
const SHOTS = process.env.SHOTS || path.resolve(__dirname, "../e2e-shots");
fs.mkdirSync(SHOTS, { recursive: true });
const log = (...a) => console.log("•", ...a);

async function clickText(page, sel, text) {
  const ok = await page.evaluate(([sel, text]) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().endsWith(text.trim()) || e.textContent.trim() === text.trim());
    if (!el) return false; el.click(); return true;
  }, [sel, text]);
  if (!ok) throw new Error(`No ${sel} with text: ${text}`);
}
const btn = (page, name) => page.getByRole("button", { name, exact: true }).first().click();

async function playStep(page, m, s) {
  const step = await page.evaluate(([m, s]) => {
    const st = window.DWM.MISSION_BY_ID[m].steps[s];
    return JSON.parse(JSON.stringify(st, (k, v) => (typeof v === "function" ? undefined : v)));
  }, [m, s]);
  for (const k of step.requires || []) await page.locator(`.hs[aria-label^="Board section ${k}:"]`).click();
  switch (step.type) {
    case "dialog": await btn(page, "Continue →"); break;
    case "walk":
      await page.getByRole("button", { name: "Walk to the DWM station" }).click();
      await page.getByRole("button", { name: "Open the board →" }).click({ timeout: 15000 });
      break;
    case "choice": {
      const wrong = step.options.find((o) => !o.ok);
      if (m === "m2" && step.id === "gap") { // one deliberate wrong answer to check feedback
        await clickText(page, ".opt", wrong.t); await btn(page, "Check answer");
        await page.getByText("Not the best choice").waitFor();
      }
      await clickText(page, ".opt", step.options.find((o) => o.ok).t); await btn(page, "Check answer"); await btn(page, "Continue →"); break;
    }
    case "multi":
      for (const o of step.options.filter((o) => o.ok)) await clickText(page, ".opt", o.t);
      await btn(page, "Check answer"); await btn(page, "Continue →"); break;
    case "classify": {
      const rows = page.locator(".citem");
      for (let i = 0; i < step.items.length; i++) await rows.nth(i).locator(".seg button", { hasText: step.items[i].a }).filter({ hasText: new RegExp("^" + step.items[i].a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$") }).click();
      await btn(page, "Check answer"); await btn(page, "Continue →"); break;
    }
    case "sequence":
      for (const it of step.items) await clickText(page, ".pool .opt", it);
      await btn(page, "Check order"); await btn(page, "Continue →"); break;
    case "why": {
      const o = step.options.find((x) => x.ok);
      await clickText(page, ".opt", o.t);
      await page.selectOption(`#ev-${step.id}`, [].concat(o.ev)[0]);
      await btn(page, "Check"); await btn(page, "Add to the chain →"); break;
    }
    case "summary":
      for (const [k, f] of Object.entries(step.fields)) await page.selectOption(`#sum-${k}`, String(f.a));
      await btn(page, "Confirm summary"); await btn(page, "Continue →"); break;
    default: throw new Error("unhandled " + step.type);
  }
}

async function playMission(page, m) {
  const n = await page.evaluate((m) => window.DWM.MISSION_BY_ID[m].steps.length, m);
  for (let guard = 0; guard < 40; guard++) {
    const s = await page.evaluate((m) => window.DWM.app.state.missions[m].step, m);
    const done = await page.getByText(/Mission \d complete/).count();
    if (done) break;
    await playStep(page, m, s);
    if (s === n - 1) break;
  }
  await page.getByText(new RegExp(`Mission ${m.slice(1)} complete`)).waitFor();
}

async function waitSaved(page) { await page.waitForFunction(() => document.querySelector(".save-pill")?.dataset.state === "saved"); }

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  let page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(FILE);
  await page.getByText("DEMO MODE").waitFor();
  await page.screenshot({ path: `${SHOTS}/01-welcome.png`, fullPage: true });
  await btn(page, "Start Learning");
  await btn(page, "Start the game"); // validation errors expected
  await page.getByText("Enter a valid employee ID.").waitFor();
  await page.fill("#empId", "TEST-001"); await page.fill("#empName", "Test Participant"); await page.fill("#empEmail", "test.participant@example.com");
  await btn(page, "Start the game");
  await page.getByRole("heading", { name: "Mission Hub" }).waitFor();
  await waitSaved(page);
  const start1 = await page.evaluate(() => JSON.parse(localStorage.getItem("dwmq.demo.profile")).gameStartAt);
  log("registered; start time", start1);

  await page.getByRole("button", { name: "Start mission" }).first().click();
  await playMission(page, "m1"); log("Mission 1 complete");
  await btn(page, "Start Mission 2 →");
  await playMission(page, "m2"); log("Mission 2 complete");
  await waitSaved(page);

  // Close the browser context page and come back: should resume at Mission 3 with data intact.
  await page.close();
  page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.getByRole("heading", { name: "Welcome back, Test Participant" }).waitFor();
  await page.screenshot({ path: `${SHOTS}/02-resume.png` });
  await page.getByText("Last saved checkpoint: Mission 3: DWM Station Walk-up").waitFor();
  await btn(page, "Resume Game");
  await page.getByRole("heading", { name: "DWM Station Walk-up" }).waitFor();
  const hubState = await page.evaluate(() => ({ m2: DWM.app.state.missions.m2.status, m3: DWM.app.state.missions.m3.status, start: DWM.app.profile.gameStartAt, pts: DWM.app.state.missions.m1.points }));
  assert.equal(hubState.m2, "completed"); assert.equal(hubState.m3, "in_progress"); assert.equal(hubState.start, start1); assert.ok(hubState.pts > 0);
  log("resume OK: lands in Mission 3, M2 completed, start time preserved");

  // Mission 3: walk + board. Leave mid-mission and resume at the same step.
  await page.locator("canvas").first().waitFor();
  await page.screenshot({ path: `${SHOTS}/03-floor.png` });
  await playStep(page, "m3", 0); // walk
  await playStep(page, "m3", 1); // review target
  await playStep(page, "m3", 2);
  await waitSaved(page);
  await page.reload();
  await btn(page, "Resume Game");
  await page.getByText("Check review frequency").first().waitFor();
  const s3 = await page.evaluate(() => DWM.app.state.missions.m3.step);
  assert.equal(s3, 3); log("mid-mission resume OK at Mission 3 step", s3);
  await page.screenshot({ path: `${SHOTS}/04-board.png`, fullPage: true });
  await playMission(page, "m3"); log("Mission 3 complete");
  for (const m of ["m4", "m5", "m6"]) { await btn(page, `Start Mission ${m.slice(1)} →`); await playMission(page, m); log(`Mission ${m.slice(1)} complete`); }
  const completedBefore = await page.evaluate(() => DWM.app.profile.gameCompletedAt);
  assert.equal(completedBefore, null, "completion time stays blank until the assessment is submitted");

  // Assessment: 12/15 correct -> pass + eligible.
  await btn(page, "Go to the assessment →");
  const order = await page.evaluate(() => DWM.app.state.assessment.questions.map((q) => q.id));
  for (let i = 0; i < order.length; i++) {
    const q = bank.questions.find((x) => x.id === order[i]);
    const pick = i < 12 ? q.answer : q.options.find((o) => o.id !== q.answer).id;
    await clickText(page, ".opt", q.options.find((o) => o.id === pick).t);
    if (i < order.length - 1) await btn(page, "Next →");
  }
  await btn(page, "Review and submit");
  await page.getByRole("button", { name: "Submit", exact: true }).dblclick(); // double click must not create two attempts
  await page.getByText("Eligible for Certification").first().waitFor();
  await page.screenshot({ path: `${SHOTS}/05-results.png`, fullPage: true });
  const res = await page.evaluate(() => ({ p: DWM.app.profile, attempts: JSON.parse(localStorage.getItem("dwmq.demo.attempts")) }));
  assert.equal(res.attempts.length, 1); assert.equal(res.p.latestScorePct, 80); assert.equal(res.p.eligible, true); assert.ok(res.p.gameCompletedAt);
  assert.equal(res.p.gameStartAt, start1);
  log("12/15 = 80% -> Passed, eligible; one attempt stored; completion time set");

  // Demo dashboard + CSV.
  await btn(page, "Back to Mission Hub");
  await btn(page, "Owner dashboard (demo)");
  await page.getByText("DEMO DATA").waitFor();
  await page.screenshot({ path: `${SHOTS}/06-dashboard.png`, fullPage: true });
  await page.fill("#f-q", "TEST-001");
  await page.getByText("1 of 7 participants").waitFor();
  const [dl] = await Promise.all([page.waitForEvent("download"), btn(page, "Export all results (CSV)")]);
  const csv = fs.readFileSync(await dl.path(), "utf8");
  assert.ok(csv.includes("Employee ID,Employee Name,Email ID") && csv.includes("TEST-001"));
  log("dashboard filters + CSV export OK");

  // 11/15 fails: fresh participant with missions pre-completed.
  const p2 = await ctx.newPage();
  p2.on("pageerror", (e) => errors.push(e.message));
  await p2.goto(FILE);
  await p2.evaluate(() => { localStorage.clear(); });
  await p2.reload();
  await btn(p2, "Start Learning");
  await p2.fill("#empId", "TEST-002"); await p2.fill("#empName", "Second Participant"); await p2.fill("#empEmail", "second@example.com");
  await btn(p2, "Start the game");
  await p2.getByRole("heading", { name: "Mission Hub" }).waitFor();
  await p2.evaluate(() => { for (const id of DWM.logic.MISSION_IDS) DWM.app.state.missions[id].status = "completed"; DWM.app.commit(true); DWM.app.go("assessment"); });
  const order2 = await p2.evaluate(() => DWM.app.state.assessment.questions.map((q) => q.id));
  for (let i = 0; i < order2.length; i++) {
    const q = bank.questions.find((x) => x.id === order2[i]);
    const pick = i < 11 ? q.answer : q.options.find((o) => o.id !== q.answer).id;
    await clickText(p2, ".opt", q.options.find((o) => o.id === pick).t);
    if (i < order2.length - 1) await btn(p2, "Next →");
  }
  await btn(p2, "Review and submit"); await btn(p2, "Submit");
  await p2.getByText("Not Yet Eligible").first().waitFor();
  const r2 = await p2.evaluate(() => DWM.app.profile);
  assert.equal(r2.latestScorePct, 73.3); assert.equal(r2.eligible, false);
  await p2.getByText("Review the recommended learning areas and attempt the assessment again according to the assessment policy.").waitFor();
  await p2.getByRole("button", { name: /Retake assessment/ }).waitFor();
  log("11/15 = 73.3% -> Not Yet Eligible, retake offered");

  // Save failure must be reported, never shown as saved.
  await p2.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; DWM.app.commit(true); });
  await p2.waitForFunction(() => document.querySelector(".save-pill").dataset.state === "error");
  const pill = await p2.locator(".save-pill").innerText();
  assert.ok(pill.includes("Unable to save")); log("failed save reported:", pill.replace(/\s+/g, " "));

  // Phone width: no horizontal page scroll on the hub.
  await p2.setViewportSize({ width: 390, height: 800 });
  await p2.evaluate(() => DWM.app.go("hub"));
  const overflow = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, "horizontal overflow " + overflow);
  await p2.screenshot({ path: `${SHOTS}/07-phone-hub.png`, fullPage: true });
  log("phone width OK");

  assert.deepEqual(errors, []);
  await browser.close();
  console.log("\nE2E PASSED");
})().catch((e) => { console.error(e); process.exit(1); });
