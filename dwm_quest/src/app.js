// App shell: boot, screens, autosave, time tracking and the mission controller.
(function () {
  const DWM = window.DWM;
  const { h, dialogue, toast, fmtDate, focusMain } = DWM.ui;
  const L = DWM.logic;
  const C = DWM.CONFIG;
  const Store = DWM.store;

  const app = { profile: null, state: null, screen: null };
  const root = () => document.getElementById("app");

  // ---------------- save / derived fields ----------------
  function derive() {
    const p = app.profile, st = app.state;
    p.state = st;
    p.currentMission = L.currentMission(st);
    p.progressPct = L.progressPct(st, p.assessmentAttempts || 0);
    p.missionsCompleted = L.missionsCompleted(st);
    p.points = L.totalPoints(st);
    if (!p.gameCompletedAt && L.allMissionsDone(st) && (p.assessmentAttempts || 0) > 0) {
      // First time every mandatory activity is complete. Never overwritten afterwards.
      p.gameCompletedAt = new Date().toISOString();
    }
    if (p.assessmentAttempts && p.attemptHistory) {
      const best = Math.max(...p.attemptHistory.map((x) => x.scorePct));
      p.eligible = L.eligibility({ scorePct: best, passPercent: C.passPercent, missionsDone: L.allMissionsDone(st), requireAllMissions: C.requireAllMissions }).eligible;
    }
  }
  app.commit = function (meaningful) {
    if (!app.profile) return;
    flushTime();
    derive();
    const now = new Date().toISOString();
    app.profile.updatedAt = now;
    if (meaningful) app.profile.lastActivityAt = now;
    Store.saveProfile(app.profile);
  };

  // Active time: counts seconds while the page is visible and the player interacted in the last 2 minutes.
  let lastInput = Date.now(), activeAcc = 0, lastTick = Date.now();
  ["pointerdown", "keydown", "scroll"].forEach((ev) => window.addEventListener(ev, () => (lastInput = Date.now()), { passive: true }));
  setInterval(() => {
    const now = Date.now();
    if (document.visibilityState === "visible" && now - lastInput < 120000) activeAcc += (now - lastTick) / 1000;
    lastTick = now;
  }, 1000);
  function flushTime() { if (app.profile && activeAcc >= 1) { app.profile.totalTimeSec = Math.round((app.profile.totalTimeSec || 0) + activeAcc); activeAcc = 0; } }
  setInterval(() => { if (app.profile && activeAcc >= 5) app.commit(false); }, C.periodicSaveSeconds * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && app.profile && activeAcc >= 1) app.commit(false); });

  // ---------------- top bar ----------------
  function topbar() {
    const pill = h("span", { class: "save-pill", role: "status", "aria-live": "polite" }, h("span", { class: "dot" }), h("span", { class: "txt" }));
    Store.onStatus((s) => {
      pill.dataset.state = s.state;
      pill.querySelector(".txt").textContent = app.profile ? s.text : "Not registered";
      pill.querySelector("button")?.remove();
      if (s.state === "error") pill.append(h("button", { onclick: () => Store.retry() }, "Retry"));
    });
    const bar = h("header", { class: "topbar" }, h("div", { class: "topbar-inner" },
      h("div", { class: "brand" }, h("b", { text: "DWM QUEST" }), h("span", { text: "The Daily Excellence Challenge" })),
      h("div", { class: "spacer" }), pill,
      h("button", { class: "tb-btn", id: "tb-hub", hidden: true, onclick: () => go("hub") }, "Mission Hub")));
    document.body.prepend(bar);
  }
  function modeBanner() {
    const S = Store.S;
    const b = h("div", { class: "mode-banner " + (S.mode === "central" ? "central" : "") }, h("div", null,
      S.mode === "central"
        ? "Your progress is saved to the central results store under your claude.ai sign-in. You can close this page and resume later, on any device."
        : `DEMO MODE: ${S.reason || ""} Progress is kept in this browser only. Do not use demo mode for real employee records.`));
    document.querySelector(".topbar").after(b);
  }

  // ---------------- routing ----------------
  function go(screen, arg) {
    app.screen = screen;
    document.getElementById("tb-hub").hidden = !app.profile || screen === "hub" || screen === "welcome";
    const r = root();
    r.replaceChildren();
    ({ welcome, register, resume, hub, mission: missionScreen, assessment: assessmentScreen, results, admin, error: errorScreen })[screen](r, arg);
    focusMain();
  }
  app.go = go;

  // ---------------- screens ----------------
  function heroArt() {
    const c = h("canvas", { width: 520, height: 300, "aria-hidden": "true" });
    const g = c.getContext("2d");
    g.fillStyle = "#0c1a31"; g.fillRect(0, 0, 520, 300);
    // board silhouette with bars: plan vs actual
    g.fillStyle = "#13284a"; g.fillRect(40, 40, 300, 200);
    g.strokeStyle = "#2a3d5c"; g.strokeRect(40, 40, 300, 200);
    g.fillStyle = "#9fb4d4"; g.font = "600 13px 'IBM Plex Sans', sans-serif"; g.fillText("PLAN vs ACTUAL (SIMULATED)", 56, 64);
    const plan = [250, 500, 750], act = [220, 390, 570];
    plan.forEach((p, i) => {
      const x = 70 + i * 90;
      g.fillStyle = "#3a4d6d"; g.fillRect(x, 220 - p / 4.4, 26, p / 4.4);
      g.fillStyle = act[i] / p < 0.95 ? "#f07d74" : "#5cc28f"; g.fillRect(x + 30, 220 - act[i] / 4.4, 26, act[i] / 4.4);
      g.fillStyle = "#c8d5ea"; g.font = "12px 'IBM Plex Mono', monospace"; g.fillText(["08:00", "10:00", "12:00"][i], x + 6, 236);
    });
    // tyre
    g.fillStyle = "#06080c"; g.beginPath(); g.arc(420, 170, 78, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#2c323c"; g.lineWidth = 8;
    for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; g.beginPath(); g.moveTo(420 + Math.cos(t) * 64, 170 + Math.sin(t) * 64); g.lineTo(420 + Math.cos(t) * 76, 170 + Math.sin(t) * 76); g.stroke(); }
    g.fillStyle = "#3a4555"; g.beginPath(); g.arc(420, 170, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#0c1a31"; g.beginPath(); g.arc(420, 170, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#e3a73a"; g.font = "700 16px 'Barlow Condensed', sans-serif"; g.fillText("PDCA", 403, 286);
    return c;
  }

  function welcome(r) {
    const has = !!app.profile;
    r.append(h("div", { class: "stack" },
      h("section", { class: "hero" },
        h("div", { class: "hero-copy" },
          h("div", { class: "label", text: `${C.organization} · DWM learning` }),
          h("h1", { text: "DWM QUEST" }),
          h("div", { style: "font-family:var(--font-display);font-size:1.5rem;letter-spacing:.02em", text: "The Daily Excellence Challenge" }),
          h("p", { class: "tagline", text: C.tagline }),
          h("p", { text: "Join a fictional tyre plant as its DWM Improvement Champion. Output is slipping, a curing press keeps stopping and actions are overdue. Review the daily management system, find the cause and stop it coming back. About 15 minutes, plus a 15-question assessment." }),
          h("div", { class: "row" },
            h("button", { class: "btn accent", onclick: () => go(has ? "hub" : "register") }, has ? "Continue learning" : "Start Learning"),
            has ? h("button", { class: "btn", style: "background:transparent;color:#fff;border-color:rgba(255,255,255,.4)", onclick: () => go("resume") }, "Resume Game") : null)),
        h("div", { class: "hero-art" }, heroArt())),
      h("div", { class: "flow", "aria-label": "DWM process flow" },
        ...[["PLAN", ["Organisation structure, Role Sheet, Standards", "MP/CP Tree and MP Planning Sheet"]],
          ["DO", ["Routine work to standard", "Track MP/CP at defined frequency and target"]],
          ["CHECK", ["Any abnormality? No → continue routine", "Yes → restore normal safely, identify and record"]],
          ["ACT", ["Occurred before? RCA and corrective action", "Revise standards, train, verify, deploy horizontally"]]]
          .map(([t, li]) => h("div", null, h("h3", { text: t }), h("ul", null, ...li.map((x) => h("li", { text: x })))))),
      h("div", { class: "grid2" }, ...Object.keys(DWM.CHARACTERS).map((k) => {
        const c = DWM.CHARACTERS[k];
        const lines = { arjun: "Targets, standards, review frequency and daily performance.", meera: "The DWM process, abnormalities, PDCA and standardisation.", kabir: "Why-Why Analysis and evidence-based RCA.", asha: "Effectiveness, horizontal deployment and sustaining results." };
        return h("div", { class: "row panel", style: "flex-wrap:nowrap" }, h("div", { class: "portrait", html: DWM.ui.portrait(k) }), h("div", { style: "min-width:0" }, h("b", { text: c.name }), h("div", { class: "muted", style: "font-size:.85rem", text: c.role }), h("p", { style: "font-size:.9rem", text: lines[k] })));
      })),
      footer()));
  }

  function footer() {
    return h("p", { class: "footer-note", text: `Prototype identity. All plant data, people and records in the scenarios are fictional and labelled SIMULATED. Official ${C.organization} branding is not used. Results are learning records only; no official certificate is issued.` });
  }

  function register(r) {
    const S = Store.S;
    const errs = {};
    const fld = (id, label, type, ac, hint) => {
      const inp = h("input", { id, name: id, type, autocomplete: ac, required: true });
      errs[id] = h("span", { class: "err", id: id + "-err", "aria-live": "polite" });
      inp.setAttribute("aria-describedby", id + "-err");
      return h("div", { class: "field" }, h("label", { for: id, class: "label", text: label }), inp, hint ? h("span", { class: "muted", style: "font-size:.8rem", text: hint }) : null, errs[id]);
    };
    const form = h("form", { class: "panel stack", novalidate: true, style: "max-width:560px" },
      h("h2", { text: "Register to start" }),
      h("p", { class: "muted", text: S.mode === "central" ? "Your record is linked to your claude.ai sign-in, so you can return on any device and resume where you left off." : "Demo mode: this record stays in this browser only." }),
      fld("empId", "Employee ID", "text", "off", "Letters, digits, - _ /, up to 20 characters"),
      fld("empName", "Employee name", "text", "name"),
      fld("empEmail", "Company email ID", "email", "email", C.allowedEmailDomains.length ? "Allowed: @" + C.allowedEmailDomains.join(", @") : null),
      h("p", { class: "muted", style: "font-size:.82rem", text: `What is stored: your employee ID, name, company email, progress, decisions and assessment attempts. ${S.mode === "central" ? "Only you and the game owner (TQM cell) can see your record; other employees cannot." : ""}` }),
      h("div", { class: "row" }, h("button", { class: "btn primary", type: "submit" }, "Start the game"), h("button", { class: "btn ghost", type: "button", onclick: () => go("welcome") }, "Back")));
    let busy = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      const id = form.empId.value.trim(), name = form.empName.value.trim(), email = form.empEmail.value.trim().toLowerCase();
      errs.empId.textContent = L.validEmployeeId(id) ? "" : "Enter a valid employee ID.";
      errs.empName.textContent = L.validName(name) ? "" : "Enter your name (2–80 characters).";
      errs.empEmail.textContent = L.validEmail(email, C.allowedEmailDomains) ? "" : C.allowedEmailDomains.length ? "Use your company email address." : "Enter a valid email address.";
      if (!L.validEmployeeId(id) || !L.validName(name) || !L.validEmail(email, C.allowedEmailDomains)) { form.querySelector(".err:not(:empty)")?.previousElementSibling?.focus?.(); return; }
      busy = true;
      // Never overwrite an existing record's start time: re-check the store first.
      let existing = null;
      try { existing = await Store.loadProfile(); } catch { /* treated as new; the save status will report any failure */ }
      const now = new Date().toISOString();
      if (existing) { app.profile = existing; app.state = L.migrateState(existing.state); toast("Welcome back. Your saved progress was found."); go("resume"); return; }
      app.state = L.newState();
      app.profile = { schemaVersion: L.SCHEMA_VERSION, employeeId: id, employeeName: name, email, gameStartAt: now, gameCompletedAt: null, currentMission: "Mission 1", progressPct: 0,
        latestScorePct: null, assessmentAttempts: 0, assessmentStatus: "Not started", eligible: false, lastActivityAt: now, totalTimeSec: 0, createdAt: now, updatedAt: now,
        attemptHistory: [], missionLog: [], recommended: [] };
      app.commit(true);
      go("hub");
    });
    r.append(form);
  }

  function resume(r) {
    const p = app.profile, cp = app.state.checkpoint || { screen: "hub", label: "Mission Hub" };
    r.append(h("div", { class: "panel stack", style: "max-width:640px" },
      h("div", { class: "label", text: "Resume" }),
      h("h2", { text: `Welcome back, ${p.employeeName}` }),
      h("p", null, "Last saved checkpoint: ", h("b", { text: cp.label })),
      h("div", { class: "progress", "aria-label": `Progress ${p.progressPct || 0}%` }, h("i", { style: `width:${p.progressPct || 0}%` })),
      h("p", { class: "muted", text: `${L.missionsCompleted(app.state).length} of 6 missions complete · ${L.totalPoints(app.state)} points · started ${fmtDate(p.gameStartAt)}` }),
      h("div", { class: "row" },
        h("button", { class: "btn primary", onclick: () => resumeCheckpoint() }, "Resume Game"),
        h("button", { class: "btn", onclick: () => go("hub") }, "Mission Hub"))));
  }
  function resumeCheckpoint() {
    const cp = app.state.checkpoint || {};
    if (cp.screen === "mission" && cp.mission && app.state.missions[cp.mission] && app.state.missions[cp.mission].status !== "completed") go("mission", { id: cp.mission });
    else if (cp.screen === "assessment" && L.allMissionsDone(app.state) && (app.state.assessment || !(app.profile.attemptHistory || []).length)) go("assessment");
    else if (cp.screen === "results" && (app.profile.attemptHistory || []).length) go("results");
    else go("hub");
  }

  function hub(r) {
    const st = app.state, p = app.profile;
    const moved = !st.checkpoint || st.checkpoint.screen !== "hub";
    st.checkpoint = { screen: "hub", label: "Mission Hub" };
    const done = L.allMissionsDone(st);
    const used = p.assessmentAttempts || 0;
    const canTake = done && L.attemptsAllowed(C.maxAttempts, used) && !(p.attemptHistory || []).some((a) => a.passed);
    const statusChip = (s) => ({ completed: h("span", { class: "chip ok", text: "Completed" }), in_progress: h("span", { class: "chip warn", text: "In progress" }), available: h("span", { class: "chip info", text: "Ready" }), locked: h("span", { class: "chip", text: "Locked" }) })[s];
    r.append(h("div", { class: "stack" },
      h("div", { class: "mission-head" },
        h("div", null, h("div", { class: "label", text: `${p.employeeName} · ${p.employeeId}` }), h("h2", { text: "Mission Hub" })),
        h("div", { class: "row" }, h("span", { class: "chip info", text: `${L.totalPoints(st)} points` }), Store.S.isOwner || Store.S.mode === "demo" ? h("button", { class: "btn small", onclick: () => go("admin") }, Store.S.mode === "demo" ? "Owner dashboard (demo)" : "Results dashboard") : null)),
      h("div", { class: "panel stack", style: "gap:8px" },
        h("div", { class: "row", style: "justify-content:space-between" }, h("span", { class: "label", text: "Overall progress" }), h("b", { class: "mono", text: `${p.progressPct || 0}%` })),
        h("div", { class: "progress", "aria-hidden": "true" }, h("i", { style: `width:${p.progressPct || 0}%` })),
        h("p", { class: "muted", style: "font-size:.85rem", text: `Six missions + the assessment. Started ${fmtDate(p.gameStartAt)}${p.gameCompletedAt ? " · completed " + fmtDate(p.gameCompletedAt) : ""}. Your progress saves automatically.` })),
      h("div", { class: "missions" }, ...DWM.MISSIONS.map((m) => {
        const ms = st.missions[m.id];
        const label = ms.status === "completed" ? "Replay" : ms.status === "in_progress" ? "Resume mission" : "Start mission";
        return h("article", { class: "mcard", "data-status": ms.status },
          h("header", null, h("span", { class: "num", text: String(m.n).padStart(2, "0") }), h("div", { style: "min-width:0" }, h("div", { class: "label phase", text: m.phase }), h("h3", { text: m.title }))),
          h("p", { text: m.summary }),
          h("div", { class: "row", style: "justify-content:space-between" }, statusChip(ms.status),
            ms.status === "locked" ? h("span", { class: "muted", style: "font-size:.82rem", text: `Complete Mission ${m.n - 1} first` }) :
              h("button", { class: "btn small " + (ms.status === "completed" ? "" : "primary"), onclick: () => go("mission", { id: m.id, replay: ms.status === "completed" }) }, label)));
      })),
      h("article", { class: "mcard" },
        h("header", null, h("span", { class: "num", text: "✓" }), h("div", null, h("div", { class: "label phase", text: "Certification" }), h("h3", { text: "Final assessment · 15 questions" }))),
        h("p", { text: done ? `Pass mark ${C.passPercent}%. ${C.maxAttempts ? `Attempts used: ${used} of ${C.maxAttempts}.` : `Attempts used: ${used}.`}` : "Unlocks when all six missions are complete." }),
        h("div", { class: "row" },
          p.assessmentAttempts ? h("span", { class: "chip " + (p.eligible ? "ok" : "warn"), text: p.eligible ? "Eligible for Certification" : "Not Yet Eligible" }) : null,
          p.assessmentAttempts ? h("span", { class: "chip", text: `Latest ${p.latestScorePct}%` }) : null,
          canTake ? h("button", { class: "btn primary small", onclick: () => go("assessment") }, st.assessment ? "Resume assessment" : used ? "Retake assessment" : "Start assessment") : null,
          used ? h("button", { class: "btn small", onclick: () => go("results") }, "View latest result") : null)),
      footer()));
    if (moved) app.commit(false);
  }

  // ---------------- mission controller ----------------
  function missionScreen(r, arg) {
    const m = DWM.MISSION_BY_ID[arg.id];
    const real = app.state.missions[m.id];
    if (real.status === "locked") { go("hub"); return; }
    const replay = !!arg.replay && real.status === "completed";
    const ms = replay ? { status: "in_progress", step: 0, answers: {}, tries: {}, points: 0, seen: [] } : real;
    if (!replay && real.status === "available") { real.status = "in_progress"; real.startedAt = new Date().toISOString(); }
    ms.seen = ms.seen || [];
    const save = (meaningful) => { if (!replay) app.commit(meaningful); };

    const container = h("div", { class: "stack" });
    r.append(container);
    let walker = null;

    function setCheckpoint() {
      if (replay) return;
      const s = m.steps[ms.step];
      app.state.checkpoint = { screen: "mission", mission: m.id, step: ms.step, label: `Mission ${m.n}: ${m.title}${s && s.title ? " · " + s.title : ""}` };
    }

    function draw() {
      if (walker) { walker.destroy(); walker = null; }
      ms.step = Math.min(ms.step, m.steps.length - 1);
      const step = m.steps[ms.step];
      setCheckpoint();
      const head = h("div", { class: "mission-head" },
        h("div", null, h("div", { class: "label", text: `Mission ${m.n} · ${m.phase}${replay ? " · REPLAY (saved progress unchanged)" : ""}` }), h("h2", { text: m.title })),
        h("div", { class: "row" }, h("div", { class: "steps", "aria-label": `Step ${ms.step + 1} of ${m.steps.length}` }, ...m.steps.map((_, i) => h("i", { class: i < ms.step ? "done" : i === ms.step ? "cur" : "" }))),
          h("span", { class: "chip info", text: `${ms.points || 0} pts` })));
      const body = h("div", { class: "stack" });
      container.replaceChildren(head, body);

      const ctx = {
        mission: m, step, ms,
        check(answer, correct) {
          ms.tries[step.id] = (ms.tries[step.id] || 0) + 1;
          ms.answers[step.id] = { ...answer, correct, at: new Date().toISOString() };
          if (correct) ms.points = (ms.points || 0) + DWM.missions.pointsFor(ms.tries[step.id]);
          save(true);
        },
        done() {
          if (ms.step >= m.steps.length - 1) return finish();
          ms.step++; save(true); draw(); focusMain();
        },
      };

      if (m.station) return drawStation(body, step, ctx);
      body.append(DWM.missions.renderStep(ctx));
    }

    function drawStation(body, step, ctx) {
      const scored = m.steps.filter((s) => s.title);
      const checklist = h("ol", { class: "checklist", "aria-label": "Station review sequence" }, ...scored.map((s) => {
        const i = m.steps.indexOf(s);
        return h("li", { class: i < ms.step ? "done" : i === ms.step ? "cur" : "", text: `${scored.indexOf(s) + 1}. ${s.title}` });
      }));
      if (step.type === "walk" && !ms.arrived) {
        body.append(dialogue(step.speaker, step.say));
        const scene = h("div");
        body.append(scene);
        walker = DWM.station.mountWalk(scene, () => { ms.arrived = true; save(true); draw(); });
        return;
      }
      if (step.type === "walk") {
        body.append(dialogue(step.arrive.speaker, step.arrive.say), h("div", { class: "row" }, h("button", { class: "btn primary", onclick: () => ctx.done() }, "Open the board →")));
        return;
      }
      const req = step.requires || [];
      const qArea = h("div", { class: "stack" });
      const brd = DWM.station.board(m, ms.seen, req, (k) => {
        if (!ms.seen.includes(k)) { ms.seen.push(k); save(true); }
        drawQuestion();
      });
      function drawQuestion() {
        const missing = req.filter((k) => !ms.seen.includes(k));
        if (missing.length) {
          qArea.replaceChildren(dialogue(step.speaker, `Open board section${missing.length > 1 ? "s" : ""} ${missing.join(" and ")} (highlighted) to review it.`));
          return;
        }
        if (!qArea.dataset.ready) { qArea.dataset.ready = "1"; qArea.replaceChildren(DWM.missions.renderStep(ctx)); }
      }
      body.append(brd.el, h("div", { class: "station-grid" },
        h("div", { class: "panel flat" }, h("div", { class: "label", text: "Review sequence" }), checklist), h("div", { class: "panel" }, qArea)));
      drawQuestion();
      // Opening the most relevant section first keeps the board in context on small screens.
      if (req.length && req.every((k) => ms.seen.includes(k))) brd.open(req[req.length - 1]);
    }

    function finish() {
      if (!replay) {
        real.status = "completed"; real.completedAt = real.completedAt || new Date().toISOString(); real.step = m.steps.length - 1;
        app.profile.missionLog = app.profile.missionLog || [];
        if (!app.profile.missionLog.some((x) => x.mission === m.id)) app.profile.missionLog.push({ mission: m.id, completedAt: real.completedAt, points: real.points });
        L.unlockMissions(app.state);
        const nx = DWM.MISSIONS[m.n];
        app.state.checkpoint = nx ? { screen: "mission", mission: nx.id, step: 0, label: `Mission ${nx.n}: ${nx.title}` } : { screen: "assessment", label: "Certification assessment" };
        app.commit(true);
      }
      const next = DWM.MISSIONS[m.n];
      container.replaceChildren(h("div", { class: "panel stack" },
        h("div", { class: "label", text: replay ? "Replay complete" : `Mission ${m.n} complete` }), h("h2", { text: m.title }),
        h("p", { text: replay ? "Replay finished. Your saved progress and points are unchanged." : `You earned ${ms.points} points. Progress saved.` }),
        h("div", { class: "row" },
          next && !replay ? h("button", { class: "btn primary", onclick: () => go("mission", { id: next.id }) }, `Start Mission ${next.n} →`) : null,
          !next && !replay ? h("button", { class: "btn primary", onclick: () => go("assessment") }, "Go to the assessment →") : null,
          h("button", { class: "btn", onclick: () => go("hub") }, "Mission Hub"))));
      focusMain();
    }

    if (!replay) app.commit(true);
    draw();
  }

  function assessmentScreen(r) {
    const p = app.profile;
    if (!L.allMissionsDone(app.state)) { toast("Complete all six missions to unlock the assessment."); return go("hub"); }
    if (!app.state.assessment && (!L.attemptsAllowed(C.maxAttempts, p.assessmentAttempts || 0) || (p.attemptHistory || []).some((a) => a.passed))) return go("results");
    DWM.assessment.render(r, app);
  }
  function results(r, data) { DWM.assessment.renderResults(r, app, data); }
  function admin(r) { DWM.admin.render(r, app); }
  function errorScreen(r, msg) {
    r.append(h("div", { class: "panel stack", style: "max-width:600px" }, h("h2", { text: "Can't load your progress" }), h("p", { text: msg }), h("button", { class: "btn primary", onclick: () => boot() }, "Try again")));
  }

  // ---------------- boot ----------------
  async function boot() {
    root().replaceChildren(h("p", { class: "muted", text: "Loading DWM QUEST…" }));
    if (!document.querySelector(".topbar")) topbar();
    await Store.init();
    if (!document.querySelector(".mode-banner")) modeBanner();
    let prof;
    try { prof = await Store.loadProfile(); }
    catch { return go("error", "We couldn't reach the results store, so your saved progress isn't shown yet. Nothing has been lost. Check your connection and try again."); }
    if (prof) {
      app.profile = prof;
      app.state = L.migrateState(prof.state);
      // Reconcile an attempt that was saved before the profile update completed.
      if (app.state.assessment) {
        try {
          const mine = await Store.listMyAttempts();
          const hit = mine.find((a) => a.attemptId === app.state.assessment.attemptId && a.submittedAt);
          if (hit) DWM.assessment.applyAttempt(app, hit);
        } catch { /* keep in-progress attempt */ }
      }
      go("resume");
    } else go("welcome");
  }

  window.addEventListener("beforeunload", (e) => { if (Store.hasPending()) { e.preventDefault(); e.returnValue = ""; } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  DWM.app = app;
})();
