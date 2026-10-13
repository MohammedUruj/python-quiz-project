import { h, clear, put } from '../ui.js';
import { decisionSequence } from '../activities.js';
import { paretoSVG, histogramSVG, controlSVG } from '../charts.js';
import { pareto, vitalFew, round, histogram, individualsLimits, controlSignals, capability, outOfSpec, mean } from '../stats.js';
import { DEFECT_DATASETS, CHECK_RECORDS, CHECK_PRESSES, CHECK_DEFECTS, PROCESS_DATA } from '../data.js';

export const TOOLS = [
  { id: 'check', name: 'Check sheet', does: 'Structured form for recording data at the point of observation.', when: 'Collecting defect counts by type, location, shift or machine.', cannot: 'Explain why defects occur; it only records what was seen.' },
  { id: 'pareto', name: 'Pareto chart', does: 'Ranks categories by frequency or cost, with a cumulative % line.', when: 'Choosing which problem to tackle first (the "vital few").', cannot: 'Identify the cause of any category.' },
  { id: 'fishbone', name: 'Cause-and-effect diagram', does: 'Organises potential causes of an effect into categories (6M).', when: 'Structured brainstorming before collecting evidence.', cannot: 'Prove which cause is real; entries are hypotheses.' },
  { id: 'histogram', name: 'Histogram', does: 'Shows the distribution (centre, spread, shape) of measurements.', when: 'Comparing a measured characteristic with its specification.', cannot: 'Show changes over time or whether the process is stable.' },
  { id: 'control', name: 'Control chart', does: 'Plots data in time order with control limits calculated from the process.', when: 'Judging whether a process is stable or has special-cause signals.', cannot: 'Tell you whether the output meets specification, or what the special cause is.' },
  { id: 'scatter', name: 'Scatter diagram', does: 'Plots pairs of variables to reveal a possible relationship.', when: 'Exploring whether a process variable relates to an outcome.', cannot: 'Prove causation: correlation may be coincidental or driven by a third factor.' },
  { id: 'strat', name: 'Stratification', does: 'Separates data into meaningful groups (machine, shift, batch).', when: 'Finding where a problem is concentrated.', cannot: 'Explain the mechanism; it shows where to look.' },
];

function toolCards() {
  return h('details', { class: 'tool-ref' }, h('summary', null, 'Open the 7 QC tools reference cards'),
    h('div', { class: 'tool-cards' }, TOOLS.map((t) => h('div', { class: 'tool-card' }, h('h4', null, t.name), h('p', null, h('b', null, 'Does: '), t.does), h('p', null, h('b', null, 'Use when: '), t.when), h('p', { class: 'warn-text' }, h('b', null, 'Cannot: '), t.cannot)))),
    h('p', { class: 'muted small' }, 'Note: some training conventions list a flowchart (or "graphs") in place of stratification. This course uses stratification.'));
}

function toolStep(prompt, correctId, why) {
  return {
    prompt,
    options: TOOLS.map((t) => ({
      text: t.name,
      correct: t.id === correctId,
      feedback: t.id === correctId ? `${why} Remember its limit: it cannot ${t.cannot.charAt(0).toLowerCase()}${t.cannot.slice(1)}` : `${t.name} ${t.does.charAt(0).toLowerCase()}${t.does.slice(1)} That does not answer this question.`,
    })),
    points: 6,
    keepOrder: true,
  };
}

// ---------- Activity A: stratified check sheet ----------
function checkSheet(ctx) {
  const counts = {}; CHECK_PRESSES.forEach((p) => { counts[p] = {}; CHECK_DEFECTS.forEach((d) => { counts[p][d] = 0; }); });
  let idx = 0; let mistakes = 0;
  const recBox = h('div', { class: 'record-card', 'aria-live': 'polite' });
  const fb = h('div', { class: 'feedback' });
  const table = h('table', { class: 'check-sheet' });
  const tally = (n) => [...Array(Math.floor(n / 5))].map(() => h('s', { class: 'five' }, '||||')).concat(n % 5 ? ['|'.repeat(n % 5)] : []);
  const renderTable = () => {
    put(clear(table), 
      h('thead', null, h('tr', null, h('th', null, 'Defect ↓ / Press →'), CHECK_PRESSES.map((p) => h('th', null, p)), h('th', null, 'Total'))),
      h('tbody', null, CHECK_DEFECTS.map((d) => h('tr', null, h('th', null, d),
        CHECK_PRESSES.map((p) => h('td', null, h('button', { class: 'cell-btn', 'aria-label': `Record ${d} on ${p}`, disabled: idx >= CHECK_RECORDS.length, onclick: () => mark(p, d) }, h('span', { class: 'tally' }, tally(counts[p][d])), h('span', { class: 'n' }, counts[p][d] || '')))),
        h('td', { class: 'num' }, String(CHECK_PRESSES.reduce((a, p) => a + counts[p][d], 0)))))),
      h('tfoot', null, h('tr', null, h('th', null, 'Total'), CHECK_PRESSES.map((p) => h('td', { class: 'num' }, String(CHECK_DEFECTS.reduce((a, d) => a + counts[p][d], 0)))), h('td', { class: 'num' }, String(idx)))));
  };
  const renderRec = () => {
    if (idx >= CHECK_RECORDS.length) { put(clear(recBox), h('b', null, 'All 24 records tallied.')); return; }
    const r = CHECK_RECORDS[idx];
    put(clear(recBox), h('span', { class: 'muted' }, `Record ${idx + 1} of ${CHECK_RECORDS.length}`), h('div', { class: 'rec' }, h('b', null, r.id), ` · ${r.press} · Shift ${r.shift} · Defect: `, h('b', null, r.defect)));
  };
  const mark = (p, d) => {
    const r = CHECK_RECORDS[idx];
    if (r.press === p && r.defect === d) {
      counts[p][d] += 1; idx += 1; fb.className = 'feedback'; fb.textContent = '';
      renderTable(); renderRec();
      if (idx === CHECK_RECORDS.length) finishSheet();
    } else {
      mistakes += 1;
      fb.className = 'feedback bad'; fb.textContent = `Not recorded: record ${r.id} is "${r.defect}" on ${r.press}. Find that row and column.`;
    }
  };
  const finishSheet = () => {
    const p4b = counts['Press 4'].Blister;
    const totalB = CHECK_PRESSES.reduce((a, p) => a + counts[p].Blister, 0);
    const shifts = { A: 0, B: 0, C: 0 };
    CHECK_RECORDS.filter((r) => r.press === 'Press 4' && r.defect === 'Blister').forEach((r) => { shifts[r.shift] += 1; });
    const q = h('div');
    put(ctx.body, q);
    q.scrollIntoView({ behavior: 'smooth', block: 'start' });
    decisionSequence(q, [
      {
        title: 'Read your check sheet',
        prompt: 'What does your stratified check sheet show?',
        options: [
          { text: `Press 4 accounts for ${p4b} of ${totalB} blisters in this sample, so blisters appear concentrated on Press 4`, correct: true, feedback: `Correct: ${p4b}/${totalB} = ${round((p4b / totalB) * 100, 0)}%. Stratifying by press reveals a pattern hidden in the combined count. It shows where to look, not why.` },
          { text: 'Blisters are spread evenly across the three presses', correct: false, feedback: 'Count the Blister row again, column by column.' },
          { text: 'The check sheet proves Press 4 is the root cause of the blisters', correct: false, feedback: 'A check sheet records what happened; it cannot prove cause. It tells you where to investigate.' },
        ],
        points: 8,
      },
      {
        prompt: `The Press 4 blisters by shift are A: ${shifts.A}, B: ${shifts.B}, C (night): ${shifts.C}. What does this suggest about the operator's claim that "night shift does worse"?`,
        options: [
          { text: 'It confirms night shift is the problem', correct: false, feedback: 'Night shift has a similar count to the other shifts in this sample.' },
          { text: 'This sample does not support the claim: Press 4 blisters occur on all shifts at a similar level', correct: true, feedback: 'Right. A cause common to all shifts (equipment, material or method) is more likely. The sample is small, so keep watching the full data.' },
          { text: 'Shift data is irrelevant to quality', correct: false, feedback: 'Shift is a classic stratification factor. Here it helps rule out a people-based explanation.' },
        ],
        points: 8,
      },
    ], (r) => {
      ctx.evidence({ id: 'l2-checksheet', title: 'Check sheet: blisters concentrated on Press 4', text: `Sample of 24 records: ${p4b} of ${totalB} blisters on Press 4; similar across shifts A/B/C (${shifts.A}/${shifts.B}/${shifts.C}).` });
      const sheetPts = Math.max(0, 24 - mistakes * 2);
      ctx.finish({ points: sheetPts + r.points, max: 24 + r.max });
    });
  };
  renderTable(); renderRec();
  put(ctx.body, 
    h('p', null, 'Mei hands you today\'s 24 reject records. Record each one by clicking the correct cell (defect row × press column). The check sheet is stratified by press, so you can see where defects occur as you collect.'),
    recBox, fb, h('div', { class: 'table-wrap' }, table));
}

// ---------- Activity C: Pareto builder ----------
function paretoBuilder(ctx) {
  const ds = DEFECT_DATASETS.sep_all;
  const order = [];
  let mistakes = 0;
  const chartBox = h('div', { class: 'chart-box' });
  const fb = h('div', { class: 'feedback' });
  const pool = h('div', { class: 'chips wrap' });
  const renderChart = (rows, sorted, title) => { chartBox.innerHTML = paretoSVG(rows, { sorted, title }); };
  const remaining = () => ds.rows.filter((r) => !order.includes(r.label));
  const renderPool = () => {
    put(clear(pool), remaining().map((r) => h('button', { class: 'chip big', onclick: () => pick(r) }, `${r.label} (${r.value})`)));
  };
  const pick = (r) => {
    const maxLeft = Math.max(...remaining().map((x) => x.value));
    if (r.value !== maxLeft) {
      mistakes += 1;
      fb.className = 'feedback bad'; fb.textContent = `${r.label} (${r.value}) is not the largest remaining category. A Pareto chart sorts from largest to smallest.`;
      return;
    }
    order.push(r.label);
    fb.className = 'feedback'; fb.textContent = '';
    const built = order.map((l) => ds.rows.find((x) => x.label === l));
    renderChart(built, false, 'Your Pareto chart (in progress)');
    renderPool();
    if (!remaining().length) analyse();
  };
  const analyse = () => {
    const p = pareto(ds.rows);
    renderChart(ds.rows, true, `Pareto chart: ${ds.label}`);
    const vf = vitalFew(p, 80);
    const top2 = round(p[1].cumulative, 1);
    const explorer = h('div', { class: 'explorer' });
    const sel = h('select', { 'aria-label': 'Dataset', onchange: () => {
      const d = DEFECT_DATASETS[sel.value];
      explorer.querySelector('.chart-box').innerHTML = paretoSVG(d.rows, { sorted: true, title: `Pareto chart: ${d.label}` });
      const pp = pareto(d.rows);
      explorer.querySelector('.ds-note').textContent = `Total ${pp.reduce((a, r) => a + r.value, 0)} defects. Top category: ${pp[0].label} (${round(pp[0].share, 1)}%).`;
    } }, Object.entries(DEFECT_DATASETS).map(([k, d]) => h('option', { value: k }, d.label)));
    put(explorer, h('label', { class: 'inline' }, 'Dataset: ', sel), h('div', { class: 'chart-box' }), h('p', { class: 'ds-note muted' }));
    const q = h('div');
    clear(pool); put(pool, h('p', { class: 'muted' }, 'Chart complete. The cumulative line now shows how quickly the categories add up.'));
    put(ctx.body, q);
    const aug = pareto(DEFECT_DATASETS.aug_all.rows).find((r) => r.label === 'Blister').value;
    const sepB = DEFECT_DATASETS.sep_lineB.rows.find((r) => r.label === 'Blister').value;
    const sepA = DEFECT_DATASETS.sep_lineA.rows.find((r) => r.label === 'Blister').value;
    const sepAll = p.find((r) => r.label === 'Blister').value;
    decisionSequence(q, [
      {
        prompt: 'Using your chart, what cumulative percentage do the top two categories represent?',
        options: [
          { text: `${round(p[0].share, 1)}%`, correct: false, feedback: 'That is the top category alone. Read the cumulative line at the second bar.' },
          { text: `${top2}%`, correct: true, feedback: `(${p[0].value} + ${p[1].value}) ÷ ${p.reduce((a, r) => a + r.value, 0)} = ${top2}%.` },
          { text: '80%', correct: false, feedback: '80% is the reference line, not the value at the second bar.' },
          { text: `${round(p[2].cumulative, 1)}%`, correct: false, feedback: 'That is the cumulative value after three categories.' },
        ],
        points: 8,
      },
      {
        prompt: 'Which categories make up the "vital few" needed to pass roughly 80% of all defects?',
        options: [
          { text: vf.map((r) => r.label).join(', '), correct: true, feedback: `These ${vf.length} categories reach ${round(vf[vf.length - 1].cumulative, 1)}% of defects. Note the "80/20" rule is a guideline, not a law.` },
          { text: p[0].label, correct: false, feedback: `${p[0].label} alone is ${round(p[0].share, 1)}%, well short of 80%.` },
          { text: p.slice(0, vf.length + 2).map((r) => r.label).join(', '), correct: false, feedback: 'That includes more categories than needed to reach about 80%.' },
        ],
        points: 8,
      },
      {
        prompt: `${p[0].label} is the largest category. What should the team conclude?`,
        options: [
          { text: `${p[0].label} is the biggest contributor and the sensible first priority for investigation; its cause is still unknown`, correct: true, feedback: 'Exactly: Pareto prioritises, it does not diagnose.' },
          { text: `The root cause of ${p[0].label.toLowerCase()}s is now verified`, correct: false, feedback: 'A frequency ranking says nothing about causes. That needs evidence and verification (Level 3).' },
          { text: 'All smaller categories can be ignored permanently', correct: false, feedback: 'They still matter, especially if they are severe. Pareto sets the order of attack, not what to ignore forever.' },
        ],
        points: 8,
      },
      {
        title: 'Explore the data',
        extra: () => explorer,
        prompt: `Switch datasets above. Blisters were ${aug} in August and ${sepAll} in September; in September line A had ${sepA} and line B had ${sepB}. What does this show?`,
        options: [
          { text: 'The blister increase is concentrated on curing line B, so investigation should focus there first', correct: true, feedback: `Stratifying by line shows ${round((sepB / sepAll) * 100, 0)}% of September blisters are on line B. The chart updates because the calculations run on whichever dataset you choose.` },
          { text: 'Both lines contributed equally to the increase', correct: false, feedback: `Compare line A (${sepA}) with line B (${sepB}).` },
          { text: 'August had more blisters than September', correct: false, feedback: `August had ${aug}; September had ${sepAll}.` },
        ],
        points: 8,
      },
    ], (r) => {
      ctx.evidence({ id: 'l2-pareto', title: 'Pareto: blisters are the top category', text: `September: blisters ${sepAll} of ${p.reduce((a, x) => a + x.value, 0)} defects (${round(p[0].share, 1)}%), up from ${aug} in August; ${sepB} on line B.` });
      ctx.finish({ points: Math.max(0, 16 - mistakes * 2) + r.points, max: 16 + r.max });
    });
    setTimeout(() => sel.dispatchEvent(new Event('change')), 0);
  };
  renderChart([], false, 'Your Pareto chart');
  renderPool();
  put(ctx.body, 
    h('p', null, `Build a Pareto chart of ${ds.label}. Click the categories in order, from the largest count to the smallest.`),
    pool, fb, chartBox);
}

// ---------- Activity D: histogram & control chart explorer ----------
function processExplorer(ctx) {
  const view = { ds: 'tread', mode: 'hist' };
  const chart = h('div', { class: 'chart-box' });
  const statsBox = h('div', { class: 'stat-grid' });
  const noteBox = h('p', { class: 'muted small' });
  const calc = (key) => {
    const d = PROCESS_DATA[key];
    const lim = individualsLimits(d.values, d.baseline);
    const sig = controlSignals(d.values, lim);
    const cap = capability(d.values.slice(0, d.baseline), d.lsl, d.usl);
    return { d, lim, sig, cap, oos: outOfSpec(d.values, d.lsl, d.usl) };
  };
  const render = () => {
    const { d, lim, sig, cap, oos } = calc(view.ds);
    chart.innerHTML = view.mode === 'hist'
      ? histogramSVG(histogram(d.values, d.binStart, d.binWidth, d.bins), { title: `Histogram: ${d.label}`, lsl: d.lsl, usl: d.usl, mean: mean(d.values), unit: d.unit })
      : controlSVG(d.values, lim, { title: `Individuals control chart: ${d.label}`, signals: sig, baseline: d.baseline < d.values.length ? d.baseline : null, unit: d.unit });
    const firstSig = sig.length ? sig[0].index + 1 : null;
    put(clear(statsBox), 
      stat('n', d.values.length), stat('Mean', `${round(mean(d.values), 2)} ${d.unit}`), stat('σ (within, MR̄/1.128)', round(cap.sigma, 3)),
      stat('Control limits', `${round(lim.lcl, 2)} – ${round(lim.ucl, 2)}`), stat('Spec limits', `${d.lsl ?? '—'} – ${d.usl ?? '—'}`),
      stat('Cp', cap.cp == null ? 'n/a (one-sided)' : round(cap.cp, 2)), stat('Cpk', round(cap.cpk, 2)),
      stat('Out of spec', oos), stat('Control signals', sig.length ? `from sample ${firstSig}` : 'none'));
    noteBox.textContent = `${d.note} Capability uses the baseline samples and is only meaningful for a stable process. Signals: a point beyond a control limit, or 8 in a row on one side of the centre line.`;
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === view.mode || b.dataset.v === view.ds)));
  };
  const stat = (k, v) => h('div', { class: 'stat' }, h('span', null, k), h('b', null, String(v)));
  const btn = (label, v, key) => h('button', { class: 'chip', dataset: { v }, onclick: () => { view[key] = v; render(); } }, label);
  const seg = h('div', { class: 'chips wrap' }, btn('Tread width data', 'tread', 'ds'), btn('Press 4 bladder pressure', 'pressure', 'ds'), h('span', { class: 'sep' }), btn('Histogram', 'hist', 'mode'), btn('Control chart', 'control', 'mode'));
  const tread = calc('tread'); const press = calc('pressure');
  const treadMean = round(mean(tread.d.values), 2);
  const show = (ds, mode) => () => { view.ds = ds; view.mode = mode; render(); return null; };
  const q = h('div');
  put(ctx.body, 
    h('p', null, 'Dr. Haddad has loaded two datasets. Use the buttons to switch between datasets and between a histogram (distribution) and a control chart (behaviour over time). The statistics are calculated live from the data.'),
    seg, chart, statsBox, noteBox, q);
  render();
  decisionSequence(q, [
    {
      title: 'Histogram', extra: show('tread', 'hist'),
      prompt: 'Look at the tread-width histogram and the spec limits (208–212 mm, nominal 210). What do you see?',
      options: [
        { text: `The data are centred near ${treadMean} mm, above the 210 mm nominal and closer to the upper limit`, correct: true, feedback: 'Yes. The spread fits inside the specification width, but the centre is off-target, so the upper tail runs close to the USL.' },
        { text: 'The data are centred exactly on 210 mm', correct: false, feedback: `Check the mean marker: ${treadMean} mm.` },
        { text: 'The histogram shows the process is getting worse over time', correct: false, feedback: 'A histogram has no time axis. Use a control chart for behaviour over time.' },
      ],
      points: 8,
    },
    {
      title: 'Control chart', extra: show('tread', 'control'),
      prompt: 'Now view the tread width as a control chart. Is the process in statistical control?',
      options: [
        { text: 'Yes: no points beyond the control limits and no runs of 8 on one side, so only common-cause variation is evident', correct: tread.sig.length === 0, feedback: 'Correct. The process is stable (predictable).' },
        { text: 'No: one tyre is above the 212 mm USL, so the process is out of control', correct: false, feedback: 'Being outside a specification limit is not the same as being out of statistical control. Control limits come from the process data; spec limits come from requirements.' },
        { text: 'It cannot be judged without customer complaints', correct: false, feedback: 'Stability is judged from the process data itself.' },
      ],
      points: 8,
    },
    {
      title: 'Capability', extra: show('tread', 'hist'),
      prompt: `The process is stable, with Cp = ${round(tread.cap.cp, 2)} and Cpk = ${round(tread.cap.cpk, 2)}. Is it capable?`,
      options: [
        { text: 'Yes: a stable process is automatically capable', correct: false, feedback: 'Stability and capability are different questions. A stable process can predictably produce out-of-spec product.' },
        { text: `Not yet: Cpk ${round(tread.cap.cpk, 2)} is below the common 1.33 target. Because Cp (${round(tread.cap.cp, 2)}) is higher, centring the process on 210 mm would improve Cpk the most`, correct: true, feedback: 'Exactly. Cp ignores centring; Cpk penalises off-centre processes. Many organisations require Cpk ≥ 1.33 (a convention, check your customer requirements).' },
        { text: 'Capability cannot be calculated for tread width', correct: false, feedback: 'It can be estimated for any stable process with a measured characteristic and specification limits.' },
      ],
      points: 8,
    },
    {
      title: 'Bladder pressure', extra: show('pressure', 'control'),
      prompt: 'Switch to Press 4 bladder pressure. What does the control chart show?',
      options: [
        { text: `A shift: from sample ${press.sig[0].index + 1} the pressure drops below the lower control limit, a special-cause signal to investigate, even though all values are still above the 14.0 bar minimum`, correct: true, feedback: 'Correct. The process changed. Being inside specification does not mean "nothing happened"; this signal is an early warning.' },
        { text: 'Nothing: all readings are within the 14.0 bar specification', correct: false, feedback: 'Specification compliance and statistical stability are different. Look at the control limits.' },
        { text: 'The control limits must be wrong because they are narrower than the specification', correct: false, feedback: 'Control limits reflect natural process variation; they are often much narrower than specifications.' },
      ],
      points: 8,
    },
    {
      prompt: 'Which statement about control limits and specification limits is correct?',
      options: [
        { text: 'Control limits are calculated from process data (voice of the process); specification limits come from customer and design requirements (voice of the customer)', correct: true, feedback: 'Never draw spec limits and call them control limits, or vice versa.' },
        { text: 'They are the same and can be used interchangeably', correct: false, feedback: 'They answer different questions: "is the process stable?" versus "does output meet requirements?"' },
        { text: 'Specification limits are always calculated as mean ± 3σ', correct: false, feedback: 'That describes control limits (for an individuals chart, using within-process σ).' },
      ],
      points: 8,
    },
  ], (r) => {
    ctx.evidence({ id: 'l2-pressure-shift', title: 'Press 4 bladder pressure shifted', text: `Control chart: Press 4 bladder pressure shifts down from sample ${press.sig[0].index + 1} (below LCL ${round(press.lim.lcl, 2)} bar), still above the 14.0 bar minimum.` });
    ctx.evidence({ id: 'l2-tread', title: 'Tread width stable but off-centre', text: `Tread width in control; Cp ${round(tread.cap.cp, 2)}, Cpk ${round(tread.cap.cpk, 2)}: needs centring.` });
    ctx.finish(r);
  });
}

export const level = {
  id: 'l2',
  num: 2,
  title: 'The 7 QC Tools Challenge',
  area: 'lab',
  briefing: {
    speaker: 'lab',
    text: 'Opinions are cheap; data is how we improve. I will teach you the seven basic quality tools that every team here should use: check sheet, Pareto chart, cause-and-effect diagram, histogram, control chart, scatter diagram and stratification. You will collect data, choose the right tool and interpret real (well, fictional) numbers.',
    objectives: ['Fill in a stratified check sheet with Mei at Final Inspection.', 'Choose the right tool for six problems at the Training Room huddle board.', 'Build and interpret a Pareto chart at the lab workstation.', 'Analyse process data at the tread extruder (histogram and control chart).'],
    learn: ['What each QC tool does, and what it cannot conclude', 'Pareto analysis with cumulative percentages', 'Histograms versus control charts', 'Control limits versus specification limits', 'Stability versus capability'],
  },
  debrief: {
    principle: 'Manage by facts: the right tool for the right question',
    text: 'Each QC tool answers a specific question. Check sheets collect data; stratification shows where; Pareto shows what matters most; histograms show distribution against specifications; control charts show stability over time; scatter diagrams explore relationships; fishbone diagrams organise hypotheses. None of them proves a root cause on its own.',
  },
  badge: 'Pareto Pro',
  reward: { id: 'qc7', name: '7 QC Toolkit', desc: 'Reference cards for the seven basic quality tools.' },
  kpiEffect: (k, perf) => { k.rejected -= 20 * perf; k.confidence += 2 * perf; k.project = 'Data collected; focus on Press 4 blisters'; },
  tasks: [
    { id: 'checksheet', title: 'Collect defect data on a check sheet', station: 'npcInspector', prompt: 'collect defect data with Mei', run: checkSheet },
    {
      id: 'tools', title: 'Choose the right QC tool', station: 'whiteboard', prompt: 'use the huddle board for the QC tool challenge',
      run(ctx) {
        put(ctx.body, toolCards());
        const box = h('div'); put(ctx.body, box);
        decisionSequence(box, [
          toolStep('Which defect category contributes most to total rejection this month?', 'pareto', 'A Pareto chart ranks categories and shows their cumulative share.'),
          toolStep('How are 200 tread-gauge measurements distributed relative to the specification?', 'histogram', 'A histogram shows the centre, spread and shape of the measurements.'),
          toolStep('The team wants to list and organise every potential cause of recurring blisters before collecting evidence.', 'fishbone', 'A cause-and-effect diagram structures hypotheses by category.'),
          toolStep('Is Press 4 bladder pressure statistically stable from cycle to cycle?', 'control', 'A control chart shows behaviour over time against limits calculated from the process.'),
          toolStep('Is there a relationship between mixing temperature and compound viscosity?', 'scatter', 'A scatter diagram plots paired values to reveal a possible relationship.'),
          toolStep('Do blister rates differ between presses, shifts and compound batches?', 'strat', 'Stratification separates data into groups to find where a problem is concentrated.'),
          toolStep('Inspectors need a quick, consistent way to record defects as they find them.', 'check', 'A check sheet captures data at the source in a consistent format.'),
        ], (r) => ctx.finish(r));
      },
    },
    { id: 'pareto', title: 'Build a Pareto chart', station: 'labBench', prompt: 'build a Pareto chart at the lab workstation', run: paretoBuilder },
    { id: 'spc', title: 'Analyse tread width and bladder pressure data', station: 'extruder', prompt: 'analyse process data at the tread extruder', run: processExplorer },
  ],
};

