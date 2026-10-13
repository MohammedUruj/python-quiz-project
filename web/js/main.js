// Entry point: title screen, character creation, and the game shell.

import { h, html, clear, $, closeTopModal, isModalOpen, toast, put } from './ui.js';
import { state } from './state.js';
import { AVATARS, portraitSVG, tyreSVG } from './art.js';
import { createWorld } from './world.js';
import { createGame } from './game.js';

state.load();

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== id; });
}

function titleScreen() {
  show('screen-title');
  $('#title-art').innerHTML = tyreSVG('none', { size: 150, label: 'Qualitrax tyre' });
  const actions = clear($('#title-actions'));
  if (state.hasSave()) {
    put(actions, 
      h('button', { class: 'btn primary big', onclick: startGame }, `Continue as ${state.player.name}`),
      h('button', { class: 'btn big', onclick: () => {
        if (window.confirm('Start a new game? Progress saved on this device will be replaced.')) { state.reset(); createScreen(); }
      } }, 'New game'));
  } else {
    put(actions, h('button', { class: 'btn primary big', onclick: createScreen }, 'Start your first shift'));
  }
  put(actions, h('a', { class: 'btn ghost', href: '/host' }, 'Trainer / host dashboard'));
}

function createScreen() {
  show('screen-create');
  let avatar = AVATARS[0].id;
  const form = $('#create-form');
  const grid = clear($('#avatar-grid'));
  AVATARS.forEach((a) => {
    const b = h('button', { type: 'button', class: 'avatar-opt', 'aria-pressed': String(a.id === avatar), 'aria-label': a.label, onclick: () => {
      avatar = a.id;
      grid.querySelectorAll('.avatar-opt').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    } }, html(portraitSVG(a, 76)));
    put(grid, b);
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) { form.elements.name.focus(); return; }
    state.setPlayer({ name: name.slice(0, 80), team: form.elements.team.value.trim().slice(0, 80), employeeId: form.elements.employeeId.value.trim().slice(0, 40), avatar });
    state.log(`${name} joined Qualitrax Tyres as Quality Improvement Engineer`);
    startGame();
  };
  setTimeout(() => form.elements.name.focus(), 50);
}

let started = false;
function startGame() {
  show('screen-game');
  if (started) return;
  started = true;
  const hud = {
    avatar: $('#hud-avatar'), name: $('#hud-name'), points: $('#hud-points'), badges: $('#hud-badges'),
    level: $('#hud-level'), levelBar: $('#hud-level-bar'), objective: $('#hud-objective'),
    overall: $('#hud-overall-bar'), overallLabel: $('#hud-overall-label'), prompt: $('#interact-prompt'),
  };
  let game;
  const world = createWorld($('#factory'), {
    stationState: (id) => game.stationState(id),
    onNearest: (s) => game.onNearest(s),
    onInteract: (id) => game.onInteract(id),
    avatar: () => state.player.avatar,
    playerName: () => state.player.name,
    kpiText: () => kpiText(),
  });
  game = createGame({ state, world, hud });
  world.start();
  if (state.data.position) world.setPosition(state.data.position);
  else world.setPosition({ x: 225, y: 520 });
  game.start();

  // buttons
  const bind = (id, fn) => $(id).addEventListener('click', fn);
  bind('#btn-log', game.showMissionLog); bind('#btn-evidence', game.showEvidence); bind('#btn-map', game.showMap);
  bind('#btn-kpi', game.showKpis); bind('#btn-badges', game.showBadges); bind('#btn-help', game.showHelp); bind('#btn-menu', game.showMenu);

  // keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'Escape') { closeTopModal(); return; }
    if (isModalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const map = { l: game.showMissionLog, i: game.showEvidence, m: game.showMap, k: game.showKpis, b: game.showBadges, h: game.showHelp };
    if (map[k]) { e.preventDefault(); map[k](); }
  });

  // touch controls
  document.querySelectorAll('[data-dir]').forEach((btn) => {
    const dir = btn.dataset.dir;
    const on = (e) => { e.preventDefault(); world.touch[dir] = true; btn.classList.add('active'); };
    const off = () => { world.touch[dir] = false; btn.classList.remove('active'); };
    btn.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, off));
  });
  $('#touch-interact').addEventListener('click', () => world.interact());

  // remember position
  setInterval(() => { state.data.position = world.position; try { localStorage.setItem('tqm-tyre-sim-save-v1', JSON.stringify(state.data)); } catch { /* ignore */ } }, 5000);

  fetch('/api/health').catch(() => toast('Offline mode: practice works, but the final assessment needs the server (python run.py).', 'warn', 6000));
}

function kpiText() {
  const k = state.kpi;
  const rr = ((k.rejected / k.inspected) * 100).toFixed(2);
  const fpy = (((k.inspected - k.rejected - k.reworked) / k.inspected) * 100).toFixed(1);
  return [
    { text: `REJECT ${rr}%`, color: rr > 4 ? '#ff7a59' : rr > 2.5 ? '#f0b429' : '#38d39f' },
    { text: `FPY ${fpy}%`, color: fpy < 90 ? '#f0b429' : '#38d39f' },
    { text: `REWORK ${((k.reworked / k.inspected) * 100).toFixed(1)}%`, color: '#9ad4f0' },
    { text: `COMPLAINTS ${k.complaints}`, color: k.complaints > 10 ? '#ff7a59' : '#38d39f' },
  ];
}

titleScreen();
