import { h, html, clear, put } from '../ui.js';
import { decisionSequence, orderItems, speakerLine } from '../activities.js';
import { controlSVG, compareSVG } from '../charts.js';
import { individualsLimits, controlSignals } from '../stats.js';
import { kpiView, BASELINE_KPI } from '../state.js';

const PRESS7 = [170.1, 169.7, 170.3, 169.8, 170.2, 169.6, 170.0, 170.4, 169.9, 170.1, 169.8, 170.2, 170.7, 170.9, 170.6, 171.1, 170.8, 171.2, 170.9, 171.3, 171.0];

export const ISSUES = {
  complaint: { title: 'OEM vibration complaint', short: 'Customer complaint', text: 'A vehicle maker (OEM) reports vibration at highway speed on 6 new vehicles fitted with QX 225/45 R17 tyres. They want an initial response in 48 hours. Not reported as a safety incident.' },
  press7: { title: 'Press 7 temperature drift', short: 'Process variation', text: 'Press 7 platen temperature: the last 9 readings are all above the centre line. Every reading is still inside the specification.' },
  splice: { title: 'Splice-open defects rising', short: 'Defect increase', text: 'Tread splice-open defects rose from 51 to 88 this month (all lines). Not yet stratified.' },
  kaizen: { title: 'Line 1 kaizen: uncertain result', short: 'Improvement project', text: 'A line 1 kaizen cut cycle time 6% in a 1-week trial (210 tyres). Its effect on defects was not measured. The team wants to roll it out to all lines next week.' },
};

function issueCards() {
  const lim = individualsLimits(PRESS7, 12);
  return h('div', { class: 'issue-grid' },
    h('div', { class: 'issue-card' }, h('h4', null, ISSUES.complaint.title), h('p', null, ISSUES.complaint.text)),
    h('div', { class: 'issue-card' }, h('h4', null, ISSUES.press7.title), h('p', null, ISSUES.press7.text), h('div', { class: 'chart-box mini' }, html(controlSVG(PRESS7, lim, { title: 'Press 7 platen temperature', signals: controlSignals(PRESS7, lim), baseline: 12, unit: '°C', usl: 173.5 })))),
    h('div', { class: 'issue-card' }, h('h4', null, ISSUES.splice.title), h('p', null, ISSUES.splice.text), h('div', { class: 'chart-box mini' }, html(compareSVG([{ label: 'Splice open / month', before: 51, after: 88, lowerIsBetter: true }], { title: 'Splice-open defects', beforeLabel: 'Last month', afterLabel: 'This month' })))),
    h('div', { class: 'issue-card' }, h('h4', null, ISSUES.kaizen.title), h('p', null, ISSUES.kaizen.text)));
}

/** Score a priority order: customer complaint and process signal belong in the top two. */
export function priorityScore(order) {
  let pts = 0;
  const pos = (id) => order.indexOf(id);
  if (pos('complaint') <= 1) pts += 6;
  if (pos('press7') <= 1) pts += 6;
  if (pos('splice') === 2) pts += 4;
  if (pos('kaizen') === 3) pts += 4;
  return pts;
}

const RESPONSES = {
  complaint: {
    prompt: 'OEM vibration complaint: what do you do?',
    options: [
      { text: 'Send replacement tyres and close the complaint', correct: false, feedback: 'A correction only. The OEM needs containment, a cause and evidence.' },
      { text: 'Tell the OEM the vibration comes from their wheel balancing', correct: false, feedback: 'Unsupported. Investigate first.' },
      { text: 'Contain: re-test uniformity on stock from the same production weeks and trace the serials; open a structured (8D-style) investigation; give the OEM a factual interim response within 48 h', correct: true, feedback: 'Containment, traceability, structured investigation and honest communication.' },
      { text: 'Recall all tyres of every size', correct: false, feedback: 'Disproportionate and not based on evidence. Field actions are decided through approved procedures.' },
    ],
    effect: (k, ok) => { k.complaints -= ok ? 2 : 0; k.confidence += ok ? 8 : -4; },
    action: 'Contained OEM stock by traceability, re-tested uniformity, opened an 8D investigation, gave a factual 48-hour response.',
  },
  press7: {
    prompt: 'Press 7 temperature run: what do you do?',
    options: [
      { text: 'Lower the setpoint by 2 °C right away to bring readings back to the centre', correct: false, feedback: 'Adjusting without knowing the cause is tampering; it can add variation or hide the real fault.' },
      { text: 'Ignore it: everything is inside specification', correct: false, feedback: 'A run of 9 above the centre line signals a likely process shift. Acting now prevents out-of-spec product later.' },
      { text: 'Treat it as a special-cause signal: check the thermocouple calibration and steam valve, increase sampling of Press 7 output, and follow the reaction plan', correct: true, feedback: 'Investigate the signal before it becomes a defect. Found: a sticking steam valve, replaced under the reaction plan.' },
      { text: 'Recalculate the control limits so the points fall inside', correct: false, feedback: 'Moving the limits hides the signal; it does not fix the process.' },
    ],
    effect: (k, ok) => { k.rejected += ok ? -15 : 25; },
    action: 'Investigated the Press 7 run signal; sticking steam valve replaced under the reaction plan.',
  },
  splice: {
    prompt: 'Splice-open defects up from 51 to 88: what is the first step?',
    options: [
      { text: 'Retrain every builder immediately', correct: false, feedback: 'A solution before analysis. The cause may not be skills at all.' },
      { text: 'Stratify splice defects by line, builder, shift and component batch, then build a fishbone and verify the top hypothesis', correct: true, feedback: 'Stratification found 70% on line 2 from one tread batch with low tack; the supplier was contained and the cause verified.' },
      { text: 'Hire extra inspectors at final inspection', correct: false, feedback: 'Detection only. Splices are created in building.' },
    ],
    effect: (k, ok) => { k.rejected += ok ? -20 : 5; k.reworked += ok ? -40 : 10; },
    action: 'Stratified splice defects (line 2, one tread batch), verified low-tack material, contained the batch with the supplier.',
  },
  kaizen: {
    prompt: 'Line 1 kaizen with an uncertain result: what do you decide?',
    options: [
      { text: 'Roll it out to all lines next week as planned', correct: false, feedback: 'Standardising before checking quality effects risks spreading a hidden problem.' },
      { text: 'Cancel the project: uncertainty means it failed', correct: false, feedback: 'Uncertain is not failed. Measure properly.' },
      { text: 'Extend the trial with defect and rework measurement (PDCA CHECK) for 3 more weeks, then decide', correct: true, feedback: 'The extended trial confirmed the cycle-time gain with no defect increase; it was then standardised.' },
    ],
    effect: (k, ok) => { k.reworked += ok ? -30 : 20; },
    action: 'Extended the line 1 kaizen trial with defect measurement before standardising.',
  },
};

function situation(ctx) {
  if (!ctx.state.flag('final_initial')) ctx.state.flag('final_initial', { ...ctx.state.kpi });
  put(ctx.body, speakerLine('manager', 'This is the real test. Four things landed on my desk this morning. We cannot do everything at once. Read the board, then tell me what we tackle first, and why.'), issueCards());
  const box = h('div'); put(ctx.body, box);
  const items = Object.entries(ISSUES).map(([id, i]) => ({ id, label: i.title }));
  orderItems(box, { prompt: 'Click the issues in the order you would tackle them (first = highest priority).', items, correctOrder: () => true, feedback: 'Priority order recorded.' }, ({ order }) => {
    const pts = priorityScore(order);
    ctx.state.flag('final_order', order);
    put(clear(box), 
      h('div', { class: `feedback ${pts >= 16 ? 'good' : 'bad'}` }, h('strong', null, `Priority score ${pts}/20. `),
        'Recommended reasoning: issues with a customer impact need fast containment (the OEM complaint), and a live process signal (Press 7) should be investigated before it produces nonconforming product. The splice-defect rise is serious but internal and contained by inspection, so analyse it next. The kaizen project can wait for proper measurement, but must not be standardised before then.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => ctx.finish({ points: pts, max: 20 }) }, 'Take the plan to Elena')));
  });
}

function respond(ctx) {
  const order = ctx.state.flag('final_order') || Object.keys(ISSUES);
  const initial = ctx.state.flag('final_initial') || { ...ctx.state.kpi };
  const results = {};
  const box = h('div'); put(ctx.body, box);
  ctx.body.prepend(speakerLine('manager', 'Work through them in your order. Your decisions will change the factory numbers.'));
  decisionSequence(box, order.map((id) => ({
    title: `${order.indexOf(id) + 1}. ${ISSUES[id].short}`,
    scenario: ISSUES[id].text,
    prompt: RESPONSES[id].prompt,
    options: RESPONSES[id].options,
    points: 10,
  })), (r) => {
    r.record.forEach((rec, i) => { results[order[i]] = rec.attempts === 1; });
    const late = [];
    if (ctx.practice) {
      put(clear(box), h('div', { class: 'feedback' }, 'Practice run: your original factory report is kept unchanged.'));
      const saved = ctx.state.flag('final_report');
      if (saved) put(box, renderReport(saved, ctx.state));
      put(box, h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => ctx.finish({ points: r.points, max: r.max }) }, 'Finish practice')));
      return;
    }
    ctx.state.updateKpi('Final challenge', (k) => {
      order.forEach((id) => RESPONSES[id].effect(k, results[id]));
      if (order.indexOf('complaint') > 1) { k.confidence -= 6; k.complaints += 1; late.push('The OEM waited too long for containment: confidence fell and one more complaint arrived.'); }
      if (order.indexOf('press7') > 1) { k.rejected += 30; late.push('The Press 7 drift reached the specification limit before it was investigated: 140 tyres were held and some were scrapped.'); }
      k.project = 'Quality Championship complete';
    });
    const before = kpiView(initial); const start = kpiView(BASELINE_KPI); const after = kpiView(ctx.state.kpi);
    const report = { start, before, after, actions: order.map((id) => ({ issue: ISSUES[id].title, action: RESPONSES[id].action, firstTime: results[id] })), late };
    ctx.state.flag('final_report', report);
    put(clear(box), renderReport(report, ctx.state));
    put(box, h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => ctx.finish({ points: r.points, max: r.max }) }, 'Finish the challenge')));
  }, { finishLabel: 'See the factory report' });
}

export function renderReport(report, state) {
  const { start, before, after, actions, late } = report;
  const row = (label, a, b, c, unit, lower) => {
    const better = lower ? c < a : c > a;
    return h('tr', null, h('td', null, label), h('td', { class: 'num' }, `${a}${unit}`), h('td', { class: 'num' }, `${b}${unit}`), h('td', { class: `num ${c === a ? '' : better ? 'good-text' : 'bad-text'}` }, `${c}${unit}`));
  };
  const journey = (state.data.evidence || []).filter((e) => /^l[1-6]-(verified|success|standard|trace|layout|huddle|pareto)$/.test(e.id)).map((e) => e.title);
  return h('div', { class: 'report' },
    h('h3', null, 'Final factory performance report'),
    h('p', { class: 'muted small' }, 'Fictional simulation results. Real decisions are taken within approved manufacturing, safety and quality-system procedures, not by one person.'),
    h('h4', null, 'Performance'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, h('th', null, 'Indicator'), h('th', { class: 'num' }, 'Start of assignment'), h('th', { class: 'num' }, 'Start of challenge'), h('th', { class: 'num' }, 'Result'))),
      h('tbody', null,
        row('Rejection rate', start.rejectionRate, before.rejectionRate, after.rejectionRate, '%', true),
        row('First-pass yield', start.fpy, before.fpy, after.fpy, '%', false),
        row('Rework rate', start.reworkRate, before.reworkRate, after.reworkRate, '%', true),
        row('Complaints / month', start.complaints, before.complaints, after.complaints, '', true),
        row('Good output / week', start.output, before.output, after.output, '', false),
        row('Customer confidence (index)', start.confidence, before.confidence, after.confidence, '', false)))),
    h('h4', null, 'Actions taken'),
    h('ul', null, journey.map((t) => h('li', null, t)), actions.map((a) => h('li', null, h('b', null, `${a.issue}: `), a.action, a.firstTime ? '' : h('em', { class: 'muted' }, ' (reached after reconsidering)')))),
    h('h4', null, 'Remaining issues'),
    h('ul', null,
      late.map((t) => h('li', null, t)),
      h('li', null, 'OEM vibration investigation still open: root cause and corrective action report due.'),
      h('li', null, `Rejection rate ${after.rejectionRate}% remains above world-class levels; continue Pareto-driven improvement.`),
      h('li', null, 'Sustainment audits are needed for the new bladder PM standard and the cell 2 standard work.')),
    h('h4', null, 'Lessons learned'),
    h('ul', null,
      h('li', null, 'Prioritise by customer and process risk, not by who shouts loudest.'),
      h('li', null, 'React to control chart signals before they become defects, without tampering.'),
      h('li', null, 'Stratify and verify before acting; correlation is only a lead.'),
      h('li', null, 'Check improvements with data before standardising, and never shift problems downstream.')));
}

export const level = {
  id: 'final',
  num: 7,
  title: 'Final Challenge: The Quality Championship',
  area: 'control',
  briefing: {
    speaker: 'manager',
    text: 'You have transformed how we work. Now the factory is facing several problems at once: a defect increase, a possible process shift, a customer complaint and an improvement project with uncertain results. Prioritise, choose the right methods, and show me the results.',
    objectives: ['Read the situation at the production performance board and set priorities.', 'Decide how to handle each issue with Elena.', 'Review the final factory performance report.'],
    learn: ['Risk-based prioritisation', 'Choosing the right TQM method for each problem', 'Integrating everything from Levels 1–6'],
  },
  debrief: {
    principle: 'TQM is a system, not a toolbox',
    text: 'Customer focus sets priorities, process data shows where to look, structured problem solving finds verified causes, PDCA tests improvements, standards hold the gains, and people at every level drive it. Next: the final assessment at the Training Room terminal.',
  },
  badge: null,
  reward: { id: 'report', name: 'Factory performance report', desc: 'Open it any time from the menu.' },
  kpiEffect: null,
  tasks: [
    { id: 'situation', title: 'Read the situation and set priorities', station: 'kpiBoard', prompt: 'read the situation board', run: situation },
    { id: 'respond', title: 'Respond to each issue with Elena', station: 'npcManager', requires: ['situation'], prompt: 'present your plan to Elena', run: respond },
  ],
};

