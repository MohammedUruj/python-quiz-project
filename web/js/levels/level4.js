import { h, html, clear, put } from '../ui.js';
import { decisionSequence, multiSelect, speakerLine } from '../activities.js';
import { compareSVG, lineSVG } from '../charts.js';
import { mean, round, pct } from '../stats.js';

const BASE = { tyres: 1450, blisters: 90, flash: 0.4, downtime: 2.0, inspCost: 0 };
export const BASELINE_RATE = round(pct(BASE.blisters, BASE.tyres, 3), 1); // 6.2

/** Scenario data for each countermeasure: what really happens in the simulation. */
export const COUNTERMEASURES = {
  replace: {
    label: 'Replace the Press 4 bladder now (no change to the PM system)',
    planPoints: 6,
    pilot: { n: 60, blisters: 0 },
    weekly: [0.4, 0.2, 0.4, 0.6, 0.4, 0.6],
    flash: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
    downtime: 2.0, inspCost: 0,
    note: 'End of trial: the new bladder is at 2,880 of 3,000 rated cycles. Its replacement is still scheduled by calendar and can still be deferred without review.',
    outcome: 'temporary', act: 'modify',
  },
  system: {
    label: 'Replace the bladder AND move bladder PM to cycle-count triggers, require a risk review to defer, and escalate repeated pressure alarms',
    planPoints: 10,
    pilot: { n: 60, blisters: 0 },
    weekly: [0.4, 0.2, 0.4, 0.4, 0.2, 0.4],
    flash: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
    downtime: 2.6, inspCost: 0,
    note: 'Bladder changes now trigger at 3,000 cycles; one planned change occurred in week 6 (planned downtime +0.6 percentage points). No deferrals without approval.',
    outcome: 'success', act: 'standardize',
  },
  pressure: {
    label: 'Raise the bladder pressure setpoint by 15% to compensate for the leak',
    planPoints: 2,
    pilot: { n: 60, blisters: 1 },
    weekly: [3.8, 3.4, 3.1, 3.3, 3.0, 3.2],
    flash: [1.9, 2.6, 3.0, 3.4, 3.8, 4.1],
    downtime: 2.9, inspCost: 0,
    note: 'Higher pressure forced rubber into mould vents (flash/overflow rising every week) and the old bladder burst once in week 5 (unplanned downtime).',
    outcome: 'tradeoff', act: 'reverse',
  },
  inspect: {
    label: 'Add a second 100% blister inspection after curing',
    planPoints: 2,
    pilot: { n: 60, blisters: 4 },
    weekly: [6.1, 6.3, 6.0, 6.2, 6.4, 6.1],
    flash: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
    downtime: 2.0, inspCost: 3200,
    note: 'The extra inspector catches blisters before final inspection, but Press 4 still produces them at the same rate. Inspection cost +3,200 per week.',
    outcome: 'none', act: 'reverse',
  },
};

const OUTCOMES = [
  { id: 'success', text: 'Success: the target is met, sustained, with no significant side effects' },
  { id: 'temporary', text: 'Target met during the trial, but the systemic cause is not addressed, so the gain is at risk' },
  { id: 'tradeoff', text: 'Trade-off / deterioration: blisters fell partly, but another characteristic got worse and is still rising' },
  { id: 'none', text: 'No improvement at the source: defects are still being made, only caught (at extra cost)' },
];

const ACTS = {
  standardize: { text: 'Standardise: make it the new standard method and keep monitoring', fb: { success: 'Correct. The change worked and is sustainable, so lock it in.', temporary: 'Standardising "replace when it breaks" leaves the deferral loophole open; the problem will recur.', tradeoff: 'Standardising would lock in a new defect.', none: 'Standardising extra inspection makes detection permanent and leaves the cause in place.' } },
  modify: { text: 'Modify the countermeasure and run another PDCA cycle', fb: { success: 'Nothing needs modifying; the target is met without side effects.', temporary: 'Correct. Keep the new bladder but add the systemic fix (cycle-based PM with deferral control), then check again.', tradeoff: 'This change made things worse in another characteristic. Reverse it rather than tweak it.', none: 'There is nothing to tweak: inspection cannot remove the cause.' } },
  investigate: { text: 'Investigate further before deciding', fb: { success: 'The data is clear and sufficient (2,880 tyres over 6 weeks).', temporary: 'You already know what is missing: the systemic cause. Modify the plan.', tradeoff: 'The cause of the flash increase is obvious (higher pressure). Reverse first.', none: 'The result is unambiguous. Reverse and return to the verified cause.' } },
  reverse: { text: 'Reverse the change and return to the verified cause', fb: { success: 'Reversing a successful change would bring the blisters back.', temporary: 'The new bladder helps; keep it and add the systemic fix.', tradeoff: 'Correct. Undo the pressure increase (it creates flash and bladder bursts) and re-plan around the verified cause.', none: 'Correct. Keep extra inspection only as temporary containment, and re-plan a countermeasure that removes the cause.' } },
};

function cmChooser(state, onPick, tried = []) {
  return h('div', { class: 'options' }, Object.entries(COUNTERMEASURES).map(([id, cm], i) => h('button', {
    class: `option ${tried.includes(id) ? 'tried' : ''}`, onclick: () => onPick(id),
  }, h('span', { class: 'opt-key' }, String.fromCharCode(65 + i)), h('span', null, cm.label, tried.includes(id) ? h('em', { class: 'muted' }, ' (already tried)') : null))));
}

function plan(ctx) {
  put(ctx.body, speakerLine('manager', 'You have a verified cause. Now give me an improvement plan with a baseline, a measurable target and a countermeasure. We will test it before we commit.'));
  const box = h('div'); put(ctx.body, box);
  decisionSequence(box, [
    {
      title: 'PLAN · Define the problem',
      prompt: 'Which problem statement is best?',
      options: [
        { text: 'Quality is bad on Press 4', correct: false, feedback: 'Too vague: no measure, time frame or location.' },
        { text: `Press 4 blister rate rose from <1% to ${BASELINE_RATE}% (${BASE.blisters} of ${BASE.tyres.toLocaleString()} tyres) since 2 September. Verified cause: worn, over-life bladder; systemic contributor: calendar-based PM with uncontrolled deferral`, correct: true, feedback: 'Specific, measured, time-bound, and linked to the verified cause.' },
        { text: 'Operators must be more careful with Press 4', correct: false, feedback: 'Blames people and ignores the verified cause.' },
      ],
      points: 8,
    },
    {
      title: 'PLAN · Baseline',
      prompt: `Calculate the baseline blister rate from the records (${BASE.blisters} blisters in ${BASE.tyres.toLocaleString()} tyres).`,
      options: [
        { text: `${BASELINE_RATE}%`, correct: true, feedback: `${BASE.blisters} ÷ ${BASE.tyres} × 100 = ${pct(BASE.blisters, BASE.tyres, 2)}%.` },
        { text: '9.0%', correct: false, feedback: 'Divide blisters by tyres cured, not by 1,000.' },
        { text: '16.1%', correct: false, feedback: 'That is tyres ÷ blisters. Invert it.' },
        { text: '0.6%', correct: false, feedback: 'Check the decimal place.' },
      ],
      points: 8,
    },
    {
      title: 'PLAN · Target',
      prompt: 'Which target is SMART (specific, measurable, achievable, relevant, time-bound)?',
      options: [
        { text: 'Reduce blisters a lot', correct: false, feedback: 'Not measurable or time-bound.' },
        { text: 'Zero blisters on every press, forever', correct: false, feedback: 'Not realistic. Other presses run at about 0.8% from common causes.' },
        { text: 'Press 4 blister rate ≤ 1.0%, sustained over 6 weeks (≈ 2,900 tyres), with no increase in other defect types', correct: true, feedback: 'Measurable, time-bound, realistic, and it guards against shifting the problem.' },
        { text: `Reduce the blister rate to ${round(BASELINE_RATE - 0.3, 1)}%`, correct: false, feedback: 'Measurable, but far too small to matter.' },
      ],
      points: 8,
    },
  ], (r1) => {
    put(clear(box), h('h4', null, 'PLAN · Select a countermeasure'), h('p', null, 'Choose the countermeasure to test. You will see the consequences in the DO and CHECK stages. There is no feedback now; that is what testing is for.'));
    put(box, cmChooser(ctx.state, (id) => {
      ctx.state.flag('l4_cm', id);
      ctx.state.flag('l4_tried', [id]);
      clear(box);
      multiSelect(box, {
        prompt: 'PLAN · Identify risks to manage during the trial.',
        options: [
          { text: 'The change could shift the problem to another quality characteristic', correct: true, feedback: 'Always monitor related characteristics (e.g. flash, uniformity).' },
          { text: 'Small pilot samples could be misleading', correct: true, feedback: 'Plan a run long enough to detect a real change.' },
          { text: 'More planned downtime or cost', correct: true, feedback: 'Trade-offs should be measured, not discovered later.' },
          { text: 'People may not follow a new procedure without training', correct: true, feedback: 'Changes to method need training and clear standards.' },
          { text: 'Measuring results is unnecessary if the idea is good', correct: false, feedback: 'PDCA without CHECK is guessing.' },
          { text: 'Containment can be removed on day one of the trial', correct: false, feedback: 'Keep containment until the CHECK stage confirms the improvement.' },
        ],
        pointsEach: 3,
      }, (r2) => ctx.finish({ points: r1.points + COUNTERMEASURES[id].planPoints + r2.points, max: r1.max + 10 + r2.max }));
    }));
  });
}

function cycle(ctx) {
  let cmId = ctx.state.flag('l4_cm') || 'replace';
  let tried = ctx.state.flag('l4_tried') || [cmId];
  let points = 0; let cycles = 0;
  const MAX = 34;
  const wrap = h('div'); put(ctx.body, wrap);
  const header = () => h('div', { class: 'pdca-ring' }, ['PLAN', 'DO', 'CHECK', 'ACT'].map((s) => h('span', { class: 'pdca-step', dataset: { s } }, s)));
  const mark = (stage) => wrap.querySelectorAll('.pdca-step').forEach((e) => e.classList.toggle('on', e.dataset.s === stage));

  const runCycle = () => {
    cycles += 1;
    const cm = COUNTERMEASURES[cmId];
    put(clear(wrap), header(), h('p', { class: 'muted' }, `Cycle ${cycles} · Countermeasure: ${cm.label}`));
    mark('DO');
    const stage = h('div'); put(wrap, stage);
    // DO: pilot
    const expected = round((BASELINE_RATE / 100) * cm.pilot.n, 1);
    put(stage, h('h4', null, 'DO · Pilot run (60 tyres)'),
      h('div', { class: 'big-result' }, h('div', null, h('span', null, 'Blisters at the press'), h('b', null, `${cm.pilot.blisters} / ${cm.pilot.n}`)), h('div', null, h('span', null, 'Expected at baseline'), h('b', null, `≈ ${expected}`))));
    const q = h('div'); put(stage, q);
    mark('CHECK');
    decisionSequence(q, [{
      title: 'CHECK · Pilot',
      prompt: 'Is the pilot result enough to judge the countermeasure against the target?',
      options: [
        { text: 'Yes, it proves the countermeasure works', correct: false, feedback: `At the baseline rate you would expect only about ${expected} blisters in 60 tyres, so chance variation is large. 60 tyres cannot confirm a ≤1% target sustained over 6 weeks.` },
        { text: 'Inconclusive: the sample is too small to confirm the 6-week target. Extend the run to the planned 6 weeks', correct: true, feedback: 'Right. Small samples can be encouraging or alarming by chance. Check against the plan, not the first impression.' },
        { text: 'Yes, it proves the countermeasure fails', correct: false, feedback: 'Too few tyres to judge either way.' },
      ],
      points: 6,
    }], (rp) => {
      points += rp.points;
      mark('DO');
      clear(stage);
      const after = round(mean(cm.weekly), 2);
      const flashAfter = round(mean(cm.flash), 2);
      const ppChange = round(after - BASELINE_RATE, 2);
      const relChange = round((ppChange / BASELINE_RATE) * 100, 0);
      put(stage, h('h4', null, 'DO · Extended run (6 weeks, ≈ 2,880 tyres)'),
        h('div', { class: 'chart-box' }, html(lineSVG([{ label: 'Blister %', values: cm.weekly }, { label: 'Flash %', values: cm.flash, cls: 'alt' }], { title: 'Press 4 weekly blister and flash/overflow rates', labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'], unit: '%', target: 1 }))),
        h('div', { class: 'chart-box' }, html(compareSVG([
          { label: 'Blister rate', before: BASELINE_RATE, after, unit: '%', lowerIsBetter: true },
          { label: 'Flash / overflow rate', before: BASE.flash, after: flashAfter, unit: '%', lowerIsBetter: true },
          { label: 'Press downtime', before: BASE.downtime, after: cm.downtime, unit: '%', lowerIsBetter: true },
          { label: 'Extra inspection cost/wk', before: 0, after: cm.inspCost, unit: '', lowerIsBetter: true },
        ], { title: 'Baseline vs 6-week trial', beforeLabel: 'Baseline', afterLabel: '6-week trial' }))),
        h('p', { class: 'note' }, cm.note));
      const q2 = h('div'); put(stage, q2);
      mark('CHECK');
      const changeOpts = [
        { text: `${ppChange > 0 ? '+' : ''}${ppChange} percentage points (${relChange > 0 ? '+' : ''}${relChange}% relative to baseline)`, correct: true, feedback: `${after}% − ${BASELINE_RATE}% = ${ppChange} points; ${ppChange} ÷ ${BASELINE_RATE} = ${relChange}%.` },
        { text: `${ppChange > 0 ? '+' : ''}${relChange} percentage points`, correct: false, feedback: 'You have mixed up the relative change (%) with the absolute change (percentage points).' },
        { text: `${round(BASELINE_RATE - ppChange, 2)}%`, correct: false, feedback: 'Subtract the baseline from the result: after − before.' },
      ];
      if (changeOpts[0].text === changeOpts[1].text) changeOpts.splice(1, 1);
      decisionSequence(q2, [
        { title: 'CHECK · Calculate', prompt: `Average blister rate in the trial was ${after}%. What is the change from the ${BASELINE_RATE}% baseline?`, options: changeOpts, points: 8 },
        {
          title: 'CHECK · Judge',
          prompt: 'Compare the result with the target (≤ 1.0%, no increase in other defects) and the side information. How would you classify the outcome?',
          options: OUTCOMES.map((o) => ({ text: o.text, correct: o.id === cm.outcome, feedback: o.id === cm.outcome ? 'That matches the data.' : 'Look again at the trend lines, the side effects and the note under the charts.' })),
          points: 10,
        },
        {
          title: 'ACT',
          prompt: 'What is the right ACT decision?',
          options: Object.entries(ACTS).map(([id, a]) => ({ text: a.text, correct: id === cm.act, feedback: a.fb[cm.outcome] })),
          points: 10,
        },
      ], (rc) => {
        points += rc.points;
        mark('ACT');
        clear(stage);
        if (cm.act === 'standardize') {
          put(stage, h('div', { class: 'feedback good' }, h('strong', null, `Improvement confirmed after ${cycles} cycle${cycles > 1 ? 's' : ''}. `), cycles > 1 ? 'Each cycle taught you something: that is PDCA working as intended.' : 'Right first time, backed by data.'),
            h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => {
              ctx.evidence({ id: 'l4-success', title: 'PDCA: improvement confirmed', text: `Cycle-based bladder PM with deferral control: blister rate ${BASELINE_RATE}% → ${after}% over 6 weeks; planned downtime +0.6 points.` });
              ctx.state.flag('l4_cycles', cycles);
              ctx.finish({ points: Math.min(MAX, points), max: MAX });
            } }, 'Go to standardisation')));
        } else {
          tried = [...new Set([...tried, cmId])];
          ctx.state.flag('l4_tried', tried);
          put(stage, h('div', { class: 'feedback' }, h('strong', null, 'Back to PLAN. '), cm.act === 'modify' ? 'Keep what worked and add what was missing.' : 'The change has been reversed. Choose a countermeasure that addresses the verified cause.'),
            h('h4', null, 'PLAN · Choose the next countermeasure'),
            cmChooser(ctx.state, (id) => { cmId = id; ctx.state.flag('l4_cm', id); runCycle(); }, tried));
        }
      });
    });
  };
  runCycle();
}

function standardise(ctx) {
  put(ctx.body, speakerLine('manager', 'Excellent work. Before we close this, how do we make sure the gain sticks and spreads?'));
  const box = h('div'); put(ctx.body, box);
  multiSelect(box, {
    prompt: 'ACT · Which actions standardise and sustain the improvement?',
    options: [
      { text: 'Update the maintenance procedure: bladder change at 3,000 cycles; deferral only with documented risk review', correct: true, feedback: 'The new method becomes the standard.' },
      { text: 'Train maintenance planners, supervisors and operators on the new rule and the alarm escalation', correct: true, feedback: 'People need to know the new standard.' },
      { text: 'Add bladder pressure to the control plan with SPC monitoring and a reaction plan', correct: true, feedback: 'Detects the next drift early.' },
      { text: 'Apply the same cycle-based PM to all curing presses (horizontal deployment)', correct: true, feedback: 'Spreads the learning to similar equipment (yokoten).' },
      { text: 'Remove all containment checks immediately and permanently, without data', correct: false, feedback: 'Containment is removed based on confirmed results, in a controlled way.' },
      { text: 'Stop measuring the blister rate since the problem is solved', correct: false, feedback: 'Continue monitoring to confirm the gain is sustained.' },
    ],
    pointsEach: 4,
  }, (r) => {
    ctx.evidence({ id: 'l4-standard', title: 'New standard: cycle-based bladder PM', text: 'PM procedure updated, training given, bladder pressure on SPC, deployed to all presses.' });
    ctx.finish(r);
  });
}

export const level = {
  id: 'l4',
  num: 4,
  title: 'The PDCA Improvement Lab',
  area: 'curing',
  briefing: {
    speaker: 'manager',
    text: 'You found and verified the cause. Now improve it, properly. Plan the change with a baseline and target, test it, check the data honestly, and act on what you learn. Not every countermeasure works, and that is fine as long as we learn from it.',
    objectives: ['PLAN at the Training Room board: problem, baseline, target, countermeasure, risks.', 'DO, CHECK and ACT at Press 4, repeating the cycle if needed.', 'Standardise the result with Elena.'],
    learn: ['The Plan-Do-Check-Act cycle', 'Baselines and SMART targets', 'Absolute vs relative change', 'Inconclusive results and sample size', 'Trade-offs and standardisation'],
  },
  debrief: {
    principle: 'PDCA: learn your way to a sustainable improvement',
    text: 'PLAN defines the problem, baseline, target and countermeasure. DO tests it on a controlled scale. CHECK compares results with the baseline and target, including side effects. ACT standardises what works, modifies what partly works and reverses what does not. Then the cycle begins again from the new standard.',
  },
  badge: 'PDCA Master',
  reward: { id: 'pdca', name: 'PDCA board', desc: 'A one-page Plan-Do-Check-Act template.' },
  kpiEffect: (k, perf) => { k.rejected -= 110 * perf; k.reworked -= 60 * perf; k.confidence += 3 * perf; k.project = 'Press 4 improvement standardised'; },
  tasks: [
    { id: 'plan', title: 'PLAN the improvement', station: 'whiteboard', prompt: 'plan the improvement at the huddle board', run: plan },
    { id: 'cycle', title: 'DO, CHECK and ACT at Press 4', station: 'press4', requires: ['plan'], prompt: 'run the improvement trial at curing press 4', run: cycle },
    { id: 'standard', title: 'Standardise with Elena', station: 'npcManager', requires: ['cycle'], prompt: 'agree the new standard with Elena', run: standardise },
  ],
};
