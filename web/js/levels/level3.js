import { h, html, clear, put } from '../ui.js';
import { decisionSequence, multiSelect, speakerLine, attemptPoints } from '../activities.js';
import { scatterSVG, lineSVG } from '../charts.js';
import { HUMIDITY_SCATTER } from '../data.js';

export const HYPOTHESES = [
  { id: 'material', label: 'Compound batch (material)' },
  { id: 'shift', label: 'Operator / shift practice' },
  { id: 'recipe', label: 'Wrong recipe or setpoints' },
  { id: 'pressure', label: 'Low bladder pressure (machine)' },
  { id: 'humidity', label: 'Ambient humidity (environment)' },
];

function hypothesisBoard(state) {
  const verdicts = state.flag('l3_hyp') || {};
  return h('div', { class: 'hyp-board' }, h('h4', null, 'Hypothesis board'), HYPOTHESES.map((hy) => {
    const v = verdicts[hy.id];
    return h('div', { class: `hyp ${v || ''}` }, h('span', null, hy.label), h('b', null, v === 'supported' ? 'Supported' : v === 'contradicted' ? 'Contradicted' : v === 'weak' ? 'Weak / unproven' : 'Open'));
  }));
}

function setVerdict(state, id, v) {
  const verdicts = { ...(state.flag('l3_hyp') || {}) };
  verdicts[id] = v;
  state.flag('l3_hyp', verdicts);
}

function recordTask({ id, title, station, prompt, record, steps, evidence, verdicts }) {
  return {
    id, title, station, prompt, group: 'Examine the evidence',
    run(ctx) {
      put(ctx.body, record(), hypothesisBoard(ctx.state));
      const box = h('div'); put(ctx.body, box);
      decisionSequence(box, steps, (r) => {
        Object.entries(verdicts).forEach(([k, v]) => setVerdict(ctx.state, k, v));
        evidence.forEach((e) => ctx.evidence(e));
        ctx.finish(r);
      });
    },
  };
}

const table = (head, rows) => h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' }, h('thead', null, h('tr', null, head.map((c) => h('th', null, c)))), h('tbody', null, rows.map((r) => h('tr', { class: r.hl ? 'hl' : '' }, (r.cells || r).map((c) => h('td', null, String(c))))))));

const FISH_CATS = ['Manpower', 'Machine', 'Method', 'Material', 'Measurement', 'Environment'];
const FISH_CAUSES = [
  { id: 'f1', text: 'Worn curing bladder leaking during the hold', ok: ['Machine'] },
  { id: 'f2', text: 'Bladder pressure regulator drifting', ok: ['Machine'] },
  { id: 'f3', text: 'PM scheduled by calendar, not cycle count', ok: ['Method'] },
  { id: 'f4', text: 'Pressure alarm can be reset without escalation', ok: ['Method', 'Machine'] },
  { id: 'f5', text: 'Compound batch with high moisture', ok: ['Material'] },
  { id: 'f6', text: 'Air trapped between plies during building', ok: ['Method', 'Manpower'] },
  { id: 'f7', text: 'Pressure transducer out of calibration', ok: ['Measurement'] },
  { id: 'f8', text: 'Blister acceptance criteria unclear to inspectors', ok: ['Measurement', 'Method'] },
  { id: 'f9', text: 'High ambient humidity in the curing hall', ok: ['Environment'] },
  { id: 'f10', text: 'Operators not trained on pressure alarm response', ok: ['Manpower'] },
  { id: 'f11', text: 'The canteen coffee machine is broken', ok: ['discard'] },
];

function fishbone(ctx) {
  const place = {}; // causeId -> category | 'discard'
  let selected = null; let attempts = 0;
  FISH_CAUSES.forEach((c) => { c.state = ''; });
  const svgBox = h('div', { class: 'fish-svg' }, html(`<svg viewBox="0 0 700 90" aria-hidden="true"><line x1="20" y1="45" x2="600" y2="45" stroke="currentColor" stroke-width="4"/><polygon points="600,25 690,45 600,65" fill="currentColor" opacity=".25" stroke="currentColor" stroke-width="2"/><text x="612" y="50" font-size="12" fill="currentColor">Blisters on</text><text x="612" y="64" font-size="12" fill="currentColor">Press 4</text></svg>`));
  const pool = h('div', { class: 'chips wrap fish-pool' });
  const bones = h('div', { class: 'fish-bones' });
  const fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const render = () => {
    put(clear(pool), FISH_CAUSES.filter((c) => !place[c.id]).map((c) => chip(c)));
    if (!FISH_CAUSES.some((c) => !place[c.id])) put(pool, h('span', { class: 'muted' }, 'All causes placed. Click a placed cause to move it.'));
    put(clear(bones), [...FISH_CATS, 'discard'].map((cat) => h('div', { class: `bone ${cat === 'discard' ? 'discard' : ''} ${selected ? 'target' : ''}`, role: 'button', tabindex: '0',
      onclick: () => drop(cat), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(cat); } } },
    h('h5', null, cat === 'discard' ? 'Not a plausible cause' : cat),
    FISH_CAUSES.filter((c) => place[c.id] === cat).map((c) => chip(c)))));
  };
  const chip = (c) => h('button', { class: `chip cause ${selected === c.id ? 'selected' : ''} ${c.state || ''}`, onclick: (e) => {
    e.stopPropagation();
    if (selected && selected !== c.id && place[c.id]) { drop(place[c.id]); return; } // clicking inside a category drops the selected cause there
    selected = selected === c.id ? null : c.id; render();
  } }, c.text);
  const drop = (cat) => {
    if (!selected) return;
    place[selected] = cat;
    const c = FISH_CAUSES.find((x) => x.id === selected); c.state = '';
    selected = null; render();
  };
  const check = h('button', { class: 'btn primary', onclick: () => {
    const left = FISH_CAUSES.filter((c) => !place[c.id]).length;
    if (left) { fb.className = 'feedback bad'; fb.textContent = `Place all causes first (${left} left). Select a cause, then click a category.`; return; }
    attempts += 1;
    let wrong = 0;
    FISH_CAUSES.forEach((c) => { const ok = c.ok.includes(place[c.id]); c.state = ok ? 'ok' : 'no'; if (!ok) wrong += 1; });
    render();
    if (wrong) {
      fb.className = 'feedback bad';
      fb.textContent = `${wrong} cause(s) (marked red) would fit better in another category. Several causes legitimately fit more than one category; red ones do not fit where they are now.`;
    } else {
      fb.className = 'feedback good';
      put(clear(fb), h('strong', null, 'Diagram complete. '), 'Remember: every entry is a hypothesis, not a finding. Your evidence so far already contradicts several of them (material, shift, recipe). Notice that categories do not need an equal number of causes, and a category may legitimately stay empty.');
      check.replaceWith(h('button', { class: 'btn primary', onclick: () => {
        ctx.evidence({ id: 'l3-fishbone', title: 'Fishbone: 10 potential causes', text: 'Potential causes organised under Manpower, Machine, Method, Material, Measurement, Environment. Hypotheses only, to be verified.' });
        ctx.finish({ points: attemptPoints(30, attempts), max: 30 });
      } }, 'Continue'));
    }
  } }, 'Check diagram');
  put(ctx.body, h('p', null, 'Build a cause-and-effect (Ishikawa) diagram with the team. Select a potential cause, then click the category it belongs to. Click a placed cause to move it. Put anything that cannot plausibly cause the effect in "Not a plausible cause".'), svgBox, pool, bones, fb, h('div', { class: 'actions' }, check));
  render();
}

function fiveWhys(ctx) {
  const chain = h('ol', { class: 'why-chain' }, h('li', { class: 'problem' }, h('b', null, 'Problem: '), 'Blister rate on Press 4 is 6.2% (90 of 1,450 tyres) since 2 September, versus under 1% on Presses 3 and 5.'));
  const box = h('div');
  const add = (text) => put(chain, h('li', null, text));
  put(ctx.body, h('p', null, 'Lead a 5 Whys at the press. At each step choose the explanation best supported by your evidence folder. Dead ends are part of real investigations: if the evidence contradicts an answer, revise and choose again.'), chain, box);
  const step = (n, prompt, options) => ({ title: `Why ${n}?`, prompt, options, points: 8, onCorrect: (o) => add(o.text) });
  decisionSequence(box, [
    step(1, 'Why are blisters forming on Press 4 tyres?', [
      { text: 'Bladder pressure during the cure hold is too low to suppress trapped air and volatiles', correct: true, feedback: 'Supported by the pressure records (22% of cycles below the alarm threshold, only on Press 4) and the control chart shift.' },
      { text: 'Night-shift operators handle green tyres badly', correct: false, feedback: 'Dead end: shift data shows the same blister rate on all three shifts.' },
      { text: 'The compound batches are too wet', correct: false, feedback: 'Dead end: the same batches ran on Presses 3 and 5 with normal blister rates.' },
      { text: 'Inspectors became stricter', correct: false, feedback: 'No evidence of a criteria change, and blisters are physically present on the tyres.' },
    ]),
    step(2, 'Why is the bladder pressure too low during the hold?', [
      { text: 'Someone changed the pressure setpoint', correct: false, feedback: 'Contradicted: the audit trail shows setpoints unchanged for 90 days.' },
      { text: 'The bladder is leaking: pressure decays during the hold, and fine surface cracks were noted on 20 September', correct: true, feedback: 'Supported by the pressure-decay pattern and the maintenance inspection note.' },
      { text: 'Steam/nitrogen supply pressure is low across the whole plant', correct: false, feedback: 'If supply were low plant-wide, Presses 3 and 5 would also show low pressure. They do not.' },
    ]),
    step(3, 'Why is the bladder leaking?', [
      { text: 'It is a faulty bladder from a bad supplier lot', correct: false, feedback: 'Possible, but there is no evidence. The bladder is far past its rated life, which explains the cracking. Check the supplier only if a new bladder fails early.' },
      { text: 'It has exceeded its rated service life: 4,450 cycles against a rated 3,000', correct: true, feedback: 'Supported by the maintenance record.' },
    ]),
    step(4, 'Why was the bladder used beyond its rated life?', [
      { text: 'The maintenance technician forgot to change it', correct: false, feedback: 'Contradicted: records show the change was deliberately deferred twice. Blaming a person also hides the system issue.' },
      { text: 'The replacement was deferred twice to protect output after the target was raised', correct: true, feedback: 'Supported by the maintenance log and the supervisor interview.' },
    ]),
    step(5, 'Why could the replacement be deferred without anyone assessing the risk?', [
      { text: 'Production managers do not care about quality', correct: false, feedback: 'An opinion that blames people. Look for the system condition that allowed it.' },
      { text: 'Bladder PM is scheduled by calendar, not cycle count, and deferring PM needs no risk review or approval', correct: true, feedback: 'A systemic, actionable cause supported by the maintenance records.' },
      { text: 'Stop at Why 4: the output target is the root cause', correct: false, feedback: 'Targets are legitimate. The question is why the system let a target override a critical maintenance limit without review.' },
    ]),
    {
      title: 'Is the chain complete?',
      prompt: 'Should the team keep asking "why"?',
      options: [
        { text: 'Stop here: the cause is supported by evidence and within the plant\'s control to fix. Next, verify it before acting', correct: true, feedback: 'Good judgement. This chain took five steps, but the count is not the rule: stop when you reach a verified, actionable cause. Some chains need three steps, others more, and some branches must be revised when evidence contradicts them.' },
        { text: 'Always continue until exactly seven whys', correct: false, feedback: 'There is no fixed number. Continuing past an actionable cause usually drifts into issues outside the team\'s control.' },
        { text: 'Keep going until you reach the company\'s global strategy', correct: false, feedback: 'That goes beyond what the team can act on and verify.' },
      ],
      points: 8,
    },
  ], (r) => {
    ctx.evidence({ id: 'l3-5why', title: '5 Whys chain', text: 'Blisters ← low hold pressure ← leaking bladder ← past rated life (4,450 / 3,000 cycles) ← replacement deferred twice ← calendar-based PM with no deferral risk review.' });
    ctx.finish(r);
  });
}

function verify(ctx) {
  put(ctx.body, speakerLine('lab', 'A plausible cause is not a verified cause. Before we spend money, tell me what evidence would confirm or refute that the worn bladder causes the blisters.'));
  const box = h('div'); put(ctx.body, box);
  multiSelect(box, {
    prompt: 'Which tests or evidence would properly verify (or refute) the worn-bladder hypothesis?',
    options: [
      { text: 'Replace only the Press 4 bladder, keeping recipe, compound and crew unchanged, then compare blister rates over at least 300 tyres', correct: true, feedback: 'A controlled change of the suspected cause: if the effect disappears, the cause is supported.' },
      { text: 'Log pressure decay during the hold before and after the replacement', correct: true, feedback: 'Confirms the mechanism (leak → pressure loss).' },
      { text: 'Pressure-test the removed bladder for leaks in the lab', correct: true, feedback: 'Direct physical evidence of the leak.' },
      { text: 'Section or X-ray blistered tyres to confirm the blister type matches trapped air (not foreign material or separation from another cause)', correct: true, feedback: 'Checks that the defect mode matches the proposed mechanism.' },
      { text: 'Ask the operators to vote on the most likely cause', correct: false, feedback: 'Opinions are valuable leads, but a vote does not verify anything.' },
      { text: 'Change the bladder, compound and recipe at the same time to be sure', correct: false, feedback: 'Changing several factors at once means you cannot tell which change made the difference.' },
      { text: 'Accept it because the fishbone diagram lists it under Machine', correct: false, feedback: 'Fishbone entries are hypotheses, not verification.' },
    ],
    pointsEach: 4,
  }, (r1) => {
    clear(box);
    const results = h('div', null,
      h('h4', null, 'Verification results (controlled trial, fictional)'),
      table(['Measure', 'Before (old bladder)', 'After (new bladder)'], [
        ['Tyres cured', '1,450', '312'], ['Blisters', '90 (6.2%)', '1 (0.3%)'], ['Pressure decay during hold', '0.9 bar', '0.05 bar'], ['Recipe / compound / crew', 'unchanged', 'unchanged']]),
      h('p', { class: 'muted small' }, 'Lab: the removed bladder leaked at three crack sites under test. Sectioned blisters showed voids consistent with trapped air/volatiles.'),
      h('div', { class: 'chart-box' }, html(lineSVG([{ label: 'Blister %', values: [6.0, 6.4, 6.2, 0.4, 0.3, 0.2] }], { title: 'Press 4 blister rate before and after bladder replacement', labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Trial d1-2', 'd3-4', 'd5-6'], unit: '%' }))));
    put(box, results);
    const q = h('div'); put(box, q);
    decisionSequence(q, [{
      prompt: 'What can you conclude?',
      options: [
        { text: 'The worn bladder is verified as the direct cause in this simulation (removing it switched the effect off, and the mechanism was confirmed). The systemic cause (uncontrolled PM deferral) is supported by records, but the fix still needs proving over time', correct: true, feedback: 'Precise and honest: you distinguish what is verified from what is supported and what remains to be shown.' },
        { text: 'Every blister in the plant is now explained', correct: false, feedback: 'Other presses still have a ~0.8% background blister rate from other common causes.' },
        { text: 'Humidity has been proven to contribute', correct: false, feedback: 'Nothing in this trial tested humidity. The blister rate fell while humidity was unchanged.' },
        { text: 'One week of data proves the problem will never return', correct: false, feedback: 'Recurrence prevention depends on fixing the PM system. That must be checked over time (Level 4).' },
      ],
      points: 12,
    }], (r2) => {
      clear(box);
      const summary = h('div', { class: 'summary-card' },
        h('h3', null, 'Investigation summary'),
        h('dl', null,
          h('dt', null, 'Observed problem'), h('dd', null, 'Sidewall blisters on Press 4 at 6.2% (90/1,450) since 2 September vs <1% on Presses 3 and 5.'),
          h('dt', null, 'Evidence examined'), h('dd', null, 'Press settings & audit trail, cure pressure records, compound batch records, maintenance history, shift-stratified data, humidity data, controlled bladder trial, lab leak test.'),
          h('dt', null, 'Potential causes considered'), h('dd', null, 'Material batch, operator/shift practice, recipe/setpoints, bladder pressure, ambient humidity, calibration, building method.'),
          h('dt', null, 'Cause verified in the simulation'), h('dd', null, 'Leaking, over-life curing bladder → low hold pressure → blisters. Systemic contributor: calendar-based PM with uncontrolled deferral.'),
          h('dt', null, 'Remaining uncertainties'), h('dd', null, 'Long-term effectiveness of a PM change; whether other presses have bladders near or past rated life; the background blister rate on other presses; a possible minor humidity contribution (not tested).')));
      put(box, summary, h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => {
        ctx.evidence({ id: 'l3-verified', title: 'VERIFIED: worn bladder causes Press 4 blisters', text: 'Controlled trial: 6.2% → 0.3% after replacing only the bladder; leak confirmed in lab. Systemic cause: uncontrolled PM deferral.' });
        ctx.finish({ points: r1.points + r2.points, max: r1.max + r2.max, summary: 'verified' });
      } }, 'File the investigation')));
    });
  });
}

export const level = {
  id: 'l3',
  num: 3,
  title: 'The Root Cause Investigation',
  area: 'curing',
  briefing: {
    speaker: 'manager',
    text: 'Blisters keep appearing on tyres from curing line B. We have already tried extra inspection and a reminder memo to operators, and it continues. You will lead the investigation. I want conclusions based on evidence, not on who shouts loudest.',
    objectives: ['Examine five evidence sources: press records, batch records, maintenance history, shift data and humidity data.', 'Build a cause-and-effect diagram at the Training Room board.', 'Run a 5 Whys at Press 4.', 'Agree how to verify the root cause with Dr. Haddad in the lab.'],
    learn: ['Root cause analysis and the 5 Whys', 'Cause-and-effect (Ishikawa) diagrams', 'Evidence-based reasoning', 'Correlation is not causation', 'Symptoms versus causes; plausible versus verified'],
  },
  debrief: {
    principle: 'Verify before you act',
    text: 'Root cause analysis moves from symptom to cause through evidence. Fishbone diagrams generate hypotheses; data supports or contradicts them; 5 Whys follows the supported chain to a systemic, actionable cause; and verification (changing the suspected cause under controlled conditions) separates a plausible cause from a verified one. Correlation (humidity) is a lead, not proof.',
  },
  badge: 'Root Cause Investigator',
  reward: { id: 'rca', name: 'Fishbone & 5 Whys kit', desc: 'Templates for structured root cause analysis.' },
  kpiEffect: (k, perf) => { k.rejected -= 30 * perf; k.reworked -= 20 * perf; k.project = 'Root cause verified (Press 4 bladder)'; },
  tasks: [
    recordTask({
      id: 'ev_press', title: 'Review press settings and cure records', station: 'pressdata', prompt: 'review Press 4 settings and cure records',
      record: () => h('div', null, h('h4', null, 'Machine settings (audit trail)'),
        table(['Press', 'Platen temp setpoint', 'Bladder pressure setpoint', 'Cure time', 'Last change'], [['Press 3', '170 °C', '15.2 bar', '12.5 min', '90+ days ago'], { cells: ['Press 4', '170 °C', '15.2 bar', '12.5 min', '90+ days ago'], hl: true }, ['Press 5', '170 °C', '15.2 bar', '12.5 min', '90+ days ago']]),
        h('h4', null, 'Cure records since 2 September'),
        table(['Press', 'Cycles', 'Cycles with hold pressure < 14.6 bar alarm', 'Blister rate'], [['Press 3', '1,420', '0.4%', '0.8%'], { cells: ['Press 4', '1,450', '22%', '6.2%'], hl: true }, ['Press 5', '1,465', '0.6%', '0.9%']])),
      steps: [
        { prompt: 'What do the machine settings tell you about the "wrong recipe" hypothesis?', options: [
          { text: 'They contradict it: all presses share identical, unchanged setpoints', correct: true, feedback: 'The recipe is not the difference between Press 4 and the others.' },
          { text: 'They support it: Press 4 must have a different recipe', correct: false, feedback: 'Read the table: settings are identical across presses.' },
          { text: 'Settings are irrelevant to blisters', correct: false, feedback: 'Settings matter a lot, which is why ruling them out is valuable.' }], points: 8 },
        { prompt: 'What do the cure records show?', options: [
          { text: 'Low hold pressure occurs in 22% of Press 4 cycles but rarely elsewhere, matching where blisters occur. This supports the bladder-pressure hypothesis', correct: true, feedback: 'The difference between presses lines up with the defect. Supportive, but not yet verification.' },
          { text: 'All presses have the same pressure problem', correct: false, feedback: 'Compare 22% with 0.4% and 0.6%.' },
          { text: 'Pressure is proven to be the root cause', correct: false, feedback: 'Strong support, but verification needs a test of the cause (coming later).' }], points: 8 },
      ],
      evidence: [{ id: 'l3-settings', title: 'Setpoints identical on all presses', text: 'Audit trail: no setpoint changes for 90+ days; Press 3/4/5 identical. Contradicts the recipe hypothesis.' }, { id: 'l3-pressure', title: 'Low hold pressure on Press 4 only', text: '22% of Press 4 cycles below the 14.6 bar alarm vs <1% on Presses 3 and 5.' }],
      verdicts: { recipe: 'contradicted', pressure: 'supported' },
    }),
    recordTask({
      id: 'ev_batch', title: 'Review compound batch records', station: 'batchlog', prompt: 'review compound batch records',
      record: () => h('div', null, h('h4', null, 'Compound batches M-5512 to M-5530 (used 2–23 September)'),
        table(['Used on', 'Tyres', 'Blisters', 'Blister rate', 'Batch tests (viscosity, cure rheometer, moisture)'], [['Press 3', '1,420', '11', '0.8%', 'all within limits'], { cells: ['Press 4', '1,450', '90', '6.2%', 'all within limits'], hl: true }, ['Press 5', '1,465', '13', '0.9%', 'all within limits']])),
      steps: [{ prompt: 'What does the batch record do to the material hypothesis?', options: [
        { text: 'It contradicts it as the main cause: the same batches gave normal results on Presses 3 and 5, and tests were within limits', correct: true, feedback: 'If the compound were the cause, all presses using it would be affected.' },
        { text: 'It supports it: the compound must be bad', correct: false, feedback: 'The same compound performed normally elsewhere.' },
        { text: 'Batch data cannot tell us anything', correct: false, feedback: 'Comparing presses that used the same batches is a powerful test.' }], points: 8 }],
      evidence: [{ id: 'l3-batch', title: 'Same compound fine on other presses', text: 'Batches M-5512–5530: 0.8% (P3), 6.2% (P4), 0.9% (P5); all tests within limits. Contradicts material as the main cause.' }],
      verdicts: { material: 'contradicted' },
    }),
    recordTask({
      id: 'ev_maint', title: 'Review maintenance history', station: 'npcMaint', prompt: 'review the Press 4 maintenance history with Kwame',
      record: () => h('div', null, speakerLine('maintenance', 'Here is the Press 4 bladder history. I flagged the cracks, but the change kept getting pushed back.'),
        table(['Date', 'Event'], [['14 Jul', 'New bladder fitted (rated life 3,000 cycles)'], ['2 Sep', 'Bladder reaches 3,000 cycles; replacement planned'], { cells: ['3 Sep', 'Replacement deferred (output priority)'], hl: true }, { cells: ['17 Sep', 'Replacement deferred again (output priority)'], hl: true }, ['20 Sep', 'Visual check: fine surface cracks on bladder shoulder'], ['23 Sep', 'Bladder at 4,450 cycles']])),
      steps: [{ prompt: 'How does the maintenance history relate to the pressure hypothesis?', options: [
        { text: 'It supports it and suggests a mechanism: an over-life, cracked bladder can leak and lose pressure. Blisters began when the bladder passed its rated life', correct: true, feedback: 'Timing and mechanism both line up. Still a hypothesis until tested.' },
        { text: 'It proves the technician is to blame', correct: false, feedback: 'The record shows deliberate deferrals: a system decision, not individual carelessness.' },
        { text: 'It is unrelated to blisters', correct: false, feedback: 'Bladder pressure is what presses the tyre against the mould during cure.' }], points: 8 }],
      evidence: [{ id: 'l3-maint', title: 'Bladder past rated life; deferred twice', text: 'Press 4 bladder at 4,450 cycles vs 3,000 rated; replacement deferred 3 and 17 Sep; cracks noted 20 Sep.' }],
      verdicts: { pressure: 'supported' },
    }),
    recordTask({
      id: 'ev_shift', title: 'Check the shift data', station: 'npcOperator', prompt: 'check the shift data with Tomás',
      record: () => h('div', null, speakerLine('operator', 'Someone said night shift was the problem. Here is the data by shift, so let\'s see.'),
        table(['Press 4 shift', 'Tyres', 'Blisters', 'Blister rate'], [['A (morning)', '492', '30', '6.1%'], ['B (afternoon)', '476', '30', '6.3%'], ['C (night)', '482', '30', '6.2%']])),
      steps: [{ prompt: 'What does the shift data mean for the operator/shift hypothesis?', options: [
        { text: 'It contradicts it: the blister rate is essentially the same on all shifts, so a shift-specific practice is unlikely to be the cause', correct: true, feedback: 'A cause present on every shift (equipment, material or method) is more likely.' },
        { text: 'It supports it: night shift has 30 blisters', correct: false, feedback: 'So do the other shifts. Compare rates, not single numbers.' },
        { text: 'The data shows operators need retraining', correct: false, feedback: 'Nothing here points to a skills gap.' }], points: 8 }],
      evidence: [{ id: 'l3-shift', title: 'No shift effect on Press 4', text: 'Press 4 blister rate: A 6.1%, B 6.3%, C 6.2%. Contradicts the shift hypothesis.' }],
      verdicts: { shift: 'contradicted' },
    }),
    recordTask({
      id: 'ev_env', title: 'Analyse humidity vs blister data', station: 'labBench', prompt: 'analyse humidity data at the lab workstation',
      record: () => h('div', null, h('div', { class: 'chart-box' }, html(scatterSVG(HUMIDITY_SCATTER, { title: 'Weekly humidity vs plant blister rate', xLabel: 'Average relative humidity (%)', yLabel: 'Blister rate (%)' }))),
        h('p', { class: 'muted small' }, 'Note: blisters started rising on 2 September; humidity rose from 9 September. Presses 3 and 5 are in the same hall with normal blister rates.')),
      steps: [{ prompt: 'The scatter diagram shows a clear positive association. What is the right conclusion?', options: [
        { text: 'Humidity is proven to cause the blisters', correct: false, feedback: 'Correlation is not causation. The timing does not fit, and other presses in the same humidity are unaffected.' },
        { text: 'The association is probably coincidental here: blisters rose before humidity did, and presses in the same environment are unaffected. Treat humidity as a weak, unproven factor', correct: true, feedback: 'Excellent reasoning. Both variables happened to rise over the same weeks (late summer); a third factor, the ageing bladder, drives the blisters.' },
        { text: 'The plant should install dehumidifiers immediately', correct: false, feedback: 'Acting on an unverified correlation risks spending money without fixing anything.' }], points: 10 }],
      evidence: [{ id: 'l3-humidity', title: 'Humidity: correlated but not causal', text: 'Strong correlation, but blisters rose before humidity and other presses were unaffected. Weak, unproven factor.' }],
      verdicts: { humidity: 'weak' },
    }),
    { id: 'fishbone', title: 'Build a cause-and-effect diagram', station: 'whiteboard', prompt: 'build a fishbone diagram at the huddle board', run: fishbone },
    { id: 'whys', title: 'Run a 5 Whys at Press 4', station: 'press4', requires: ['ev_press', 'ev_batch', 'ev_maint', 'ev_shift', 'ev_env'], prompt: 'run a 5 Whys analysis at curing press 4', run: fiveWhys },
    { id: 'verify', title: 'Verify the root cause with the lab', station: 'npcLab', requires: ['whys', 'fishbone'], prompt: 'plan the root cause verification with Dr. Haddad', run: verify },
  ],
};
