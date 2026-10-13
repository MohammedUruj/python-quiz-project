// Pure statistics helpers used by the game (no DOM). Tested in tests/js/stats.test.mjs.

export function sum(xs) { return xs.reduce((a, b) => a + b, 0); }

export function mean(xs) { return xs.length ? sum(xs) / xs.length : 0; }

/** Sample standard deviation (n - 1). */
export function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

export function round(x, dp = 1) {
  const f = 10 ** dp;
  return Math.round((x + Number.EPSILON) * f) / f;
}

export function pct(part, whole, dp = 1) { return whole ? round((part / whole) * 100, dp) : 0; }

/**
 * Pareto analysis: sort categories descending (stable, ties keep input order) and add
 * share and cumulative percentage. Input: [{label, value}].
 */
export function pareto(items) {
  const total = sum(items.map((i) => i.value));
  const sorted = items.map((i, idx) => ({ ...i, idx }))
    .sort((a, b) => b.value - a.value || a.idx - b.idx);
  let running = 0;
  return sorted.map(({ idx, ...i }) => {
    running += i.value;
    return { ...i, share: total ? (i.value / total) * 100 : 0, cumulative: total ? (running / total) * 100 : 0 };
  });
}

/** Categories needed to reach `threshold` % of the total (the "vital few"). */
export function vitalFew(paretoRows, threshold = 80) {
  const out = [];
  for (const r of paretoRows) {
    out.push(r);
    if (r.cumulative >= threshold - 1e-9) break;
  }
  return out;
}

/** Histogram with equal-width bins from `start` with width `width`. */
export function histogram(xs, start, width, binCount) {
  const bins = Array.from({ length: binCount }, (_, i) => ({ lo: start + i * width, hi: start + (i + 1) * width, count: 0 }));
  for (const x of xs) {
    let i = Math.floor((x - start) / width);
    if (i < 0) i = 0;
    if (i >= binCount) i = binCount - 1;
    bins[i].count += 1;
  }
  return bins;
}

export function movingRanges(xs) {
  const mr = [];
  for (let i = 1; i < xs.length; i++) mr.push(Math.abs(xs[i] - xs[i - 1]));
  return mr;
}

/** d2 constant for moving ranges of 2 consecutive points. */
export const D2_N2 = 1.128;

/**
 * Individuals (I-MR) control limits computed from a baseline (phase I) window.
 * UCL/LCL = mean +/- 2.66 * MRbar, which is mean +/- 3 * (MRbar / 1.128).
 */
export function individualsLimits(xs, baselineCount = xs.length) {
  const base = xs.slice(0, baselineCount);
  const cl = mean(base);
  const mrBar = mean(movingRanges(base));
  const sigma = mrBar / D2_N2;
  return { cl, ucl: cl + 3 * sigma, lcl: cl - 3 * sigma, sigma, mrBar };
}

/**
 * Signals on an individuals chart:
 *  rule 1 - a point beyond a control limit;
 *  run rule - 8 consecutive points on the same side of the centre line (Western Electric rule 4).
 * Returns [{index, rule}] using 0-based indexes; for a run the index of the 8th point onward.
 */
export function controlSignals(xs, limits) {
  const out = [];
  let side = 0;
  let run = 0;
  xs.forEach((x, i) => {
    if (x > limits.ucl || x < limits.lcl) out.push({ index: i, rule: 'beyond' });
    const s = x > limits.cl ? 1 : x < limits.cl ? -1 : 0;
    if (s !== 0 && s === side) run += 1; else { side = s; run = s === 0 ? 0 : 1; }
    if (run >= 8) out.push({ index: i, rule: 'run8' });
  });
  return out;
}

/**
 * Capability indices using within-process sigma (from moving ranges).
 * Either spec limit may be null for a one-sided specification.
 */
export function capability(xs, lsl, usl) {
  const m = mean(xs);
  const sigma = mean(movingRanges(xs)) / D2_N2;
  const cpu = usl == null ? null : (usl - m) / (3 * sigma);
  const cpl = lsl == null ? null : (m - lsl) / (3 * sigma);
  const cp = usl != null && lsl != null ? (usl - lsl) / (6 * sigma) : null;
  const cpk = Math.min(...[cpu, cpl].filter((v) => v != null));
  return { mean: m, sigma, cp, cpk, cpu, cpl };
}

export function outOfSpec(xs, lsl, usl) {
  return xs.filter((x) => (lsl != null && x < lsl) || (usl != null && x > usl)).length;
}

/** Deterministic PRNG so the "fictional data" is identical for every participant. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalSeries(seed, n, mu, sd) {
  const rand = mulberry32(seed);
  const out = [];
  while (out.length < n) {
    const u = Math.max(rand(), 1e-12);
    const v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    out.push(mu + sd * r * Math.cos(2 * Math.PI * v));
    if (out.length < n) out.push(mu + sd * r * Math.sin(2 * Math.PI * v));
  }
  return out.map((x) => round(x, 2));
}

/** Rate helpers (fictional KPI definitions shown to players). */
export function rejectionRate(rejected, inspected) { return pct(rejected, inspected, 2); }

/** FPY: units passing first time with no rework or rejection / units entering. Numerator is a subset of the denominator. */
export function firstPassYield(entering, rejected, reworked) {
  const firstPass = Math.max(0, entering - rejected - reworked);
  return pct(firstPass, entering, 2);
}
