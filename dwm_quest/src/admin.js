// Owner dashboard. The real protection is server-side: the database rules make the participants
// collection readable only by the artifact owner. This screen is only shown to isOwner() viewers.
(function () {
  const DWM = window.DWM;
  const { h, fmtDate, fmtDur, toast } = DWM.ui;
  const L = DWM.logic;

  const status = (p) => (p.gameCompletedAt ? "Completed" : "In progress");
  const passState = (p) => (!p.assessmentAttempts ? "No attempt" : (p.attemptHistory || []).some((a) => a.passed) ? "Passed" : "Not passed");

  // Synthetic records for demo mode only. Fictional people, clearly labelled.
  function demoRecords() {
    const now = Date.now(), day = 864e5;
    const mk = (i, missions, attempts) => {
      const start = new Date(now - (10 - i) * day).toISOString();
      const hist = attempts.map((s, k) => ({ attemptId: `demo-att-${i}-${k}`, assessmentVersion: "DWM-A-2026.1", startedAt: start, submittedAt: new Date(now - (9 - i) * day + k * 3600e3).toISOString(), scorePct: s, correct: Math.round(s * 0.15), incorrect: 15 - Math.round(s * 0.15), passed: s >= 80, eligibleAtAttempt: s >= 80 && missions === 6, wrongAreas: s < 100 ? ["whywhy", "frequency"].slice(0, s < 80 ? 2 : 1) : [] }));
      const passed = hist.some((x) => x.passed);
      return { uid: "demo-" + i, demo: true, employeeId: `DEMO-${String(100 + i)}`, employeeName: `Demo Employee ${String(i).padStart(2, "0")}`, email: `demo.employee${i}@example.com`,
        gameStartAt: start, gameCompletedAt: missions === 6 && hist.length ? hist[hist.length - 1].submittedAt : null, currentMission: missions === 6 ? "Assessment" : `Mission ${missions + 1}`,
        progressPct: Math.round(((missions + (hist.length ? 1 : 0)) / 7) * 100), latestScorePct: hist.length ? hist[hist.length - 1].scorePct : null, assessmentAttempts: hist.length,
        assessmentStatus: !hist.length ? "Not started" : passed ? "Passed" : "Not yet passed", eligible: passed && missions === 6, lastActivityAt: new Date(now - i * 3600e3).toISOString(),
        totalTimeSec: 600 + i * 97, createdAt: start, updatedAt: start, attemptHistory: hist, recommended: [], missionLog: [] };
    };
    return [mk(1, 6, [93.3]), mk(2, 6, [73.3, 86.7]), mk(3, 4, []), mk(4, 6, [66.7]), mk(5, 2, []), mk(6, 6, [100])];
  }

  async function render(root, app) {
    const S = DWM.store.S;
    root.replaceChildren(h("p", { text: "Loading results…" }));
    let rows, demo = S.mode !== "central";
    if (!demo && !S.isOwner) {
      root.replaceChildren(h("div", { class: "panel stack" }, h("h2", { text: "Results dashboard" }), h("p", { text: "Only the owner of this game can view all results." }), h("button", { class: "btn", onclick: () => app.go("hub") }, "Back")));
      return;
    }
    try {
      rows = demo ? [...demoRecords(), ...(app.profile ? [{ uid: "local", ...app.profile }] : [])] : await DWM.store.listParticipants();
    } catch (e) {
      root.replaceChildren(h("div", { class: "panel stack" }, h("h2", { text: "Results dashboard" }), h("p", { class: "feedback bad", text: "The results could not be loaded. Check your connection and try again." }), h("button", { class: "btn", onclick: () => render(root, app) }, "Retry")));
      return;
    }
    if (!demo) DWM.store.logAudit("dashboard_view", `${rows.length} records`);

    const F = { q: "", from: "", to: "", status: "", pass: "", elig: "" };
    const kpi = (label, n, cls) => h("div", { class: "kpi" }, h("span", { class: "label", text: label }), h("b", { class: cls || "", text: String(n) }));
    const filtered = () => rows.filter((p) => {
      const q = F.q.trim().toLowerCase();
      if (q && ![p.employeeId, p.employeeName, p.email].some((v) => String(v || "").toLowerCase().includes(q))) return false;
      if (F.from && (!p.gameStartAt || p.gameStartAt.slice(0, 10) < F.from)) return false;
      if (F.to && (!p.gameStartAt || p.gameStartAt.slice(0, 10) > F.to)) return false;
      if (F.status && status(p) !== F.status) return false;
      if (F.pass && passState(p) !== F.pass) return false;
      if (F.elig && String(!!p.eligible) !== F.elig) return false;
      return true;
    });

    const kpis = h("div", { class: "kpis" });
    const tbody = h("tbody");
    const detail = h("div");
    const countEl = h("span", { class: "muted" });
    function drawKpis() {
      const started = rows.length, completed = rows.filter((p) => p.gameCompletedAt).length;
      kpis.replaceChildren(kpi("Started", started), kpi("In progress", started - completed), kpi("Completed", completed),
        kpi("Passed", rows.filter((p) => passState(p) === "Passed").length), kpi("Eligible", rows.filter((p) => p.eligible).length),
        kpi("Need retake", rows.filter((p) => passState(p) === "Not passed").length));
    }
    function drawTable() {
      const list = filtered();
      countEl.textContent = `${list.length} of ${rows.length} participants`;
      tbody.replaceChildren(...list.map((p) => h("tr", { tabindex: "0", onclick: () => showDetail(p), onkeydown: (e) => { if (e.key === "Enter") showDetail(p); } },
        h("td", { class: "mono", text: p.employeeId || "—" }), h("td", { text: p.employeeName || "—" }), h("td", { text: p.email || "—" }),
        h("td", { text: fmtDate(p.gameStartAt) }), h("td", { text: fmtDate(p.gameCompletedAt) }),
        h("td", { class: "num", text: p.latestScorePct == null ? "—" : p.latestScorePct + "%" }),
        h("td", null, h("span", { class: "chip " + (p.eligible ? "ok" : "bad"), text: p.eligible ? "Yes" : "No" })),
        h("td", { class: "num", text: (p.progressPct || 0) + "%" }))));
      if (!list.length) tbody.append(h("tr", null, h("td", { colspan: "8", class: "muted", text: rows.length ? "No participants match these filters." : "No participants yet. Records appear here as employees register." })));
    }
    async function showDetail(p) {
      const hist = p.attemptHistory || [];
      const ms = p.state && p.state.missions;
      detail.replaceChildren(h("div", { class: "panel stack" },
        h("div", { class: "row", style: "justify-content:space-between" }, h("h3", { text: `${p.employeeName} · ${p.employeeId}` }), h("button", { class: "btn small", onclick: () => detail.replaceChildren() }, "Close")),
        h("div", { class: "grid2" },
          h("div", null, h("div", { class: "label", text: "Profile" }), h("p", null, `Email: ${p.email}`), h("p", null, `Started: ${fmtDate(p.gameStartAt)}`), h("p", null, `Completed: ${fmtDate(p.gameCompletedAt)}`),
            h("p", null, `Last activity: ${fmtDate(p.lastActivityAt)}`), h("p", null, `Time spent: ${fmtDur(p.totalTimeSec)}`), h("p", null, `Current: ${p.currentMission} · progress ${p.progressPct || 0}%`),
            h("p", null, `Eligible for certification: ${p.eligible ? "Yes" : "No"}`)),
          h("div", null, h("div", { class: "label", text: "Mission history" }),
            ms ? h("ul", { style: "margin:4px 0;padding-left:18px" }, ...DWM.MISSIONS.map((m) => { const x = ms[m.id] || {}; return h("li", null, `M${m.n} ${m.title}: ${x.status || "locked"}${x.completedAt ? " · " + fmtDate(x.completedAt) : ""}${x.points ? " · " + x.points + " pts" : ""}`); }))
              : h("p", { class: "muted", text: "Synthetic demo record." }),
            h("div", { class: "label", text: "Recommended learning areas" }), h("p", { text: (p.recommended || []).join(", ") || "—" }))),
        h("div", { class: "label", text: "Assessment attempts" }),
        h("div", { class: "tablewrap" }, h("table", null, h("thead", null, h("tr", null, ...["#", "Attempt ID", "Version", "Submitted", "Score", "Correct", "Result", "Eligible at attempt"].map((x) => h("th", { text: x })))),
          h("tbody", null, ...(hist.length ? hist.map((a, i) => h("tr", null, h("td", { text: String(i + 1) }), h("td", { class: "mono", text: a.attemptId }), h("td", { text: a.assessmentVersion }), h("td", { text: fmtDate(a.submittedAt) }),
            h("td", { class: "num", text: a.scorePct + "%" }), h("td", { class: "num", text: `${a.correct}/${a.correct + a.incorrect}` }), h("td", { text: a.passed ? "Pass" : "Fail" }), h("td", { text: a.eligibleAtAttempt ? "Yes" : "No" })))
            : [h("tr", null, h("td", { colspan: "8", class: "muted", text: "No attempts yet." }))]))))));
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function exportCSV(kind, list) {
      let csv, name;
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === "summary") {
        csv = L.toCSV(["Employee ID", "Employee Name", "Email ID", "Game Start (UTC)", "Game Completion (UTC)", "Current Mission", "Progress %", "Latest Score %", "Assessment Attempts", "Assessment Status", "Eligible for Certification", "Last Activity (UTC)", "Total Time (min)", "Record Created (UTC)", "Record Updated (UTC)"],
          list.map((p) => [p.employeeId, p.employeeName, p.email, p.gameStartAt, p.gameCompletedAt || "", p.currentMission, p.progressPct, p.latestScorePct ?? "", p.assessmentAttempts || 0, p.assessmentStatus, p.eligible ? "Yes" : "No", p.lastActivityAt, Math.round((p.totalTimeSec || 0) / 60), p.createdAt, p.updatedAt]));
        name = `dwm-quest-results-${stamp}.csv`;
      } else {
        const out = [];
        list.forEach((p) => (p.attemptHistory || []).forEach((a, i) => out.push([a.attemptId, p.employeeId, p.employeeName, p.email, i + 1, a.assessmentVersion, a.startedAt, a.submittedAt, a.scorePct, a.correct, a.incorrect, a.passed ? "Pass" : "Fail", a.eligibleAtAttempt ? "Yes" : "No", (a.wrongAreas || []).map((w) => DWM.LEARNING_AREAS[w] ? DWM.LEARNING_AREAS[w].label : w).join("; ")])));
        csv = L.toCSV(["Attempt ID", "Employee ID", "Employee Name", "Email ID", "Attempt #", "Assessment Version", "Started (UTC)", "Submitted (UTC)", "Score %", "Correct", "Incorrect", "Result", "Eligible at Attempt", "Areas to review"], out);
        name = `dwm-quest-attempts-${stamp}.csv`;
      }
      if (demo) name = name.replace("dwm-quest", "DEMO-dwm-quest");
      const dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
      if (dl) {
        try { await dl.save({ filename: name, data: csv }); if (!demo) DWM.store.logAudit("export_" + kind, `${list.length} participants`); toast("Export saved."); return; }
        catch (e) { if (e && e.code === "declined") { toast("Export cancelled."); return; } }
      }
      // Fallback for copies running outside claude.ai.
      try {
        const a = h("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: name });
        document.body.append(a); a.click(); a.remove();
        toast("Export started.");
      } catch { toast("Download is not available in this view."); }
    }

    const field = (label, ctl) => h("div", { class: "field" }, h("label", { class: "label", for: ctl.id, text: label }), ctl);
    const inp = (id, type, key, ph) => h("input", { id, type, placeholder: ph || "", oninput: (e) => { F[key] = e.target.value; drawTable(); } });
    const sel = (id, key, opts) => h("select", { id, onchange: (e) => { F[key] = e.target.value; drawTable(); } }, ...opts.map(([v, t]) => h("option", { value: v }, t)));

    drawKpis();
    root.replaceChildren(h("div", { class: "stack" },
      h("div", { class: "mission-head" }, h("div", null, h("div", { class: "label", text: "Owner only" }), h("h2", { text: "Results dashboard" })),
        h("div", { class: "row" }, h("button", { class: "btn", onclick: () => render(root, app) }, "Refresh"), h("button", { class: "btn", onclick: () => app.go("hub") }, "Back to game"))),
      demo ? h("p", { class: "feedback note", text: "DEMO DATA: these are synthetic records plus this browser's own test record. No real employee data is shown or stored in demo mode." }) : null,
      kpis,
      h("div", { class: "panel stack" },
        h("div", { class: "filters" },
          field("ID, name or email", inp("f-q", "search", "q", "Search…")),
          field("Started from", inp("f-from", "date", "from")), field("Started to", inp("f-to", "date", "to")),
          field("Progress", sel("f-status", "status", [["", "All"], ["In progress", "In progress"], ["Completed", "Completed"]])),
          field("Assessment", sel("f-pass", "pass", [["", "All"], ["Passed", "Passed"], ["Not passed", "Not passed"], ["No attempt", "No attempt"]])),
          field("Eligibility", sel("f-elig", "elig", [["", "All"], ["true", "Eligible"], ["false", "Not eligible"]]))),
        h("div", { class: "row", style: "justify-content:space-between" }, countEl,
          h("div", { class: "row" },
            h("button", { class: "btn small", onclick: () => exportCSV("summary", rows) }, "Export all results (CSV)"),
            h("button", { class: "btn small", onclick: () => exportCSV("summary", filtered()) }, "Export filtered (CSV)"),
            h("button", { class: "btn small", onclick: () => exportCSV("attempts", rows) }, "Export all attempts (CSV)"))),
        h("div", { class: "tablewrap" }, h("table", { class: "results" },
          h("thead", null, h("tr", null, ...["Employee ID", "Employee Name", "Email ID", "Start Date", "Completion Date", "Score %", "Eligibility", "Progress"].map((x) => h("th", { class: /Score|Progress/.test(x) ? "num" : "", text: x })))), tbody))),
      detail,
      h("p", { class: "muted", style: "font-size:.82rem", text: "Times shown in your local time zone; CSV exports use UTC (ISO 8601). Select a row for the employee's mission history and every assessment attempt." })));
    drawTable();
  }

  DWM.admin = { render };
})();
