// Small DOM helpers, character portraits, dialogue, toasts and confirmation dialogs.
(function () {
  const DWM = window.DWM;

  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  }

  // Simple, professional bust portraits drawn as SVG (no external art).
  function portrait(key) {
    const c = DWM.CHARACTERS[key];
    const hat = c.hat ? `<path d="M18 30 Q32 12 46 30 Z" fill="${c.hat}"/><rect x="15" y="28" width="34" height="4" rx="2" fill="${c.hat}"/>` :
      `<path d="M19 31 Q20 15 32 15 Q45 15 45 31 Q42 22 32 22 Q23 22 19 31Z" fill="${c.hair}"/>`;
    return `<svg viewBox="0 0 64 64" role="img" aria-label="${c.name}, ${c.role}">
      <rect width="64" height="64" fill="${c.color}" opacity=".18"/>
      <path d="M10 64 Q12 45 32 44 Q52 45 54 64Z" fill="${c.color}"/>
      <rect x="27" y="38" width="10" height="8" fill="${c.skin}"/>
      <ellipse cx="32" cy="31" rx="12" ry="13" fill="${c.skin}"/>
      ${hat}
      <circle cx="27.5" cy="32" r="1.4" fill="#1b1b1b"/><circle cx="36.5" cy="32" r="1.4" fill="#1b1b1b"/>
      <path d="M28 37.5 Q32 40 36 37.5" stroke="#5a2e1e" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <rect x="40" y="50" width="9" height="5" rx="1" fill="#fff" opacity=".9"/>
    </svg>`;
  }

  function dialogue(key, text) {
    const c = DWM.CHARACTERS[key];
    return h("div", { class: "dialogue", role: "group", "aria-label": `${c.name} says` },
      h("div", { class: "portrait", html: portrait(key) }),
      h("div", { style: "min-width:0" }, h("div", null, h("span", { class: "who", text: c.name }), " ", h("span", { class: "role", text: "· " + c.role })), h("p", { class: "say", text })));
  }

  let toastTimer;
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = h("div", { class: "toast", role: "status" }); document.body.append(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }

  // In-page confirmation (the artifact frame has no window.confirm).
  function confirmBox({ title, body, ok = "Confirm", cancel = "Cancel" }) {
    return new Promise((resolve) => {
      const back = h("div", { class: "modal-back" });
      const done = (v) => { back.remove(); resolve(v); };
      const okBtn = h("button", { class: "btn primary", onclick: () => done(true) }, ok);
      back.append(h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title },
        h("h3", { text: title }), typeof body === "string" ? h("p", { text: body }) : body,
        h("div", { class: "row", style: "justify-content:flex-end" }, h("button", { class: "btn", onclick: () => done(false) }, cancel), okBtn)));
      back.addEventListener("keydown", (e) => { if (e.key === "Escape") done(false); });
      document.body.append(back); okBtn.focus();
    });
  }

  const fmtOpts = () => ({ timeZone: DWM.CONFIG.displayTimeZone, dateStyle: "medium", timeStyle: "short" });
  function fmtDate(iso) { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleString(undefined, fmtOpts()); }
  function fmtDur(sec) { sec = Math.round(sec || 0); const m = Math.floor(sec / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; }

  function focusMain() { const m = document.getElementById("app"); const f = m.querySelector("h1, h2"); if (f) { f.setAttribute("tabindex", "-1"); f.focus({ preventScroll: true }); } window.scrollTo({ top: 0 }); }

  DWM.ui = { h, portrait, dialogue, toast, confirmBox, fmtDate, fmtDur, focusMain };
})();
