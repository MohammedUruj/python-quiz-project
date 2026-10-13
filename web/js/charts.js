// SVG chart builders. Return SVG markup strings built only from numbers and
// developer-authored labels (escaped), styled by classes in style.css.

import { pareto as paretoCalc, round } from './stats.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function frame(w, h, inner, title) {
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title || 'chart')}" preserveAspectRatio="xMidYMid meet">${title ? `<title>${esc(title)}</title>` : ''}${inner}</svg>`;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.6, 2, 2.4, 4, 6, 8, 10]) if (m * p >= v) return m * p; // quarters stay round
  return 10 * p;
}

/** Pareto chart: sorted bars + cumulative % line + 80% reference. `rows` are raw {label,value}. */
export function paretoSVG(rows, { title = 'Pareto chart', sorted = true, highlight = -1, showCumulative = true } = {}) {
  const data = sorted ? paretoCalc(rows) : rows.map((r) => ({ ...r }));
  const W = 640; const H = 330; const L = 52; const R = 52; const T = 20; const B = 78;
  if (!data.length) return frame(W, H, `<rect class="ch-baseline" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/><text class="ch-axlabel" x="${W / 2}" y="${H / 2 - 20}" text-anchor="middle">Click the largest category to start building the chart</text>`, title);
  const pw = W - L - R; const ph = H - T - B;
  const total = data.reduce((a, r) => a + r.value, 0);
  const maxV = niceMax(Math.max(total * (sorted ? 1 : 0), ...data.map((r) => r.value)));
  const bw = pw / Math.max(1, data.length);
  let s = '';
  for (let i = 0; i <= 4; i++) {
    const y = T + ph - (ph * i) / 4;
    s += `<line class="ch-grid" x1="${L}" x2="${L + pw}" y1="${y}" y2="${y}"/><text class="ch-tick" x="${L - 6}" y="${y + 4}" text-anchor="end">${round((maxV * i) / 4, maxV < 10 ? 1 : 0)}</text>`;
    if (sorted && showCumulative) s += `<text class="ch-tick" x="${L + pw + 6}" y="${y + 4}">${25 * i}%</text>`;
  }
  data.forEach((r, i) => {
    const bh = (r.value / maxV) * ph;
    const x = L + i * bw + bw * 0.12;
    s += `<rect class="ch-bar ${i === highlight ? 'hl' : ''}" x="${x}" y="${T + ph - bh}" width="${bw * 0.76}" height="${bh}"><title>${esc(r.label)}: ${r.value}</title></rect>`;
    s += `<text class="ch-val" x="${x + bw * 0.38}" y="${T + ph - bh - 4}" text-anchor="middle">${r.value}</text>`;
    s += `<text class="ch-cat" transform="translate(${x + bw * 0.38},${T + ph + 12}) rotate(30)">${esc(r.label)}</text>`;
  });
  if (sorted && showCumulative) {
    const y80 = T + ph - ph * 0.8;
    s += `<line class="ch-ref" x1="${L}" x2="${L + pw}" y1="${y80}" y2="${y80}"/><text class="ch-reflabel" x="${L + pw - 4}" y="${y80 - 4}" text-anchor="end">80%</text>`;
    const pts = data.map((r, i) => `${L + i * bw + bw / 2},${T + ph - (r.cumulative / 100) * ph}`);
    s += `<polyline class="ch-line" points="${pts.join(' ')}"/>`;
    data.forEach((r, i) => {
      s += `<circle class="ch-dot" cx="${L + i * bw + bw / 2}" cy="${T + ph - (r.cumulative / 100) * ph}" r="3.5"><title>Cumulative ${round(r.cumulative, 1)}%</title></circle>`;
    });
  }
  s += `<line class="ch-axis" x1="${L}" x2="${L}" y1="${T}" y2="${T + ph}"/><line class="ch-axis" x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}"/>`;
  s += `<text class="ch-axlabel" transform="translate(14,${T + ph / 2}) rotate(-90)" text-anchor="middle">Defect count</text>`;
  if (sorted && showCumulative) s += `<text class="ch-axlabel" transform="translate(${W - 8},${T + ph / 2}) rotate(90)" text-anchor="middle">Cumulative %</text>`;
  return frame(W, H, s, title);
}

/** Histogram with optional spec limits and mean marker. bins: [{lo,hi,count}] */
export function histogramSVG(bins, { title = 'Histogram', lsl = null, usl = null, mean = null, unit = '' } = {}) {
  const W = 640; const H = 300; const L = 44; const R = 16; const T = 26; const B = 46;
  const pw = W - L - R; const ph = H - T - B;
  const lo = Math.min(bins[0].lo, lsl ?? Infinity) - (bins[0].hi - bins[0].lo);
  const hi = Math.max(bins[bins.length - 1].hi, usl ?? -Infinity) + (bins[0].hi - bins[0].lo);
  const xOf = (v) => L + ((v - lo) / (hi - lo)) * pw;
  const maxC = niceMax(Math.max(...bins.map((b) => b.count)));
  let s = '';
  for (let i = 0; i <= 4; i++) {
    const y = T + ph - (ph * i) / 4;
    s += `<line class="ch-grid" x1="${L}" x2="${L + pw}" y1="${y}" y2="${y}"/><text class="ch-tick" x="${L - 6}" y="${y + 4}" text-anchor="end">${round((maxC * i) / 4, maxC < 10 ? 1 : 0)}</text>`;
  }
  bins.forEach((b) => {
    const bh = (b.count / maxC) * ph;
    s += `<rect class="ch-bar" x="${xOf(b.lo) + 1}" y="${T + ph - bh}" width="${Math.max(1, xOf(b.hi) - xOf(b.lo) - 2)}" height="${bh}"><title>${round(b.lo, 2)}–${round(b.hi, 2)} ${esc(unit)}: ${b.count}</title></rect>`;
  });
  const ticks = bins.map((b) => b.lo).concat(bins[bins.length - 1].hi);
  ticks.forEach((t, i) => { if (i % 2 === 0) s += `<text class="ch-tick" x="${xOf(t)}" y="${T + ph + 16}" text-anchor="middle">${round(t, 1)}</text>`; });
  const vline = (v, cls, label) => `<line class="${cls}" x1="${xOf(v)}" x2="${xOf(v)}" y1="${T - 6}" y2="${T + ph}"/><text class="${cls}-label" x="${xOf(v)}" y="${T - 10}" text-anchor="middle">${esc(label)}</text>`;
  if (lsl != null) s += vline(lsl, 'ch-spec', `LSL ${lsl}`);
  if (usl != null) s += vline(usl, 'ch-spec', `USL ${usl}`);
  if (mean != null) s += vline(mean, 'ch-mean', `mean ${round(mean, 2)}`);
  s += `<line class="ch-axis" x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}"/>`;
  s += `<text class="ch-axlabel" x="${L + pw / 2}" y="${H - 6}" text-anchor="middle">${esc(unit)}</text>`;
  return frame(W, H, s, title);
}

/** Individuals control chart. limits {cl,ucl,lcl}; signals [{index}] are highlighted. */
export function controlSVG(points, limits, { title = 'Control chart', signals = [], baseline = null, lsl = null, usl = null, unit = '' } = {}) {
  const W = 640; const H = 300; const L = 52; const R = 70; const T = 18; const B = 36;
  const pw = W - L - R; const ph = H - T - B;
  const vals = [...points, limits.ucl, limits.lcl, lsl ?? limits.cl, usl ?? limits.cl];
  const span = Math.max(...vals) - Math.min(...vals);
  const lo = Math.min(...vals) - span * 0.08; const hi = Math.max(...vals) + span * 0.08;
  const yOf = (v) => T + ph - ((v - lo) / (hi - lo)) * ph;
  const xOf = (i) => L + (points.length === 1 ? pw / 2 : (i / (points.length - 1)) * pw);
  const sig = new Set(signals.map((x) => x.index));
  let s = '';
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    s += `<text class="ch-tick" x="${L - 6}" y="${yOf(v) + 4}" text-anchor="end">${round(v, 1)}</text>`;
  }
  if (baseline) s += `<rect class="ch-baseline" x="${L}" y="${T}" width="${xOf(baseline - 1) - L}" height="${ph}"/><text class="ch-tick" x="${L + 4}" y="${T + 12}">baseline used for limits</text>`;
  const hline = (v, cls, label) => `<line class="${cls}" x1="${L}" x2="${L + pw}" y1="${yOf(v)}" y2="${yOf(v)}"/><text class="${cls}-label" x="${L + pw + 4}" y="${yOf(v) + 4}">${esc(label)}</text>`;
  s += hline(limits.ucl, 'ch-limit', `UCL ${round(limits.ucl, 2)}`);
  s += hline(limits.cl, 'ch-center', `CL ${round(limits.cl, 2)}`);
  s += hline(limits.lcl, 'ch-limit', `LCL ${round(limits.lcl, 2)}`);
  if (lsl != null) s += hline(lsl, 'ch-spec', `LSL ${lsl}`);
  if (usl != null) s += hline(usl, 'ch-spec', `USL ${usl}`);
  s += `<polyline class="ch-line thin" points="${points.map((p, i) => `${xOf(i)},${yOf(p)}`).join(' ')}"/>`;
  points.forEach((p, i) => {
    s += `<circle class="ch-point ${sig.has(i) ? 'signal' : ''}" cx="${xOf(i)}" cy="${yOf(p)}" r="${sig.has(i) ? 5 : 3.5}"><title>#${i + 1}: ${p} ${esc(unit)}</title></circle>`;
    if ((i + 1) % 5 === 0 || i === 0) s += `<text class="ch-tick" x="${xOf(i)}" y="${T + ph + 16}" text-anchor="middle">${i + 1}</text>`;
  });
  s += `<line class="ch-axis" x1="${L}" x2="${L}" y1="${T}" y2="${T + ph}"/><line class="ch-axis" x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}"/>`;
  s += `<text class="ch-axlabel" x="${L + pw / 2}" y="${H - 4}" text-anchor="middle">Sample number (time order)</text>`;
  return frame(W, H, s, title);
}

/** Grouped before/after bars. groups: [{label, before, after, unit, lowerIsBetter}] normalised per group. */
export function compareSVG(groups, { title = 'Before and after', beforeLabel = 'Before', afterLabel = 'After' } = {}) {
  const W = 640; const rowH = 46; const H = 40 + groups.length * rowH; const L = 170; const R = 80;
  const pw = W - L - R;
  let s = `<rect class="ch-bar before" x="${L}" y="8" width="12" height="10"/><text class="ch-tick" x="${L + 16}" y="17">${esc(beforeLabel)}</text>`;
  s += `<rect class="ch-bar after" x="${L + 110}" y="8" width="12" height="10"/><text class="ch-tick" x="${L + 126}" y="17">${esc(afterLabel)}</text>`;
  groups.forEach((g, i) => {
    const y = 32 + i * rowH;
    const m = Math.max(g.before, g.after, 1e-9) * 1.1;
    const better = g.lowerIsBetter ? g.after < g.before : g.after > g.before;
    const same = Math.abs(g.after - g.before) < 1e-9;
    s += `<text class="ch-cat" x="${L - 8}" y="${y + 18}" text-anchor="end">${esc(g.label)}</text>`;
    s += `<rect class="ch-bar before" x="${L}" y="${y}" width="${(g.before / m) * pw}" height="14"/><text class="ch-val" x="${L + (g.before / m) * pw + 4}" y="${y + 11}">${g.before}${esc(g.unit || '')}</text>`;
    s += `<rect class="ch-bar after ${same ? '' : better ? 'good' : 'bad'}" x="${L}" y="${y + 17}" width="${(g.after / m) * pw}" height="14"/><text class="ch-val" x="${L + (g.after / m) * pw + 4}" y="${y + 28}">${g.after}${esc(g.unit || '')}</text>`;
  });
  return frame(W, H, s, title);
}

/** Simple multi-week line chart. series: [{label, values, cls}] */
export function lineSVG(series, { title = 'Trend', labels = [], unit = '%', target = null } = {}) {
  const W = 640; const H = 260; const L = 46; const R = 20; const T = 18; const B = 40;
  const pw = W - L - R; const ph = H - T - B;
  const all = series.flatMap((s) => s.values).concat(target ?? []);
  const maxV = niceMax(Math.max(...all));
  const n = Math.max(...series.map((s) => s.values.length));
  const xOf = (i) => L + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
  const yOf = (v) => T + ph - (v / maxV) * ph;
  let s = '';
  for (let i = 0; i <= 4; i++) {
    const v = (maxV * i) / 4;
    s += `<line class="ch-grid" x1="${L}" x2="${L + pw}" y1="${yOf(v)}" y2="${yOf(v)}"/><text class="ch-tick" x="${L - 6}" y="${yOf(v) + 4}" text-anchor="end">${round(v, 1)}${esc(unit)}</text>`;
  }
  if (target != null) s += `<line class="ch-ref" x1="${L}" x2="${L + pw}" y1="${yOf(target)}" y2="${yOf(target)}"/><text class="ch-reflabel" x="${L + pw - 4}" y="${yOf(target) - 4}" text-anchor="end">target ${target}${esc(unit)}</text>`;
  labels.forEach((lb, i) => { s += `<text class="ch-tick" x="${xOf(i)}" y="${T + ph + 16}" text-anchor="middle">${esc(lb)}</text>`; });
  series.forEach((ser, i) => { // legend
    s += `<line class="ch-line ${ser.cls || ''}" x1="${L + 8 + i * 150}" x2="${L + 30 + i * 150}" y1="${T + 6}" y2="${T + 6}"/><text class="ch-tick" x="${L + 36 + i * 150}" y="${T + 10}">${esc(ser.label)}</text>`;
  });
  series.forEach((ser) => {
    s += `<polyline class="ch-line ${ser.cls || ''}" points="${ser.values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')}"/>`;
    ser.values.forEach((v, i) => { s += `<circle class="ch-dot ${ser.cls || ''}" cx="${xOf(i)}" cy="${yOf(v)}" r="3.5"><title>${esc(labels[i] || i + 1)}: ${v}${esc(unit)}</title></circle>`; });
  });
  s += `<line class="ch-axis" x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}"/>`;
  return frame(W, H, s, title);
}

/** Scatter diagram. pts: [[x,y]] */
export function scatterSVG(pts, { title = 'Scatter diagram', xLabel = '', yLabel = '' } = {}) {
  const W = 640; const H = 280; const L = 52; const R = 16; const T = 14; const B = 44;
  const pw = W - L - R; const ph = H - T - B;
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs); const y1 = niceMax(Math.max(...ys));
  const xOf = (v) => L + ((v - x0) / (x1 - x0 || 1)) * pw;
  const yOf = (v) => T + ph - (v / y1) * ph;
  let s = '';
  for (let i = 0; i <= 4; i++) s += `<line class="ch-grid" x1="${L}" x2="${L + pw}" y1="${yOf((y1 * i) / 4)}" y2="${yOf((y1 * i) / 4)}"/><text class="ch-tick" x="${L - 6}" y="${yOf((y1 * i) / 4) + 4}" text-anchor="end">${round((y1 * i) / 4, 1)}</text>`;
  pts.forEach(([x, y]) => { s += `<circle class="ch-point" cx="${xOf(x)}" cy="${yOf(y)}" r="4"><title>${x}, ${y}</title></circle>`; });
  s += `<text class="ch-tick" x="${L}" y="${T + ph + 16}">${round(x0, 1)}</text><text class="ch-tick" x="${L + pw}" y="${T + ph + 16}" text-anchor="end">${round(x1, 1)}</text>`;
  s += `<line class="ch-axis" x1="${L}" x2="${L}" y1="${T}" y2="${T + ph}"/><line class="ch-axis" x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}"/>`;
  s += `<text class="ch-axlabel" x="${L + pw / 2}" y="${H - 6}" text-anchor="middle">${esc(xLabel)}</text>`;
  s += `<text class="ch-axlabel" transform="translate(14,${T + ph / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`;
  return frame(W, H, s, title);
}
