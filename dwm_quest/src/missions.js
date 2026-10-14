// Mission engine: renders each step type, records decisions and drives progress through a mission.
(function () {
  const DWM = window.DWM;
  const { h, dialogue } = DWM.ui;
  const L = DWM.logic;

  function seeded(seedStr) {
    let s = parseInt(L.hash(seedStr).slice(0, 8), 36) || 1;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }
  const pointsFor = (tries) => (tries <= 1 ? 10 : tries === 2 ? 6 : 3);
  const fb = (kind, title, text) => h("div", { class: "feedback " + kind, role: "status" }, title ? h("b", { text: title }) : null, text ? h("span", { html: text }) : null);

  // ctx: { mission, step, ms (mission state), check(answer, correct) -> tries, done(), readOnly }
  const R = {};

  R.dialog = (ctx) => {
    const { step } = ctx;
    return h("div", { class: "stack" },
      step.panel ? h("div", { html: step.panel }) : null,
      dialogue(step.speaker, step.say),
      h("div", { class: "row" }, h("button", { class: "btn primary", onclick: () => ctx.done() }, "Continue →")));
  };

  R.choice = (ctx) => {
    const { step } = ctx;
    const rnd = seeded(ctx.mission.id + step.id);
    const opts = L.shuffle(step.options.map((o, i) => ({ ...o, i })), rnd);
    let chosen = null, solved = false;
    const out = h("div", { class: "fbslot" });
    const list = h("div", { class: "options", role: "radiogroup", "aria-label": step.prompt });
    const checkBtn = h("button", { class: "btn primary", disabled: true }, "Check answer");
    const btns = opts.map((o, k) => {
      const b = h("button", { class: "opt", role: "radio", "aria-checked": "false", onclick: () => {
        if (solved) return; chosen = o; btns.forEach((x) => { x.setAttribute("aria-checked", "false"); x.classList.remove("wrong"); }); b.setAttribute("aria-checked", "true"); checkBtn.disabled = false; } },
        h("span", { class: "key", text: String.fromCharCode(65 + k) }), h("span", { text: o.t }));
      list.append(b); return b;
    });
    checkBtn.onclick = () => {
      if (!chosen || solved) return;
      const ok = !!chosen.ok;
      ctx.check({ choice: chosen.i }, ok);
      const b = btns[opts.indexOf(chosen)];
      out.replaceChildren();
      if (ok) {
        solved = true; b.classList.add("correct"); checkBtn.remove();
        out.append(fb("ok", "Correct", chosen.fb), step.learn ? fb("note", "Key point", step.learn) : null,
          h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn primary", onclick: () => ctx.done() }, "Continue →")));
      } else {
        b.classList.add("wrong");
        out.append(fb("bad", "Not the best choice", chosen.fb + " Try again."));
      }
      out.querySelector("button, .feedback")?.focus?.();
    };
    return h("div", { class: "stack" }, step.panel ? h("div", { html: step.panel }) : null,
      step.speaker && step.say ? dialogue(step.speaker, step.say) : null,
      h("p", { class: "prompt", text: step.prompt }), list, h("div", { class: "row" }, checkBtn), out);
  };

  R.multi = (ctx) => {
    const { step } = ctx;
    const rnd = seeded(ctx.mission.id + step.id);
    const opts = L.shuffle(step.options.map((o, i) => ({ ...o, i })), rnd);
    const sel = new Set();
    let solved = false;
    const out = h("div");
    const list = h("div", { class: "options", role: "group", "aria-label": step.prompt });
    const btns = opts.map((o) => {
      const b = h("button", { class: "opt", role: "checkbox", "aria-checked": "false", onclick: () => {
        if (solved) return; sel.has(o.i) ? sel.delete(o.i) : sel.add(o.i); b.setAttribute("aria-checked", String(sel.has(o.i))); b.classList.remove("wrong", "correct"); } },
        h("span", { class: "key", "aria-hidden": "true", text: "☐" }), h("span", { text: o.t }));
      list.append(b); return b;
    });
    const checkBtn = h("button", { class: "btn primary", onclick: () => {
      if (solved) return;
      const wrongPicked = opts.filter((o) => sel.has(o.i) && !o.ok);
      const missed = opts.filter((o) => !sel.has(o.i) && o.ok);
      const ok = !wrongPicked.length && !missed.length;
      ctx.check({ selected: [...sel].sort() }, ok);
      out.replaceChildren();
      btns.forEach((b, k) => { b.classList.remove("wrong", "correct"); if (sel.has(opts[k].i)) b.classList.add(opts[k].ok ? "correct" : "wrong"); });
      if (ok) {
        solved = true; checkBtn.remove();
        out.append(fb("ok", "All correct", "<ul>" + opts.map((o) => `<li>${o.ok ? "✔" : "✘"} ${o.t}: ${o.fb}</li>`).join("") + "</ul>"),
          step.learn ? fb("note", "Key point", step.learn) : null,
          h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn primary", onclick: () => ctx.done() }, "Continue →")));
      } else {
        out.append(fb("bad", "Not yet", (wrongPicked.length ? "<ul>" + wrongPicked.map((o) => `<li>✘ ${o.t}: ${o.fb}</li>`).join("") + "</ul>" : "") +
          (missed.length ? `You have missed ${missed.length} appropriate step${missed.length > 1 ? "s" : ""}. ` : "") + "Adjust your selection and check again."));
      }
    } }, "Check answer");
    return h("div", { class: "stack" }, step.panel ? h("div", { html: step.panel }) : null,
      h("p", { class: "prompt", text: step.prompt }), list, h("div", { class: "row" }, checkBtn), out);
  };

  R.classify = (ctx) => {
    const { step } = ctx;
    const vals = {};
    let solved = false;
    const out = h("div");
    const rows = step.items.map((it, idx) => {
      const cats = it.options || step.categories;
      const seg = h("div", { class: "seg", role: "radiogroup", "aria-label": it.t.replace(/<[^>]+>/g, "") });
      const row = h("div", { class: "citem" }, h("div", { html: it.t }), seg);
      const order = it.options ? L.shuffle(cats, seeded(ctx.mission.id + step.id + idx)) : cats;
      const bs = order.map((c) => h("button", { "aria-pressed": "false", role: "radio", onclick: () => {
        if (solved) return; vals[idx] = c; bs.forEach((x) => x.setAttribute("aria-pressed", String(x.textContent === c))); row.classList.remove("wrong", "correct"); } }, c));
      seg.append(...bs);
      return row;
    });
    const checkBtn = h("button", { class: "btn primary", onclick: () => {
      if (solved) return;
      if (Object.keys(vals).length < step.items.length) { out.replaceChildren(fb("note", null, "Choose an answer for every row first.")); return; }
      let wrong = 0;
      step.items.forEach((it, i) => { const ok = vals[i] === it.a; rows[i].classList.toggle("correct", ok); rows[i].classList.toggle("wrong", !ok); if (!ok) wrong++; });
      const ok = !wrong;
      ctx.check({ values: step.items.map((_, i) => vals[i]) }, ok);
      out.replaceChildren();
      if (ok) {
        solved = true; checkBtn.remove();
        out.append(fb("ok", "Correct", step.fbRight || ""), step.learn ? fb("note", "Key point", step.learn) : null,
          h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn primary", onclick: () => ctx.done() }, "Continue →")));
      } else out.append(fb("bad", `${wrong} row${wrong > 1 ? "s are" : " is"} not right yet (marked in red)`, (step.fbWrong || "") + " Change them and check again."));
    } }, "Check answer");
    return h("div", { class: "stack" }, step.panel ? h("div", { html: step.panel }) : null,
      h("p", { class: "prompt", text: step.prompt }), h("div", { class: "classify" }, rows), h("div", { class: "row" }, checkBtn), out);
  };

  R.sequence = (ctx) => {
    const { step } = ctx;
    const pool = L.shuffle(step.items, seeded(ctx.mission.id + step.id));
    const order = [];
    let solved = false;
    const out = h("div");
    const poolEl = h("div", { class: "pool" });
    const ordEl = h("ol");
    const checkBtn = h("button", { class: "btn primary", disabled: true }, "Check order");
    function draw() {
      poolEl.replaceChildren(...pool.filter((x) => !order.includes(x)).map((x) =>
        h("button", { class: "opt", onclick: () => { if (solved) return; order.push(x); draw(); } }, h("span", { class: "key", text: "+" }), h("span", { text: x }))));
      if (!poolEl.children.length) poolEl.append(h("div", { class: "slot-empty", text: "All cards placed. Check the order, or remove a card to change it." }));
      ordEl.replaceChildren(...order.map((x, i) => h("li", null, h("span", { text: x }),
        solved ? null : h("button", { class: "btn small ghost", "aria-label": "Remove " + x, onclick: () => { order.splice(i, 1); draw(); } }, "✕"))));
      for (let i = order.length; i < step.items.length; i++) ordEl.append(h("li", null, h("span", { class: "muted", text: "Choose the next card…" })));
      checkBtn.disabled = order.length !== step.items.length;
    }
    checkBtn.onclick = () => {
      const ok = order.every((x, i) => x === step.items[i]);
      ctx.check({ order: order.slice() }, ok);
      [...ordEl.children].forEach((li, i) => { li.classList.toggle("correct", order[i] === step.items[i]); li.classList.toggle("wrong", order[i] !== step.items[i]); });
      out.replaceChildren();
      if (ok) {
        solved = true; checkBtn.remove(); draw(); [...ordEl.children].forEach((li) => li.classList.add("correct"));
        out.append(fb("ok", "Correct order", ""), step.learn ? fb("note", "Key point", step.learn) : null,
          h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn primary", onclick: () => ctx.done() }, "Continue →")));
      } else {
        const right = order.filter((x, i) => x === step.items[i]).length;
        out.append(fb("bad", `${right} of ${step.items.length} in the right position (green)`, (step.fbWrong || "") + " Remove the red cards and try again."));
      }
    };
    draw();
    return h("div", { class: "stack" }, h("p", { class: "prompt", text: step.prompt }),
      h("div", { class: "seq" }, h("div", null, h("div", { class: "label", text: "Cards" }), poolEl), h("div", null, h("div", { class: "label", text: "Your order" }), ordEl)),
      h("div", { class: "row" }, checkBtn, h("button", { class: "btn ghost", onclick: () => { if (!solved) { order.length = 0; draw(); out.replaceChildren(); } } }, "Reset")), out);
  };

  // Why-Why: choose the cause AND the evidence that supports it.
  R.why = (ctx) => {
    const { step, mission, ms } = ctx;
    const ev = mission.evidence;
    const chain = mission.steps.filter((s) => s.type === "why" && s.level < step.level).map((s) => {
      const a = ms.answers[s.id]; const o = a && s.options[a.choice];
      return { level: s.level, t: o ? o.t : "?", ev: a && a.ev };
    });
    const rnd = seeded(mission.id + step.id);
    const opts = L.shuffle(step.options.map((o, i) => ({ ...o, i })), rnd);
    let chosen = null, solved = false;
    const out = h("div");
    const evSel = h("select", { id: "ev-" + step.id, "aria-label": "Supporting evidence" },
      h("option", { value: "" }, "Select the supporting evidence…"), ...Object.entries(ev).map(([k, v]) => h("option", { value: k }, `${k} · ${v.t}`)), h("option", { value: "none" }, "No evidence supports it"));
    const btns = opts.map((o) => {
      const b = h("button", { class: "opt", role: "radio", "aria-checked": "false", onclick: () => { if (solved) return; chosen = o; btns.forEach((x) => { x.setAttribute("aria-checked", "false"); x.classList.remove("wrong"); }); b.setAttribute("aria-checked", "true"); } },
        h("span", { class: "key", text: "→" }), h("span", { text: o.t }));
      return b;
    });
    const checkBtn = h("button", { class: "btn primary", onclick: () => {
      if (solved) return;
      if (!chosen || !evSel.value) { out.replaceChildren(fb("note", null, "Pick a cause and the evidence that supports it.")); return; }
      const evOk = chosen.ok ? [].concat(chosen.ev).includes(evSel.value) : false;
      const ok = !!chosen.ok && evOk;
      ctx.check({ choice: chosen.i, ev: evSel.value }, ok);
      out.replaceChildren();
      const b = btns[opts.indexOf(chosen)];
      if (ok) {
        solved = true; b.classList.add("correct"); checkBtn.remove(); evSel.disabled = true;
        out.append(fb("ok", "Supported by evidence", chosen.fb), h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn primary", onclick: () => ctx.done() }, "Add to the chain →")));
      } else if (chosen.ok) {
        out.append(fb("bad", "Right cause, wrong evidence", `${evSel.value === "none" ? "This cause is supported by a record." : evSel.value + " doesn't show this directly."} Which record proves it?`));
      } else { b.classList.add("wrong"); out.append(fb("bad", "Not supported", chosen.fb)); }
    } }, "Check");
    return h("div", { class: "grid2" },
      h("div", { class: "stack" },
        h("div", { class: "panel flat" }, h("div", { class: "label", text: "Why-Why chain so far" }),
          h("ol", { style: "margin:6px 0 0;padding-left:20px" },
            h("li", null, h("b", { text: "Problem: " }), "CP-04 stops repeatedly (14 stops in 5 shifts)"),
            ...chain.map((c) => h("li", null, `${c.t} `, h("span", { class: "chip info", text: c.ev }))),
            h("li", null, h("span", { class: "muted", text: "Why? …" })))),
        h("p", { class: "prompt", text: step.prompt }), h("div", { class: "options" }, btns),
        h("div", { class: "field" }, h("label", { class: "label", for: "ev-" + step.id, text: "Evidence" }), evSel),
        h("div", { class: "row" }, checkBtn), out),
      h("div", { class: "panel flat stack" }, h("div", { class: "row" }, h("b", { text: "Evidence file" }), DWM.ui.h("span", { html: DWM.SIM })),
        ...Object.entries(ev).map(([k, v]) => h("div", null, h("div", { class: "label", text: `${k} · ${v.t}` }), h("p", { style: "font-size:.9rem", text: v.d })))));
  };

  // Mission 3 summary assembled from the player's own decisions.
  R.summary = (ctx) => {
    const { step, ms, mission } = ctx;
    const rec = ms.answers.record && ms.answers.record.values;
    const recStep = mission.steps.find((s) => s.id === "record");
    const nextStep = mission.steps.find((s) => s.id === "next");
    const nextSel = (ms.answers.next && ms.answers.next.selected) || [];
    const vals = {};
    let solved = false;
    const out = h("div");
    const lines = [
      ["Target vs actual", "12:00 checkpoint: 570 tyres vs expected 750 (plan 1,000/shift): −180, −24%, gap widening."],
      ["Abnormality", rec ? recStep.items.map((it, i) => `${it.t.replace(/<[^>]+>/g, "")}: ${rec[i]}`).join(" · ") : "CP-04 repeated low steam-pressure stops"],
      ["Immediate action", nextSel.length ? nextSel.map((i) => nextStep.options[i].t).join(" ") : "—"],
      ["Owner / due date", "A-117 overdue: Maintenance Lead to report status and agree a new date at this review; escalated per ESC-MAT-01. Quality Engineer owns release of the 48 held tyres."],
    ];
    const selects = Object.entries(step.fields).map(([k, f]) => {
      const s = h("select", { id: "sum-" + k, onchange: () => { vals[k] = Number(s.value); } }, h("option", { value: "" }, "Choose…"), ...f.options.map((o, i) => h("option", { value: i }, o)));
      return h("div", { class: "field" }, h("label", { class: "label", for: "sum-" + k, text: f.label }), s);
    });
    const checkBtn = h("button", { class: "btn primary", onclick: () => {
      if (solved) return;
      const entries = Object.entries(step.fields);
      if (entries.some(([k]) => vals[k] == null || isNaN(vals[k]))) { out.replaceChildren(fb("note", null, "Complete both fields.")); return; }
      const ok = entries.every(([k, f]) => vals[k] === f.a);
      ctx.check({ fields: { ...vals } }, ok);
      out.replaceChildren();
      if (ok) {
        solved = true; checkBtn.remove();
        out.append(fb("ok", "Review summary recorded", "Next review at the 14:00 checkpoint, and at every checkpoint until CP-04 is stable. RCA requested: Kabir will lead the Why-Why with Maintenance."),
          h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn primary", onclick: () => ctx.done() }, "Continue →")));
      } else out.append(fb("bad", "Check again", "A repeating, live problem needs review at every checkpoint, and recurrence across shifts after resets is the signal for RCA."));
    } }, "Confirm summary");
    return h("div", { class: "stack" }, h("p", { class: "prompt", text: step.prompt }),
      h("div", { class: "tablewrap" }, h("table", null, h("tbody", null, ...lines.map(([a, b]) => h("tr", null, h("th", { scope: "row", text: a }), h("td", { text: b })))))),
      h("div", { class: "grid2" }, selects), h("div", { class: "row" }, checkBtn), out);
  };

  function renderStep(ctx) {
    const f = R[ctx.step.type];
    if (!f) return h("p", { text: "Unknown step type " + ctx.step.type });
    return f(ctx);
  }

  DWM.missions = { renderStep, pointsFor };
})();
