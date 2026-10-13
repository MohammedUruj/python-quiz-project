// The 2D factory floor: canvas rendering, player movement, collision, NPCs and interaction.

import { NPCS, AVATARS } from './art.js';

export const WORLD = { w: 1660, h: 1040 };

export const AREAS = [
  { id: 'mixing', name: 'Mixing & Material Preparation', short: 'Mixing', x: 40, y: 40, w: 370, h: 400, floor: '#2f3a3f', door: 'bottom', step: 1 },
  { id: 'components', name: 'Component Preparation', short: 'Components', x: 440, y: 40, w: 370, h: 400, floor: '#323a45', door: 'bottom', step: 2 },
  { id: 'building', name: 'Tyre Building', short: 'Building', x: 840, y: 40, w: 370, h: 400, floor: '#353a44', door: 'bottom', step: 3 },
  { id: 'curing', name: 'Curing & Vulcanization', short: 'Curing', x: 1240, y: 40, w: 360, h: 400, floor: '#3d3631', door: 'bottom', step: 4 },
  { id: 'inspection', name: 'Final Inspection', short: 'Inspection', x: 1240, y: 600, w: 360, h: 400, floor: '#2e3b36', door: 'top', step: 5 },
  { id: 'lab', name: 'Quality Laboratory', short: 'Quality Lab', x: 840, y: 600, w: 370, h: 400, floor: '#2c3a44', door: 'top' },
  { id: 'training', name: 'TQM Training Room', short: 'Training', x: 440, y: 600, w: 370, h: 400, floor: '#3a3446', door: 'top' },
  { id: 'control', name: 'Production Control Room', short: 'Control Room', x: 40, y: 600, w: 370, h: 400, floor: '#2b3340', door: 'top' },
];

/**
 * Stations: interactive equipment and people. `info` is shown when a station has no active task,
 * so exploring the floor also teaches the tyre process.
 */
export const STATIONS = [
  { id: 'rawstore', area: 'mixing', kind: 'rawstore', x: 60, y: 90, w: 120, h: 90, label: 'Raw material store', verb: 'check', info: 'Natural and synthetic rubber, carbon black, silica, oils and curing agents are received here. Each lot is identified so it can be traced through mixing to the finished tyre.' },
  { id: 'mixer', area: 'mixing', kind: 'mixer', x: 250, y: 90, w: 110, h: 110, label: 'Banbury mixer', verb: 'inspect', info: 'Internal (Banbury-type) mixers blend rubber, fillers and chemicals into compound batches. Mixing time, temperature and energy are controlled because they affect compound properties downstream.' },
  { id: 'batchlog', area: 'mixing', kind: 'terminal', x: 90, y: 290, w: 60, h: 50, label: 'Compound batch records', verb: 'review', info: 'Batch records link every compound batch to its test results (for example viscosity and cure behaviour) and to the components made from it.' },
  { id: 'calender', area: 'components', kind: 'calender', x: 470, y: 90, w: 150, h: 80, label: 'Calender line', verb: 'inspect', info: 'The calender coats textile or steel cords with rubber to make plies and belts. Cord spacing and gauge (thickness) are critical characteristics.' },
  { id: 'extruder', area: 'components', kind: 'extruder', x: 650, y: 90, w: 120, h: 90, label: 'Tread extruder', verb: 'inspect', info: 'The extruder forms the tread and sidewall profiles. Width, gauge and weight are measured continuously because they affect tyre uniformity.' },
  { id: 'beads', area: 'components', kind: 'beads', x: 500, y: 280, w: 90, h: 70, label: 'Bead station', verb: 'inspect', info: 'Bead wire bundles are formed and covered with rubber. The bead seats the tyre on the rim, so its dimensions are tightly controlled.' },
  { id: 'builder', area: 'building', kind: 'builder', x: 880, y: 90, w: 140, h: 100, label: 'Tyre building machine', verb: 'inspect', info: 'Components are assembled on a rotating drum into a "green" (uncured) tyre. Splice quality and component placement are checked here.' },
  { id: 'kaizencell', area: 'building', kind: 'cell', x: 1050, y: 270, w: 120, h: 120, label: 'Building cell 2 layout', verb: 'walk', info: 'Building cell 2: two builders share a bead rack, a tread servicer and a green-tyre carrier stand.' },
  { id: 'press4', area: 'curing', kind: 'press', x: 1290, y: 90, w: 110, h: 100, label: 'Curing press 4', verb: 'inspect', info: 'In the curing press, heat and pressure (through an inflated bladder) vulcanise the green tyre and mould the tread pattern. Time, temperature and pressure must all be right.' },
  { id: 'press5', area: 'curing', kind: 'press', x: 1440, y: 90, w: 110, h: 100, label: 'Curing press 5', verb: 'inspect', info: 'Press 5 runs the same tyre size as Press 4 and is a useful comparison when investigating press-specific problems.' },
  { id: 'pressdata', area: 'curing', kind: 'terminal', x: 1300, y: 300, w: 60, h: 50, label: 'Press data terminal', verb: 'review', info: 'This terminal shows cure cycle records: platen temperature, bladder pressure and cycle time for every tyre.' },
  { id: 'inspectTable', area: 'inspection', kind: 'table', x: 1280, y: 700, w: 140, h: 70, label: 'Final inspection station', verb: 'inspect', info: 'Every tyre is visually and manually inspected. Samples go to uniformity and X-ray testing. Inspection detects defects; it cannot prevent them.' },
  { id: 'uniformity', area: 'inspection', kind: 'uniformity', x: 1460, y: 820, w: 100, h: 90, label: 'Uniformity machine', verb: 'inspect', info: 'The uniformity machine rotates the tyre under load and measures force variation, which affects ride vibration.' },
  { id: 'labBench', area: 'lab', kind: 'bench', x: 880, y: 680, w: 150, h: 60, label: 'Data analysis workstation', verb: 'use', info: 'The lab workstation holds inspection databases and statistical tools for analysing quality data.' },
  { id: 'xray', area: 'lab', kind: 'xray', x: 1080, y: 820, w: 100, h: 110, label: 'X-ray inspection room', verb: 'inspect', info: 'X-ray inspection reveals internal features (cord spacing, splices, foreign material, separations) that cannot be seen from outside.' },
  { id: 'whiteboard', area: 'training', kind: 'whiteboard', x: 520, y: 650, w: 200, h: 26, label: 'Team huddle board', verb: 'use', info: 'The huddle board tracks improvement ideas, owners and status.' },
  { id: 'quizTerminal', area: 'training', kind: 'quizterm', x: 700, y: 880, w: 70, h: 60, label: 'Assessment terminal', verb: 'use', info: 'The Quality Championship final assessment is taken here after the final challenge.' },
  { id: 'kpiBoard', area: 'control', kind: 'kpiboard', x: 100, y: 630, w: 250, h: 60, label: 'Production performance board', verb: 'read', info: 'The board shows live, fictional KPIs: rejection rate, first-pass yield, rework rate, complaints and output.' },
  { id: 'complaintDesk', area: 'control', kind: 'desk', x: 230, y: 860, w: 120, h: 60, label: 'Customer quality desk', verb: 'review', info: 'Customer complaints, returns and feedback (the voice of the customer) arrive at this desk.' },
  // People
  { id: 'npcManager', area: 'control', kind: 'npc', npc: 'manager', x: 120, y: 780, w: 26, h: 26, label: 'Elena Marsh (Plant Manager)', verb: 'talk to' },
  { id: 'npcSupervisor', area: 'building', kind: 'npc', npc: 'supervisor', x: 1110, y: 140, w: 26, h: 26, label: 'Rajesh Kumar (Production Supervisor)', verb: 'talk to' },
  { id: 'npcOperator', area: 'curing', kind: 'npc', npc: 'operator', x: 1350, y: 230, w: 26, h: 26, label: 'Tomás Rivera (Curing Operator)', verb: 'talk to' },
  { id: 'npcMaint', area: 'curing', kind: 'npc', npc: 'maintenance', x: 1500, y: 300, w: 26, h: 26, label: 'Kwame Mensah (Maintenance Technician)', verb: 'talk to' },
  { id: 'npcInspector', area: 'inspection', kind: 'npc', npc: 'inspector', x: 1330, y: 830, w: 26, h: 26, label: 'Mei Lin (Quality Inspector)', verb: 'talk to' },
  { id: 'npcLab', area: 'lab', kind: 'npc', npc: 'lab', x: 930, y: 860, w: 26, h: 26, label: 'Dr. Sara Haddad (Quality Lab Lead)', verb: 'talk to' },
  { id: 'npcCustomer', area: 'control', kind: 'npc', npc: 'customer', x: 170, y: 930, w: 26, h: 26, label: 'Jonas Berg (Customer Quality Engineer)', verb: 'talk to' },
  { id: 'npcBuilder', area: 'building', kind: 'npc', npc: 'builder', x: 960, y: 240, w: 26, h: 26, label: 'Aisha Bello (Tyre Builder)', verb: 'talk to' },
];

export const stationById = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
export const areaById = Object.fromEntries(AREAS.map((a) => [a.id, a]));

const DOOR_W = 110;
const WALL = 8;
const REACH = 64;

function buildObstacles() {
  const obs = [];
  for (const a of AREAS) {
    const cx = a.x + a.w / 2;
    const top = [a.x, a.y, a.w, WALL]; const bottom = [a.x, a.y + a.h - WALL, a.w, WALL];
    const doorSide = a.door === 'bottom' ? bottom : top;
    // door gap in the wall facing the aisle
    const walls = [a.door === 'bottom' ? top : bottom, [a.x, a.y, WALL, a.h], [a.x + a.w - WALL, a.y, WALL, a.h]];
    walls.push([a.x, doorSide[1], cx - DOOR_W / 2 - a.x, WALL]);
    walls.push([cx + DOOR_W / 2, doorSide[1], a.x + a.w - (cx + DOOR_W / 2), WALL]);
    walls.forEach(([x, y, w, h]) => obs.push({ x, y, w, h }));
  }
  for (const s of STATIONS) {
    if (s.kind === 'npc') obs.push({ x: s.x - 11, y: s.y - 8, w: 22, h: 18 });
    else obs.push({ x: s.x, y: s.y, w: s.w, h: s.h });
  }
  return obs;
}

export function stationCenter(s) {
  return s.kind === 'npc' ? { x: s.x, y: s.y } : { x: s.x + s.w / 2, y: s.y + s.h / 2 };
}

/** A free spot in front of a station for quick travel. */
function standPoint(s) {
  const c = stationCenter(s);
  const a = areaById[s.area];
  if (s.kind === 'npc') return { x: c.x + (c.x < a.x + a.w / 2 ? 34 : -34), y: c.y + 4 };
  const below = c.y < a.y + a.h / 2;
  return { x: c.x, y: c.y + (s.h / 2 + 26) * (below ? 1 : -1) };
}

export function createWorld(canvas, hooks) {
  const ctx = canvas.getContext('2d');
  const obstacles = buildObstacles();
  const player = { x: 820, y: 520, dir: 1, moving: false, t: 0, target: null };
  const keys = new Set();
  const touch = { up: false, down: false, left: false, right: false };
  let paused = false; let last = performance.now(); let time = 0;
  let scale = 1; let cam = { x: 0, y: 0 }; let nearest = null;
  const forklift = { x: 120, y: 520, vx: 70 };
  const walkers = [
    { path: [[560, 470], [1100, 470]], i: 0, x: 560, y: 470, coat: '#5a6b7d', hat: '#f0b429', speed: 55 },
    { path: [[1300, 560], [1300, 470], [1560, 470]], i: 0, x: 1300, y: 560, coat: '#2f6b4f', hat: '#2bb673', speed: 45 },
  ];

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const targetView = r.width < 700 ? 600 : 1150;
    scale = Math.max(0.45, Math.min(1.6, r.width / targetView)) * dpr;
  }

  function collides(x, y) {
    const bx = x - 10; const by = y - 6; const bw = 20; const bh = 14;
    if (bx < 20 || by < 34 || bx + bw > WORLD.w - 46 || by + bh > WORLD.h - 10) return true;
    return obstacles.some((o) => bx < o.x + o.w && bx + bw > o.x && by < o.y + o.h && by + bh > o.y);
  }

  /** Nearest collision-free point to p (spiral search) so quick travel never traps the player. */
  function findFree(p) {
    if (!collides(p.x, p.y)) return p;
    for (let r = 8; r < 200; r += 8) {
      for (let a = 0; a < 16; a++) {
        const q = { x: p.x + Math.cos((a / 16) * Math.PI * 2) * r, y: p.y + Math.sin((a / 16) * Math.PI * 2) * r };
        if (!collides(q.x, q.y)) return q;
      }
    }
    return { x: 820, y: 520 };
  }

  function tryMove(dx, dy) {
    let moved = false;
    if (dx && !collides(player.x + dx, player.y)) { player.x += dx; moved = true; }
    if (dy && !collides(player.x, player.y + dy)) { player.y += dy; moved = true; }
    return moved;
  }

  function update(dt) {
    time += dt;
    let dx = 0; let dy = 0;
    if (!paused) {
      if (keys.has('arrowleft') || keys.has('a') || touch.left) dx -= 1;
      if (keys.has('arrowright') || keys.has('d') || touch.right) dx += 1;
      if (keys.has('arrowup') || keys.has('w') || touch.up) dy -= 1;
      if (keys.has('arrowdown') || keys.has('s') || touch.down) dy += 1;
      if (dx || dy) player.target = null;
      else if (player.target) {
        const tx = player.target.x - player.x; const ty = player.target.y - player.y;
        const d = Math.hypot(tx, ty);
        if (d < 6) player.target = null; else { dx = tx / d; dy = ty / d; }
      }
    }
    const len = Math.hypot(dx, dy) || 1;
    const speed = 230 * dt;
    player.moving = !!(dx || dy);
    if (player.moving) {
      const moved = tryMove((dx / len) * speed, (dy / len) * speed);
      if (!moved) player.target = null;
      if (dx) player.dir = dx > 0 ? 1 : -1;
      player.t += dt;
    }
    forklift.x += forklift.vx * dt;
    if (forklift.x > 1540 || forklift.x < 90) forklift.vx *= -1;
    for (const w of walkers) {
      const [tx, ty] = w.path[(w.i + 1) % w.path.length];
      const d = Math.hypot(tx - w.x, ty - w.y);
      if (d < 2) w.i = (w.i + 1) % w.path.length;
      else { w.x += ((tx - w.x) / d) * w.speed * dt; w.y += ((ty - w.y) / d) * w.speed * dt; }
    }
    // nearest interactable
    let best = null; let bestD = Infinity;
    for (const s of STATIONS) {
      const c = stationCenter(s);
      const ex = Math.max(s.kind === 'npc' ? 0 : s.w / 2, 0); const ey = Math.max(s.kind === 'npc' ? 0 : s.h / 2, 0);
      const ddx = Math.max(Math.abs(player.x - c.x) - ex, 0); const ddy = Math.max(Math.abs(player.y - c.y) - ey, 0);
      const st = hooks.stationState(s.id);
      const d = Math.hypot(ddx, ddy) - (st && st.active ? 24 : 0); // prefer stations with an active objective
      if (d < REACH && d < bestD) { best = s; bestD = d; }
    }
    if (best !== nearest) { nearest = best; hooks.onNearest(nearest); }
    // camera
    const vw = canvas.width / scale; const vh = canvas.height / scale;
    cam.x = Math.max(0, Math.min(WORLD.w - vw, player.x - vw / 2));
    cam.y = Math.max(0, Math.min(WORLD.h - vh, player.y - vh / 2));
    if (vw > WORLD.w) cam.x = (WORLD.w - vw) / 2;
    if (vh > WORLD.h) cam.y = (WORLD.h - vh) / 2;
  }

  // ---------- drawing ----------
  function rr(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function drawFloor() {
    ctx.fillStyle = '#1e2329';
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    // aisle
    ctx.fillStyle = '#272d34';
    ctx.fillRect(20, 440, WORLD.w - 66, 160);
    ctx.strokeStyle = '#d6a419'; ctx.lineWidth = 3; ctx.setLineDash([22, 14]);
    ctx.beginPath(); ctx.moveTo(30, 455); ctx.lineTo(WORLD.w - 56, 455); ctx.moveTo(30, 585); ctx.lineTo(WORLD.w - 56, 585); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(214,164,25,.65)'; ctx.font = 'bold 13px Inter, Arial, sans-serif';
    ctx.fillText('MAIN AISLE · PEDESTRIAN WALKWAY', 640, 526);
    for (const a of AREAS) {
      ctx.fillStyle = a.floor; ctx.fillRect(a.x, a.y, a.w, a.h);
      ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
      for (let gx = a.x + 40; gx < a.x + a.w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, a.y); ctx.lineTo(gx, a.y + a.h); ctx.stroke(); }
      for (let gy = a.y + 40; gy < a.y + a.h; gy += 40) { ctx.beginPath(); ctx.moveTo(a.x, gy); ctx.lineTo(a.x + a.w, gy); ctx.stroke(); }
      const label = `${a.step ? `${a.step}. ` : ''}${a.name.toUpperCase()}`;
      ctx.font = 'bold 13px Inter, Arial, sans-serif';
      const ly = a.door === 'bottom' ? a.y + a.h - 18 : a.y + 26;
      const tw = ctx.measureText(label).width;
      rr(a.x + 14, ly - 15, tw + 16, 22, 4, 'rgba(10,14,18,.55)');
      ctx.fillStyle = '#e8edf2'; ctx.fillText(label, a.x + 22, ly);
    }
  }

  function drawWalls() {
    ctx.fillStyle = '#55606c';
    for (const a of AREAS) {
      const cx = a.x + a.w / 2;
      const doorY = a.door === 'bottom' ? a.y + a.h - WALL : a.y;
      const otherY = a.door === 'bottom' ? a.y : a.y + a.h - WALL;
      ctx.fillRect(a.x, otherY, a.w, WALL);
      ctx.fillRect(a.x, a.y, WALL, a.h); ctx.fillRect(a.x + a.w - WALL, a.y, WALL, a.h);
      ctx.fillRect(a.x, doorY, cx - DOOR_W / 2 - a.x, WALL);
      ctx.fillRect(cx + DOOR_W / 2, doorY, a.x + a.w - cx - DOOR_W / 2, WALL);
      // door stripes
      ctx.fillStyle = '#d6a419';
      ctx.fillRect(cx - DOOR_W / 2 - 6, doorY - 2, 6, WALL + 4); ctx.fillRect(cx + DOOR_W / 2, doorY - 2, 6, WALL + 4);
      ctx.fillStyle = '#55606c';
    }
  }

  function drawConveyor() {
    // top line: mixing -> curing, then down the right side to inspection
    ctx.fillStyle = '#3b4148'; ctx.fillRect(40, 10, 1580, 22); ctx.fillRect(1612, 10, 26, 990);
    ctx.strokeStyle = '#4c535b'; ctx.lineWidth = 2;
    const off = (time * 40) % 20;
    for (let x = 40 + off; x < 1620; x += 20) { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 30); ctx.stroke(); }
    for (let y = 10 + off; y < 1000; y += 20) { ctx.beginPath(); ctx.moveTo(1614, y); ctx.lineTo(1636, y); ctx.stroke(); }
    const pathLen = 1580 + 990;
    for (let i = 0; i < 16; i++) {
      const p = (time * 40 + i * (pathLen / 16)) % pathLen;
      let x; let y;
      if (p < 1580) { x = 40 + p; y = 21; } else { x = 1625; y = 10 + (p - 1580); }
      const cured = x > 1240 || p >= 1580;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fillStyle = cured ? '#121316' : '#4a3f35'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#7a828c'; ctx.fill();
    }
  }

  function screen(x, y, w, h, color = '#0d1b24') {
    rr(x, y, w, h, 3, color, '#4a5763');
  }

  function drawStation(s) {
    const { x, y, w, h } = s;
    const blink = Math.sin(time * 3) > 0;
    switch (s.kind) {
      case 'rawstore':
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          rr(x + i * 40, y + j * 45, 36, 40, 3, ['#8a6d3b', '#6d7b8a', '#3d3d3d'][(i + j) % 3], '#222');
          ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x + i * 40 + 8, y + j * 45 + 14, 20, 8);
        }
        break;
      case 'mixer':
        rr(x, y + 30, w, h - 30, 6, '#5d6873', '#2b3138');
        rr(x + 25, y, w - 50, 40, 4, '#77828e', '#2b3138');
        ctx.fillStyle = '#2b3138'; ctx.fillRect(x + 40, y + 6, w - 80, 10);
        screen(x + 10, y + 55, 34, 22); ctx.fillStyle = blink ? '#38d39f' : '#1d8a66'; ctx.fillRect(x + 14, y + 60, 26, 4);
        ctx.fillStyle = '#e4572e'; ctx.beginPath(); ctx.arc(x + w - 20, y + 66, 6, 0, Math.PI * 2); ctx.fill();
        break;
      case 'terminal':
        rr(x + 10, y + 20, w - 20, h - 20, 3, '#4b5560', '#2b3138');
        screen(x, y, w, 30); ctx.fillStyle = '#5bc0eb';
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 6, y + 6 + i * 7, (w - 12) * (0.5 + 0.5 * Math.abs(Math.sin(time + i))), 3);
        break;
      case 'calender':
        rr(x, y, w, h, 6, '#5d6873', '#2b3138');
        for (let i = 0; i < 3; i++) {
          ctx.save(); ctx.translate(x + 30 + i * 45, y + h / 2); ctx.rotate(time * 2 * (i % 2 ? 1 : -1));
          ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fillStyle = '#9aa4ae'; ctx.fill();
          ctx.fillStyle = '#4b5560'; ctx.fillRect(-2, -18, 4, 36); ctx.restore();
        }
        break;
      case 'extruder':
        rr(x, y + 20, 70, 60, 5, '#5d6873', '#2b3138');
        rr(x + 15, y, 40, 26, 3, '#77828e', '#2b3138');
        rr(x + 70, y + 40, w - 70, 18, 2, '#2b2d32');
        ctx.fillStyle = '#1a1b1e'; ctx.fillRect(x + 72, y + 44, ((time * 30) % (w - 74)), 10);
        break;
      case 'beads':
        rr(x, y, w, h, 5, '#4b5560', '#2b3138');
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + 20 + i * 25, y + h / 2, 11, 0, Math.PI * 2); ctx.strokeStyle = '#b9bec6'; ctx.lineWidth = 4; ctx.stroke(); }
        break;
      case 'builder': {
        rr(x, y, w, h, 6, '#5d6873', '#2b3138');
        ctx.save(); ctx.translate(x + 60, y + h / 2); ctx.rotate(time * 1.5);
        ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fillStyle = '#4a3f35'; ctx.fill();
        ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 4; for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(30, 0); ctx.stroke(); }
        ctx.restore();
        screen(x + 104, y + 14, 28, 22); ctx.fillStyle = '#38d39f'; ctx.fillRect(x + 108, y + 20, 18, 3);
        break;
      }
      case 'cell':
        ctx.setLineDash([6, 5]); rr(x, y, w, h, 6, 'rgba(91,192,235,.08)', '#5bc0eb'); ctx.setLineDash([]);
        rr(x + 10, y + 12, 34, 30, 3, '#4b5560'); rr(x + 70, y + 12, 38, 30, 3, '#4b5560'); rr(x + 30, y + 70, 60, 34, 3, '#5d6873');
        ctx.fillStyle = '#9ad4f0'; ctx.font = '10px Inter, Arial'; ctx.fillText('CELL 2', x + 40, y + 62);
        break;
      case 'press': {
        const open = (Math.sin(time * 0.8 + x) + 1) / 2;
        rr(x, y, w, h, 6, '#6a5a4c', '#2b2622');
        rr(x + 10, y + 10, w - 20, (h - 20) / 2 - open * 10, 4, '#8a7765');
        rr(x + 10, y + h / 2 + open * 10, w - 20, (h - 20) / 2 - open * 10, 4, '#7a6858');
        ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 16, 0, Math.PI * 2); ctx.fillStyle = '#16171a'; ctx.fill();
        ctx.fillStyle = '#ffdd88'; ctx.font = 'bold 12px Inter, Arial'; ctx.fillText(s.id === 'press4' ? 'P4' : 'P5', x + 6, y + h - 6);
        ctx.fillStyle = s.id === 'press4' && blink ? '#e4572e' : '#38d39f';
        ctx.beginPath(); ctx.arc(x + w - 10, y + 10, 5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'table':
        rr(x, y, w, h, 5, '#6d7b8a', '#2b3138');
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + 28 + i * 42, y + h / 2, 17, 0, Math.PI * 2); ctx.fillStyle = '#141518'; ctx.fill(); ctx.beginPath(); ctx.arc(x + 28 + i * 42, y + h / 2, 7, 0, Math.PI * 2); ctx.fillStyle = '#8b939c'; ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,220,.12)'; ctx.fillRect(x - 6, y - 10, w + 12, 8);
        break;
      case 'uniformity':
        rr(x, y, w, h, 6, '#4f6a63', '#22302c');
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(time * 4);
        ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fillStyle = '#141518'; ctx.fill();
        ctx.fillStyle = '#8b939c'; ctx.fillRect(-3, -26, 6, 10); ctx.restore();
        break;
      case 'bench':
        rr(x, y, w, h, 4, '#7d8a96', '#2b3138');
        screen(x + 10, y + 8, 40, 28); screen(x + 60, y + 8, 40, 28);
        ctx.strokeStyle = '#5bc0eb'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i < 8; i++) ctx.lineTo(x + 63 + i * 5, y + 26 - Math.abs(Math.sin(time + i)) * 12); ctx.stroke();
        ctx.fillStyle = '#f0b429'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 14 + i * 9, y + 32 - (4 - i) * 5, 6, (4 - i) * 5);
        break;
      case 'xray':
        rr(x, y, w, h, 6, '#3f4a55', '#1d2328');
        ctx.fillStyle = '#f0b429'; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 30); ctx.lineTo(x + w / 2 - 16, y + 58); ctx.lineTo(x + w / 2 + 16, y + 58); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1d2328'; ctx.font = 'bold 14px Arial'; ctx.fillText('☢', x + w / 2 - 6, y + 54);
        ctx.fillStyle = blink ? '#e4572e' : '#6b2a1a'; ctx.fillRect(x + 10, y + 8, w - 20, 8);
        break;
      case 'whiteboard':
        rr(x, y, w, h, 3, '#e9eef3', '#8b939c');
        ['#f0b429', '#5bc0eb', '#38d39f', '#e4572e'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + 12 + i * 46, y + 6, 30, 14); });
        // tables
        rr(x + 20, y + 110, 160, 60, 6, '#5a4e44', '#2b2622');
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + 40 + i * 40, y + 190, 10, 0, Math.PI * 2); ctx.fillStyle = '#3d4652'; ctx.fill(); }
        break;
      case 'quizterm':
        rr(x, y, w, h, 6, '#3d4652', '#1d2328');
        screen(x + 8, y + 8, w - 16, h - 24, '#132b3a');
        ctx.fillStyle = '#f0b429'; ctx.font = 'bold 10px Inter, Arial'; ctx.fillText('ASSESS', x + 13, y + 26);
        break;
      case 'kpiboard': {
        rr(x, y, w, h, 4, '#0d1b24', '#4a5763');
        const v = hooks.kpiText ? hooks.kpiText() : [];
        ctx.font = 'bold 11px Inter, Arial';
        v.forEach((t, i) => { ctx.fillStyle = t.color || '#38d39f'; ctx.fillText(t.text, x + 10 + (i % 2) * 125, y + 18 + Math.floor(i / 2) * 18); });
        break;
      }
      case 'desk':
        rr(x, y, w, h, 5, '#5a4e44', '#2b2622');
        screen(x + 12, y + 8, 40, 26);
        ctx.fillStyle = '#e9eef3'; ctx.fillRect(x + 66, y + 14, 30, 22);
        ctx.fillStyle = '#e4572e'; ctx.fillRect(x + 66, y + 14, 30, 5);
        break;
      default:
        break;
    }
  }

  function drawPerson(x, y, look, { walking = false, t = 0, dir = 1, name = null, scaleP = 1 } = {}) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * scaleP, scaleP);
    const bob = walking ? Math.sin(t * 12) * 2 : Math.sin(time * 2 + x) * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 12, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20252b';
    ctx.fillRect(-6, 4, 5, 9 + (walking ? Math.sin(t * 12) * 2 : 0)); ctx.fillRect(1, 4, 5, 9 - (walking ? Math.sin(t * 12) * 2 : 0));
    rr(-10, -12 + bob, 20, 20, 6, look.coat);
    ctx.fillStyle = '#d9e021'; ctx.fillRect(-10, -2 + bob, 20, 3);
    ctx.beginPath(); ctx.arc(0, -19 + bob, 8, 0, Math.PI * 2); ctx.fillStyle = look.skin || '#c68642'; ctx.fill();
    ctx.fillStyle = '#1b1b1b'; ctx.fillRect(2, -21 + bob, 2, 2);
    if (look.hat) { ctx.beginPath(); ctx.arc(0, -22 + bob, 8.5, Math.PI, 0); ctx.fillStyle = look.hat; ctx.fill(); ctx.fillRect(-10, -23 + bob, 20, 3); }
    else { ctx.beginPath(); ctx.arc(0, -22 + bob, 8, Math.PI, 0); ctx.fillStyle = look.hair || '#333'; ctx.fill(); }
    ctx.restore();
    if (name) {
      ctx.font = 'bold 11px Inter, Arial, sans-serif';
      const tw = ctx.measureText(name).width;
      rr(x - tw / 2 - 5, y - 46, tw + 10, 16, 4, 'rgba(10,14,18,.75)');
      ctx.fillStyle = '#fff'; ctx.fillText(name, x - tw / 2, y - 34);
    }
  }

  function drawForklift() {
    const { x, y } = forklift; const d = forklift.vx > 0 ? 1 : -1;
    ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
    rr(-22, -14, 34, 28, 4, '#f0b429', '#7a5a10');
    rr(-14, -10, 14, 20, 2, '#2b3138');
    ctx.fillStyle = '#8b939c'; ctx.fillRect(12, -10, 18, 4); ctx.fillRect(12, 6, 18, 4);
    ctx.fillStyle = '#16171a'; ctx.beginPath(); ctx.arc(22, -2, 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawMarker(s, st) {
    const c = stationCenter(s);
    const top = s.kind === 'npc' ? c.y - 52 : s.y - 10;
    const pulse = 1 + Math.sin(time * 5) * 0.12;
    ctx.save(); ctx.translate(c.x, top + Math.sin(time * 4) * 3); ctx.scale(pulse, pulse);
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fillStyle = st.done ? '#38d39f' : '#f0b429'; ctx.fill();
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#1b1b1b'; ctx.font = 'bold 14px Inter, Arial'; ctx.textAlign = 'center'; ctx.fillText(st.done ? '✓' : '!', 0, 5);
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#151a1f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, -cam.x * scale, -cam.y * scale);
    drawFloor(); drawConveyor(); drawWalls();
    const drawables = [];
    for (const s of STATIONS) drawables.push({ y: s.kind === 'npc' ? s.y : s.y + s.h, fn: () => (s.kind === 'npc' ? drawPerson(s.x, s.y, NPCS[s.npc], { dir: -1 }) : drawStation(s)) });
    walkers.forEach((w) => drawables.push({ y: w.y, fn: () => drawPerson(w.x, w.y, { coat: w.coat, hat: w.hat, skin: '#b07a4f' }, { walking: true, t: time, dir: 1 }) }));
    drawables.push({ y: forklift.y, fn: drawForklift });
    const look = AVATARS.find((a) => a.id === hooks.avatar()) || AVATARS[0];
    drawables.push({ y: player.y, fn: () => drawPerson(player.x, player.y, look, { walking: player.moving, t: player.t, dir: player.dir, name: hooks.playerName(), scaleP: 1.1 }) });
    drawables.sort((a, b) => a.y - b.y).forEach((d) => d.fn());
    // highlight nearest + task markers
    if (nearest) {
      const c = stationCenter(nearest);
      ctx.strokeStyle = 'rgba(91,192,235,.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
      if (nearest.kind === 'npc') { ctx.beginPath(); ctx.ellipse(c.x, c.y + 10, 22, 10, 0, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.strokeRect(nearest.x - 6, nearest.y - 6, nearest.w + 12, nearest.h + 12); }
      ctx.setLineDash([]);
    }
    for (const s of STATIONS) {
      const st = hooks.stationState(s.id);
      if (st && st.active) drawMarker(s, st);
    }
    if (player.target) {
      ctx.strokeStyle = 'rgba(91,192,235,.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(player.target.x, player.target.y, 8 + Math.sin(time * 8) * 2, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function frameLoop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt); draw();
    requestAnimationFrame(frameLoop);
  }

  // ---------- input ----------
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    const k = e.key.toLowerCase();
    if (paused) return;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); e.preventDefault(); }
    if ((k === 'e' || k === 'enter' || k === ' ') && nearest && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); hooks.onInteract(nearest.id); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', (e) => {
    if (paused) return;
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const wx = ((e.clientX - r.left) * dpr) / scale + cam.x; const wy = ((e.clientY - r.top) * dpr) / scale + cam.y;
    // tapping a station that is already in reach interacts with it
    const hit = STATIONS.find((s) => {
      const c = stationCenter(s);
      return s.kind === 'npc' ? Math.hypot(wx - c.x, wy - (c.y - 10)) < 24 : wx >= s.x && wx <= s.x + s.w && wy >= s.y && wy <= s.y + s.h;
    });
    if (hit && nearest && hit.id === nearest.id) { hooks.onInteract(hit.id); return; }
    if (hit) { const p = standPoint(hit); player.target = p; return; }
    player.target = { x: wx, y: wy };
  });
  window.addEventListener('resize', resize);

  return {
    start() { resize(); requestAnimationFrame((t) => { last = t; frameLoop(t); }); },
    setPaused(p) { paused = p; if (p) { keys.clear(); Object.keys(touch).forEach((k) => { touch[k] = false; }); player.target = null; } },
    touch,
    interact() { if (nearest && !paused) hooks.onInteract(nearest.id); },
    teleportTo(stationId) {
      const s = stationById[stationId];
      if (!s) return;
      const p = findFree(standPoint(s));
      player.x = p.x; player.y = p.y; player.target = null;
    },
    teleportArea(areaId) {
      const a = areaById[areaId];
      const p = findFree({ x: a.x + a.w / 2, y: a.door === 'bottom' ? a.y + a.h - 50 : a.y + 50 });
      player.x = p.x; player.y = p.y; player.target = null;
    },
    get position() { return { x: Math.round(player.x), y: Math.round(player.y) }; },
    setPosition(p) { if (p && !collides(p.x, p.y)) { player.x = p.x; player.y = p.y; } },
    resize,
  };
}
