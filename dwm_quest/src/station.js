// Mission 3: a walkable 2D curing department and the interactive DWM station board.
(function () {
  const DWM = window.DWM;
  const { h } = DWM.ui;

  const W = 960, H = 480;
  const START = { x: 90, y: 400 };
  const STATION = { x: 850, y: 300 };
  const OBST = [
    { x: 80, y: 60, w: 600, h: 105 },   // press row
    { x: 60, y: 172, w: 660, h: 28 },   // conveyor
    { x: 725, y: 55, w: 140, h: 120 },  // quality hold cage
    { x: 780, y: 335, w: 150, h: 95 },  // DWM board
    { x: 20, y: 250, w: 70, h: 60 },    // tyre-building bay
  ];
  const PRESSES = [0, 1, 2, 3, 4, 5].map((i) => ({ id: "CP-0" + (i + 1), x: 130 + i * 100, y: 112 }));

  function collides(x, y) {
    if (x < 14 || y < 14 || x > W - 14 || y > H - 14) return true;
    return OBST.some((o) => x > o.x - 12 && x < o.x + o.w + 12 && y > o.y - 12 && y < o.y + o.h + 12);
  }

  function drawPerson(g, x, y, t, body, hat, label, walking) {
    const bob = walking ? Math.sin(t / 90) * 2 : 0;
    g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(x, y + 16, 11, 4, 0, 0, Math.PI * 2); g.fill();
    // legs
    g.strokeStyle = "#1b2433"; g.lineWidth = 4; g.lineCap = "round";
    const sw = walking ? Math.sin(t / 90) * 5 : 0;
    g.beginPath(); g.moveTo(x - 4, y + 4); g.lineTo(x - 4 + sw, y + 15); g.moveTo(x + 4, y + 4); g.lineTo(x + 4 - sw, y + 15); g.stroke();
    g.fillStyle = body; g.beginPath(); g.roundRect(x - 9, y - 12 + bob, 18, 18, 5); g.fill();
    g.fillStyle = "#c48c63"; g.beginPath(); g.arc(x, y - 18 + bob, 7, 0, Math.PI * 2); g.fill();
    if (hat) { g.fillStyle = hat; g.beginPath(); g.arc(x, y - 20 + bob, 7.5, Math.PI, 0); g.fill(); g.fillRect(x - 9, y - 21 + bob, 18, 2.5); }
    if (label) {
      g.font = "600 11px 'IBM Plex Sans', sans-serif"; g.textAlign = "center";
      const w = g.measureText(label).width + 10;
      g.fillStyle = "rgba(8,17,31,.85)"; g.beginPath(); g.roundRect(x - w / 2, y - 44 + bob, w, 16, 4); g.fill();
      g.fillStyle = "#fff"; g.fillText(label, x, y - 32 + bob);
    }
  }

  function drawScene(g, t, st) {
    // floor
    g.fillStyle = "#27313f"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,.04)"; g.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // walkway
    g.fillStyle = "#2f3b4c"; g.fillRect(0, 222, W, 100);
    g.strokeStyle = "#d9a62e"; g.lineWidth = 3; g.setLineDash([18, 10]);
    g.beginPath(); g.moveTo(0, 222); g.lineTo(W, 222); g.moveTo(0, 322); g.lineTo(760, 322); g.stroke(); g.setLineDash([]);
    g.fillStyle = "rgba(217,166,46,.6)"; g.font = "600 12px 'Barlow Condensed', sans-serif"; g.textAlign = "left";
    g.fillText("PEDESTRIAN WALKWAY", 300, 275);
    // area label
    g.fillStyle = "#9fb0c8"; g.font = "600 14px 'Barlow Condensed', sans-serif";
    g.fillText("CURING DEPARTMENT · LINE 2 (SIMULATED)", 84, 48);
    // presses
    PRESSES.forEach((p, i) => {
      const fault = i === 3;
      g.fillStyle = "#4b5a70"; g.beginPath(); g.roundRect(p.x - 42, p.y - 48, 84, 96, 6); g.fill();
      g.fillStyle = "#5f7089"; g.beginPath(); g.arc(p.x, p.y - 4, 30, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#1c232d"; g.beginPath(); g.arc(p.x, p.y - 4, 20, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3a4555"; g.beginPath(); g.arc(p.x, p.y - 4, 9, 0, Math.PI * 2); g.fill();
      // andon lamp
      const on = fault ? Math.floor(t / 400) % 2 === 0 : true;
      g.fillStyle = fault ? (on ? "#ff5a4f" : "#5a1d1a") : "#4fd18b";
      g.beginPath(); g.arc(p.x + 32, p.y - 38, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#e8eef7"; g.font = "600 12px 'IBM Plex Mono', monospace"; g.textAlign = "center";
      g.fillText(p.id, p.x, p.y + 40);
      if (fault) { g.fillStyle = "#ffb1aa"; g.font = "600 11px 'IBM Plex Sans', sans-serif"; g.fillText("STOPPED · LOW STEAM PRESS.", p.x, p.y - 56); }
    });
    // conveyor with moving tyres
    g.fillStyle = "#3b4658"; g.fillRect(60, 172, 660, 28);
    g.strokeStyle = "#566377"; g.lineWidth = 1;
    for (let x = 60; x < 720; x += 12) { g.beginPath(); g.moveTo(x, 172); g.lineTo(x, 200); g.stroke(); }
    for (let k = 0; k < 9; k++) {
      const x = 70 + ((k * 75 + t / 30) % 640);
      g.fillStyle = "#121417"; g.beginPath(); g.arc(x, 186, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3a3f47"; g.beginPath(); g.arc(x, 186, 4, 0, Math.PI * 2); g.fill();
    }
    // quality hold cage
    g.strokeStyle = "#e3a73a"; g.lineWidth = 2; g.setLineDash([4, 3]); g.strokeRect(725, 55, 140, 120); g.setLineDash([]);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { g.fillStyle = "#121417"; g.beginPath(); g.arc(752 + c * 29, 90 + r * 28, 11, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#b3261e"; g.fillRect(830, 60, 30, 16); g.fillStyle = "#fff"; g.font = "600 9px 'IBM Plex Mono', monospace"; g.textAlign = "center"; g.fillText("HOLD", 845, 71);
    g.fillStyle = "#f2c46b"; g.font = "600 12px 'Barlow Condensed', sans-serif"; g.fillText("QUALITY HOLD · 48 TYRES", 795, 192);
    // tyre-building bay
    g.fillStyle = "#3b4658"; g.fillRect(20, 250, 70, 60); g.fillStyle = "#9fb0c8"; g.font = "600 11px 'Barlow Condensed', sans-serif"; g.fillText("BUILDING", 55, 284);
    // DWM station
    const near = st.near;
    g.fillStyle = "#3a475c"; g.fillRect(780, 335, 150, 95);
    g.fillStyle = "#0f1d33"; g.fillRect(786, 341, 138, 70);
    g.fillStyle = "#e8eef7"; g.font = "700 15px 'Barlow Condensed', sans-serif"; g.fillText("DWM STATION", 855, 360);
    const bars = [0.57, 0.82, 1, 0.4];
    bars.forEach((b, i) => { g.fillStyle = b < 0.9 ? "#f07d74" : "#5cc28f"; g.fillRect(796 + i * 31, 400 - b * 30, 18, b * 30); });
    g.fillStyle = "#6f7d92"; g.fillRect(800, 430, 6, 30); g.fillRect(904, 430, 6, 30);
    // destination marker
    const pulse = 18 + Math.sin(t / 250) * 4;
    g.strokeStyle = near ? "#5cc28f" : "#e3a73a"; g.lineWidth = 3;
    g.beginPath(); g.ellipse(STATION.x, STATION.y + 14, pulse, pulse * 0.4, 0, 0, Math.PI * 2); g.stroke();
    if (!st.arrived) { g.fillStyle = "#e3a73a"; g.font = "600 12px 'IBM Plex Sans', sans-serif"; g.fillText("▼ Walk here", STATION.x, STATION.y - 30 + Math.sin(t / 200) * 3); }
    // operator at CP-04
    drawPerson(g, 430, 205 + 10, t, "#2b6cb0", "#4fd18b", null, false);
    // Arjun and the player
    drawPerson(g, st.ax, st.ay, t, DWM.CHARACTERS.arjun.color, "#e3a73a", "Arjun", st.aMoving);
    drawPerson(g, st.x, st.y, t, "#13284a", "#f2f5fa", "You", st.moving);
    if (st.target && !st.arrived) { g.strokeStyle = "rgba(255,255,255,.35)"; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(st.x, st.y); g.lineTo(st.target.x, st.target.y); g.stroke(); g.setLineDash([]); }
  }

  // Mounts the walk scene. Calls onArrive() once when the player reaches the station.
  function mountWalk(container, onArrive) {
    const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = h("canvas", { width: W, height: H, role: "img", tabindex: "0",
      "aria-label": "Top-down view of the curing department. Six curing presses; CP-04 is stopped with a flashing red lamp. A quality hold cage holds 48 tyres. The DWM station board stands beside the walkway on the right. Use arrow keys or WASD to walk, click or tap a spot to walk there, or use the Walk to the DWM station button." });
    const tip = h("div", { class: "scene-tip", role: "status", text: "Walk to the DWM STATION (right). Arrow keys / WASD, or click or tap the floor." });
    const dpad = h("div", { class: "dpad", "aria-hidden": "true" });
    const keys = new Set();
    const hold = (k) => ({ onpointerdown: (e) => { e.preventDefault(); keys.add(k); }, onpointerup: () => keys.delete(k), onpointerleave: () => keys.delete(k), onpointercancel: () => keys.delete(k) });
    dpad.append(h("span"), h("button", { ...hold("up"), "aria-label": "Up" }, "▲"), h("span"), h("button", { ...hold("left"), "aria-label": "Left" }, "◀"), h("button", { ...hold("down"), "aria-label": "Down" }, "▼"), h("button", { ...hold("right"), "aria-label": "Right" }, "▶"));
    const autoBtn = h("button", { class: "btn accent small", onclick: () => { st.target = { ...STATION }; canvas.focus(); } }, "Walk to the DWM station");
    const wrap = h("div", { class: "scene-wrap" }, canvas, h("div", { class: "scene-hud" }, h("div", { class: "row", style: "gap:8px" }, autoBtn, tip), dpad));
    container.append(wrap);

    const st = { x: START.x, y: START.y, ax: START.x - 34, ay: START.y + 6, target: null, moving: false, aMoving: false, near: false, arrived: false };
    const g = canvas.getContext("2d");
    const KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
    const kd = (e) => { const k = KEYMAP[e.code]; if (k && document.activeElement === canvas) { keys.add(k); st.target = null; e.preventDefault(); } };
    const ku = (e) => { const k = KEYMAP[e.code]; if (k) keys.delete(k); };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    canvas.addEventListener("pointerdown", (e) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
      // Clicking the board or its marker walks to the station.
      const onBoard = x > 760 && y > 270;
      st.target = onBoard ? { ...STATION } : { x, y };
      canvas.focus();
    });

    let last = performance.now(), raf;
    function step(now) {
      if (!canvas.isConnected) { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); return; }
      const dt = Math.min(50, now - last); last = now;
      const sp = 0.22 * dt;
      let dx = 0, dy = 0;
      if (keys.size) { if (keys.has("up")) dy -= 1; if (keys.has("down")) dy += 1; if (keys.has("left")) dx -= 1; if (keys.has("right")) dx += 1; st.target = null; }
      else if (st.target) { dx = st.target.x - st.x; dy = st.target.y - st.y; const d = Math.hypot(dx, dy); if (d < 3) { st.target = null; dx = dy = 0; } }
      const len = Math.hypot(dx, dy);
      st.moving = false;
      if (len > 0 && !st.arrived) {
        const mx = (dx / len) * Math.min(sp, st.target ? len : sp), my = (dy / len) * Math.min(sp, st.target ? len : sp);
        if (!collides(st.x + mx, st.y + my)) { st.x += mx; st.y += my; st.moving = true; }
        else if (!collides(st.x + mx, st.y)) { st.x += mx; st.moving = true; }
        else if (!collides(st.x, st.y + my)) { st.y += my; st.moving = true; }
        else st.target = null;
      }
      // Arjun follows
      const fx = st.x - 34 - st.ax, fy = st.y + 6 - st.ay, fd = Math.hypot(fx, fy);
      st.aMoving = fd > 4;
      if (st.aMoving) { const k = Math.min(1, (0.18 * dt) / fd); st.ax += fx * k; st.ay += fy * k; }
      st.near = Math.hypot(st.x - STATION.x, st.y - STATION.y) < 46;
      if (st.near && !st.arrived) {
        st.arrived = true; tip.textContent = "You have arrived at the DWM station.";
        setTimeout(onArrive, reduced ? 50 : 500);
      }
      drawScene(g, reduced ? 0 : now, st);
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return { destroy() { cancelAnimationFrame(raf); wrap.remove(); } };
  }

  // The board with hotspots A–H. `required` are highlighted; opening one calls onSeen(id).
  function board(mission, seen, required, onSeen) {
    const B = mission.board;
    const detail = h("div", { class: "board-detail", "aria-live": "polite" }, h("p", { class: "muted", style: "color:#9fb4d4", text: "Select a board section to open it." }));
    const grid = h("div", { class: "hotspots" });
    const btns = {};
    Object.entries(B).forEach(([k, s]) => {
      const b = h("button", { class: "hs" + (s.alert ? " alert" : "") + (seen.includes(k) ? " seen" : "") + (required.includes(k) && !seen.includes(k) ? " req" : ""),
        "aria-label": `Board section ${k}: ${s.t}. ${s.v}`, onclick: () => open(k) },
        h("span", { class: "tag", text: k }), h("span", { class: "t", text: s.t }), h("span", { class: "v", text: s.v }));
      btns[k] = b; grid.append(b);
    });
    function open(k) {
      detail.innerHTML = B[k].html;
      Object.values(btns).forEach((b) => b.removeAttribute("aria-current"));
      btns[k].setAttribute("aria-current", "true");
      btns[k].classList.add("seen"); btns[k].classList.remove("req");
      onSeen(k);
    }
    return { el: h("div", { class: "board" }, h("div", { class: "board-title" }, h("b", { text: "DWM STATION · CURING LINE 2 · SHIFT A" }), h("span", { class: "sim", text: "SIMULATED · 12:05" })), grid, detail), open };
  }

  DWM.station = { mountWalk, board };
})();
