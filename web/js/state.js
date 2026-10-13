// Game state: player profile, level progress, practice points, badges, evidence and KPIs.
// Saved in the browser's localStorage so a participant can close the tab and continue later.

import { rejectionRate, firstPassYield } from './stats.js';

const SAVE_KEY = 'tqm-tyre-sim-save-v1';

export const BASELINE_KPI = {
  inspected: 12000, // tyres entering final inspection per week (fictional)
  rejected: 588, // tyres scrapped / rejected at final inspection per week
  reworked: 744, // tyres that needed rework before passing
  complaints: 14, // customer complaints per month
  confidence: 62, // simulated customer confidence index (0-100)
  project: 'Not started',
};

export function kpiView(k) {
  return {
    rejectionRate: rejectionRate(k.rejected, k.inspected),
    fpy: firstPassYield(k.inspected, k.rejected, k.reworked),
    reworkRate: rejectionRate(k.reworked, k.inspected),
    output: k.inspected - k.rejected,
    complaints: k.complaints,
    confidence: k.confidence,
    project: k.project,
  };
}

function fresh() {
  return {
    version: 1,
    createdAt: Date.now(),
    player: null, // {name, team, employeeId, avatar}
    levels: {}, // id -> {status, tasks: {taskId: {best, max, attempts, done}}, completedAt}
    badges: [],
    inventory: [],
    evidence: [],
    log: [],
    kpi: { ...BASELINE_KPI },
    kpiHistory: [{ label: 'Baseline', ...BASELINE_KPI }],
    position: null,
    quiz: null, // {submissionId, startedAt, questions, answers, index, result}
    flags: {},
  };
}

class GameState {
  constructor() { this.data = fresh(); this.listeners = new Set(); }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) this.data = { ...fresh(), ...parsed };
      }
    } catch { /* storage unavailable: play continues without saving */ }
    return this;
  }

  hasSave() { return !!(this.data.player && this.data.player.name); }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
    this.listeners.forEach((fn) => fn(this));
  }

  reset() { this.data = fresh(); this.save(); }

  onChange(fn) { this.listeners.add(fn); }

  // ----- player -----
  setPlayer(p) { this.data.player = p; this.save(); }
  get player() { return this.data.player; }

  // ----- levels & tasks -----
  level(id) {
    if (!this.data.levels[id]) this.data.levels[id] = { status: 'locked', tasks: {} };
    return this.data.levels[id];
  }

  levelStatus(id) { return this.level(id).status; }

  setLevelStatus(id, status) {
    const lv = this.level(id);
    lv.status = status;
    if (status === 'complete' && !lv.completedAt) lv.completedAt = Date.now();
    this.save();
  }

  task(levelId, taskId) {
    const lv = this.level(levelId);
    if (!lv.tasks[taskId]) lv.tasks[taskId] = { best: 0, max: 0, attempts: 0, done: false };
    return lv.tasks[taskId];
  }

  /** Record an attempt. Practice points keep the best score per task, so replays never lose points. */
  recordTask(levelId, taskId, { points, max, summary }) {
    const t = this.task(levelId, taskId);
    const firstCompletion = !t.done;
    t.attempts += 1;
    t.max = max;
    const gained = Math.max(0, points - t.best);
    t.best = Math.max(t.best, points);
    t.done = true;
    if (summary) t.summary = summary;
    this.save();
    return { gained, firstCompletion };
  }

  levelScore(levelId) {
    const lv = this.level(levelId);
    let best = 0; let max = 0;
    Object.values(lv.tasks).forEach((t) => { best += t.best; max += t.max; });
    return { best, max };
  }

  get points() {
    return Object.keys(this.data.levels).reduce((acc, id) => acc + this.levelScore(id).best, 0);
  }

  // ----- rewards & evidence -----
  addBadge(name) {
    if (!this.data.badges.includes(name)) { this.data.badges.push(name); this.save(); return true; }
    return false;
  }

  addInventory(item) {
    if (!this.data.inventory.find((i) => i.id === item.id)) { this.data.inventory.push(item); this.save(); }
  }

  addEvidence(item) {
    if (!this.data.evidence.find((e) => e.id === item.id)) {
      this.data.evidence.push({ ...item, at: Date.now() });
      this.save();
      return true;
    }
    return false;
  }

  hasEvidence(id) { return this.data.evidence.some((e) => e.id === id); }

  log(text) {
    this.data.log.unshift({ at: Date.now(), text });
    this.data.log = this.data.log.slice(0, 80);
    this.save();
  }

  // ----- KPIs -----
  get kpi() { return this.data.kpi; }

  updateKpi(label, mutate) {
    const k = { ...this.data.kpi };
    mutate(k);
    k.rejected = Math.max(0, Math.round(k.rejected));
    k.reworked = Math.max(0, Math.round(k.reworked));
    k.complaints = Math.max(0, Math.round(k.complaints));
    k.confidence = Math.max(0, Math.min(100, Math.round(k.confidence)));
    this.data.kpi = k;
    this.data.kpiHistory = this.data.kpiHistory.filter((h) => h.label !== label);
    this.data.kpiHistory.push({ label, ...k });
    this.save();
  }

  flag(name, value) {
    if (value === undefined) return this.data.flags[name];
    this.data.flags[name] = value;
    this.save();
    return value;
  }
}

export const state = new GameState();
