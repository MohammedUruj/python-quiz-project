// Final certification assessment: 15 questions, attempt records, scoring and eligibility.
(function () {
  const DWM = window.DWM;
  const { h, confirmBox, toast } = DWM.ui;
  const L = DWM.logic;
  const C = DWM.CONFIG;

  const bank = () => DWM.QUESTION_BANK;
  const qById = (id) => bank().questions.find((q) => q.id === id);

  function newAttempt() {
    const qs = bank().questions.slice(0, C.questionCount);
    return {
      attemptId: L.newId("att"),
      assessmentVersion: bank().version,
      startedAt: new Date().toISOString(),
      questions: qs.map((q) => ({ id: q.id, opts: C.shuffleOptions ? L.shuffle(q.options.map((o) => o.id)) : q.options.map((o) => o.id) })),
      answers: {},
      cur: 0,
    };
  }

  // app: { profile, state, commit(meaningful), go(screen, arg) }
  function render(root, app) {
    const st = app.state;
    if (!st.assessment) { st.assessment = newAttempt(); app.commit(true); }
    const A = st.assessment;
    st.checkpoint = { screen: "assessment", label: "Certification assessment" };
    const total = A.questions.length;
    const wrap = h("div", { class: "stack" });
    root.replaceChildren(wrap);
    let submitting = false;

    function draw() {
      const item = A.questions[A.cur];
      const q = qById(item.id);
      const answered = Object.keys(A.answers).length;
      const nav = h("div", { class: "qnav", role: "navigation", "aria-label": "Questions" }, ...A.questions.map((x, i) =>
        h("button", { class: (A.answers[x.id] ? "answered " : "") + (i === A.cur ? "cur" : ""), "aria-label": `Question ${i + 1}${A.answers[x.id] ? ", answered" : ""}`, onclick: () => { A.cur = i; draw(); } }, String(i + 1))));
      const opts = h("div", { class: "options", role: "radiogroup", "aria-labelledby": "qtext" }, ...item.opts.map((oid, k) => {
        const o = q.options.find((x) => x.id === oid);
        return h("button", { class: "opt", role: "radio", "aria-checked": String(A.answers[q.id] === oid), onclick: () => {
          A.answers[q.id] = oid; app.commit(true); draw();
        } }, h("span", { class: "key", text: String.fromCharCode(65 + k) }), h("span", { text: o.t }));
      }));
      wrap.replaceChildren(
        h("div", { class: "mission-head" }, h("div", null, h("div", { class: "label", text: `Certification assessment · ${A.assessmentVersion}` }), h("h2", { text: `Question ${A.cur + 1} of ${total}` })),
          h("span", { class: "chip info", text: `${answered}/${total} answered` })),
        h("div", { class: "progress", "aria-hidden": "true" }, h("i", { style: `width:${(answered / total) * 100}%` })),
        nav,
        h("div", { class: "panel stack" }, q.scenario ? h("span", { class: "chip warn", style: "align-self:flex-start", text: "Scenario" }) : null,
          h("p", { class: "prompt", id: "qtext", text: q.text }), opts),
        h("div", { class: "row", style: "justify-content:space-between" },
          h("div", { class: "row" },
            h("button", { class: "btn", disabled: A.cur === 0, onclick: () => { A.cur--; draw(); } }, "← Previous"),
            h("button", { class: "btn", disabled: A.cur === total - 1, onclick: () => { A.cur++; draw(); } }, "Next →")),
          h("div", { class: "row" },
            h("button", { class: "btn ghost", onclick: () => app.go("hub") }, "Save and exit"),
            h("button", { class: "btn primary", onclick: submit }, "Review and submit"))),
        h("p", { class: "muted", style: "font-size:.85rem", text: `Pass mark ${C.passPercent}% (${Math.ceil((C.passPercent / 100) * total)} of ${total}). Your answers are saved as you go; you can leave and resume this attempt.` }));
    }

    async function submit() {
      if (submitting) return;
      const answered = Object.keys(A.answers).length;
      const ok = await confirmBox({ title: "Submit your assessment?", ok: "Submit",
        body: answered < total ? `You have answered ${answered} of ${total}. Unanswered questions are marked incorrect.` : `All ${total} questions answered. You can't change answers after submitting.` });
      if (!ok || submitting) return;
      submitting = true;
      wrap.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        const result = await finalise(app, A);
        app.go("results", result);
      } catch (e) {
        submitting = false;
        wrap.querySelectorAll("button").forEach((b) => (b.disabled = false));
        toast("Submission was not saved. Check your connection and select Review and submit again.");
      }
    }
    draw();
  }

  // Score, write the attempt record (idempotent by attemptId), then update the participant record.
  async function finalise(app, A) {
    const qs = A.questions.map((x) => qById(x.id));
    const r = L.scoreAttempt(qs, A.answers, bank().salt);
    const missionsDone = L.allMissionsDone(app.state);
    const el = L.eligibility({ scorePct: r.scorePct, passPercent: C.passPercent, missionsDone, requireAllMissions: C.requireAllMissions });
    const p = app.profile;
    const attempt = {
      attemptId: A.attemptId, employeeId: p.employeeId, employeeName: p.employeeName, email: p.email,
      assessmentVersion: A.assessmentVersion, startedAt: A.startedAt, submittedAt: new Date().toISOString(),
      scorePct: r.scorePct, correct: r.correct, incorrect: r.incorrect, total: r.total,
      passed: el.passed, eligibleAtAttempt: el.eligible, wrongAreas: r.wrongAreas, answers: { ...A.answers },
    };
    const saved = await DWM.store.saveAttempt(attempt);
    applyAttempt(app, saved.attempt);
    return { attempt: saved.attempt, perQuestion: r.perQuestion };
  }

  // Also used on load to reconcile an attempt that was written before the profile update was saved.
  function applyAttempt(app, att) {
    const p = app.profile;
    p.attemptHistory = p.attemptHistory || [];
    if (!p.attemptHistory.some((x) => x.attemptId === att.attemptId)) {
      p.attemptHistory.push({ attemptId: att.attemptId, assessmentVersion: att.assessmentVersion, startedAt: att.startedAt, submittedAt: att.submittedAt,
        scorePct: att.scorePct, correct: att.correct, incorrect: att.incorrect, passed: att.passed, eligibleAtAttempt: att.eligibleAtAttempt, wrongAreas: att.wrongAreas });
    }
    p.assessmentAttempts = p.attemptHistory.length;
    p.latestScorePct = att.scorePct;
    const anyPass = p.attemptHistory.some((x) => x.passed);
    p.assessmentStatus = att.passed ? "Passed" : anyPass ? "Passed (earlier attempt)" : "Not yet passed";
    const el = L.eligibility({ scorePct: Math.max(...p.attemptHistory.map((x) => x.scorePct)), passPercent: C.passPercent, missionsDone: L.allMissionsDone(app.state), requireAllMissions: C.requireAllMissions });
    p.eligible = el.eligible;
    p.recommended = att.wrongAreas.map((a) => DWM.LEARNING_AREAS[a].label);
    if (app.state.assessment && app.state.assessment.attemptId === att.attemptId) app.state.assessment = null;
    app.state.lastResultId = att.attemptId;
    app.state.checkpoint = { screen: "results", label: "Assessment results" };
    app.commit(true);
  }

  function renderResults(root, app, data) {
    const p = app.profile;
    const att = data && data.attempt ? data.attempt : (p.attemptHistory || []).slice(-1)[0];
    if (!att) { app.go("hub"); return; }
    const per = data && data.perQuestion;
    const passed = att.passed, eligible = p.eligible;
    const areas = (att.wrongAreas || []).map((a) => DWM.LEARNING_AREAS[a]);
    const used = p.assessmentAttempts || 0;
    const canRetake = L.attemptsAllowed(C.maxAttempts, used);
    root.replaceChildren(h("div", { class: "stack" },
      h("div", null, h("div", { class: "label", text: "Assessment results" }), h("h2", { text: passed ? "Assessment passed" : "Assessment not passed" })),
      h("div", { class: "panel scoreband" },
        h("div", null, h("div", { class: "bignum mono", text: `${att.scorePct}%` }), h("div", { class: "muted", text: `${att.correct} correct · ${att.incorrect} incorrect · of ${att.total}` })),
        h("div", { class: "stack", style: "gap:6px;flex:1;min-width:240px" },
          h("span", { class: "chip " + (passed ? "ok" : "bad"), style: "align-self:flex-start", text: passed ? `Pass (≥ ${C.passPercent}%)` : `Below ${C.passPercent}%` }),
          h("div", { class: "verdict", text: eligible ? "Eligible for Certification" : "Not Yet Eligible" }),
          h("p", { text: eligible ? "You have met the configured learning assessment criteria." : "Review the recommended learning areas and attempt the assessment again according to the assessment policy." }),
          h("p", { class: "muted", style: "font-size:.85rem", text: "This is a record of learning eligibility only. No official certificate is issued by this game." }))),
      areas.length ? h("div", { class: "panel stack" }, h("h3", { text: "Recommended learning areas" }),
        h("ul", { style: "margin:0;padding-left:20px" }, ...areas.map((a) => h("li", null, `${a.label}: `, h("button", { class: "btn small ghost", onclick: () => app.go("mission", { id: a.mission, replay: true }) }, `Replay Mission ${a.mission.slice(1)}`))))) : null,
      per ? h("div", { class: "panel stack" }, h("h3", { text: "Question feedback" }),
        ...per.map((x, i) => { const q = qById(x.id); return h("div", { class: "feedback " + (x.correct ? "ok" : "bad") }, h("b", { text: `${i + 1}. ${x.correct ? "Correct" : "Incorrect"}: ${DWM.LEARNING_AREAS[q.area].label}` }), h("span", { text: q.explain })); })) : null,
      h("div", { class: "row" },
        h("button", { class: "btn primary", onclick: () => app.go("hub") }, "Back to Mission Hub"),
        !passed && canRetake && L.allMissionsDone(app.state) ? h("button", { class: "btn", onclick: () => app.go("assessment") }, `Retake assessment (${C.maxAttempts ? `${C.maxAttempts - used} left` : "unlimited"})`) : null),
      !passed && !canRetake ? h("p", { class: "feedback note", text: `You have used all ${C.maxAttempts} attempts. Contact the TQM cell (${C.ownerContactEmail}) about next steps.` }) : null));
  }

  DWM.assessment = { render, renderResults, applyAttempt };
})();
