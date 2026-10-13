import { h, html, put } from '../ui.js';
import { tyreSVG, NPCS } from '../art.js';
import { classifyItems, decisionSequence, speakerLine } from '../activities.js';

const METHODS = [
  { value: 'visual', label: 'Appearance → visual check' },
  { value: 'dim', label: 'Dimensional / uniformity → measurement' },
  { value: 'internal', label: 'Internal / structural → X-ray (NDT)' },
  { value: 'cure', label: 'Curing-related → hold + lab cure test' },
  { value: 'ok', label: 'Conforming → release' },
];

const CASES = [
  { id: 'c1', art: tyreSVG('flash', { size: 84 }), label: 'Tyre Q-118', detail: 'Thin rubber spews (excess flash) around the tread from mould vents. Gauge, uniformity and cure records normal.', answer: 'visual', feedback: 'Appearance defect, assessed visually against the trimming standard.', hint: 'The issue is on the surface and visible; all measurements are normal.' },
  { id: 'c2', art: tyreSVG('none', { size: 84 }), label: 'Tyre Q-121', detail: 'Looks normal, but the tread-width gauge reads 2.1 mm above the maximum.', answer: 'dim', feedback: 'Dimensional nonconformity, confirmed by measurement, not by eye.', hint: 'A measured characteristic is outside its limit.' },
  { id: 'c3', art: tyreSVG('none', { size: 84 }), label: 'Tyre Q-127', detail: 'Looks normal. Uniformity machine reports radial force variation above the limit.', answer: 'dim', feedback: 'A uniformity nonconformity, invisible to the eye and found only by the uniformity machine.', hint: 'Which machine produced this finding?' },
  { id: 'c4', art: tyreSVG('bulge', { size: 84 }), label: 'Tyre Q-133', detail: 'Visible bulge on the upper sidewall.', answer: 'internal', feedback: 'The bulge is visible, but its cause (a possible ply/cord separation) is internal. X-ray or another approved NDT method is needed, and the tyre must not be released.', hint: 'You can see the symptom, but what might be happening inside the carcass?' },
  { id: 'c5', art: tyreSVG('none', { size: 84 }), label: 'Tyre Q-140', detail: 'Looks normal. Press log shows this cure cycle ended 40 s early after a timer fault.', answer: 'cure', feedback: 'Possible under-cure cannot be seen. Hold the tyre (and others from that cycle window) and test cure state in the lab.', hint: 'The evidence is in the process record, not on the tyre surface.' },
  { id: 'c6', art: tyreSVG('none', { size: 84 }), label: 'Tyre Q-142', detail: 'Visual, gauge and uniformity checks all within limits. Press records normal.', answer: 'ok', feedback: 'All checks conform: release per the standard inspection plan.', hint: 'Is there any evidence of nonconformity at all?' },
];

const INTERVIEWS = {
  supervisor: {
    npc: 'supervisor',
    intro: 'Final inspection is there to catch bad tyres. Ask me anything, but I need output.',
    statements: [
      { id: 's1', text: '"Final inspection is there to catch defects. If more tyres are bad, inspection should just reject more."', answer: 'opinion', feedback: 'An opinion reflecting a detection mindset, not evidence about the cause.', hint: 'Does this tell you anything about where or why defects occur?' },
      { id: 's2', text: '"Our reject rate has gone from about 3.1% to 4.9% over the last three weeks."', answer: 'useful', feedback: 'Quantified, with a time frame: a useful lead.', hint: 'It contains numbers and a time frame you can check.', ev: { title: 'Rejects rising for 3 weeks', text: 'Supervisor: reject rate rose from ~3.1% to 4.9% over three weeks.' } },
      { id: 's3', text: '"The output target was raised by 8% this month, so the presses are running flat out."', answer: 'useful', feedback: 'A relevant change in conditions worth noting (not proof of anything yet).', hint: 'Changes that coincide with a problem are worth recording.', ev: { title: 'Output target +8%', text: 'Supervisor: output target raised by 8% this month; presses running at full load.' } },
    ],
  },
  operator: {
    npc: 'operator',
    intro: 'I run presses 4 and 5 on A-shift. Happy to help.',
    statements: [
      { id: 'o1', text: '"Press 4 has given a low bladder-pressure alarm a few times per shift lately. It clears when I reset it."', answer: 'useful', feedback: 'A specific, checkable observation from the person closest to the process.', hint: 'It is specific, recent and can be checked in the press data.', ev: { title: 'Press 4 pressure alarms', text: 'Operator: Press 4 gives low bladder-pressure alarms several times per shift; they clear on reset.' } },
      { id: 'o2', text: '"Night shift always does worse work than us."', answer: 'opinion', feedback: 'An unsupported generalisation. Check shift data before believing it, and avoid blaming groups of people.', hint: 'Is there any data behind this claim?' },
      { id: 'o3', text: '"I follow the curing recipe on the screen. The setpoints have not changed."', answer: 'useful', feedback: 'Useful, and it can be verified in the press audit trail.', hint: 'Can this be checked against records?', ev: { title: 'Setpoints reportedly unchanged', text: 'Operator: curing recipe setpoints have not changed (to verify in press records).' } },
    ],
  },
  inspector: {
    npc: 'inspector',
    intro: 'I see every tyre at the end of the line. Here is what I have noticed.',
    statements: [
      { id: 'i1', text: '"Most of the extra rejects I see are sidewall blisters."', answer: 'useful', feedback: 'Narrows down the defect type: a useful lead.', hint: 'Does it narrow down the problem?', ev: { title: 'Blisters dominate rejects', text: 'Inspector: most additional rejects are sidewall blisters.' } },
      { id: 'i2', text: '"The blistered tyres I traced came mostly from curing line B."', answer: 'useful', feedback: 'Points to where in the process the defect may originate.', hint: 'Does it point to a location in the process?', ev: { title: 'Blisters traced to line B', text: 'Inspector: traced blistered tyres mostly came from curing line B.' } },
      { id: 'i3', text: '"Customers never notice small blisters anyway."', answer: 'opinion', feedback: 'An opinion, and a risky one: it ignores customer requirements and possible underlying causes.', hint: 'Is this a fact about the process, or an attitude?' },
    ],
  },
  maintenance: {
    npc: 'maintenance',
    intro: 'Maintenance here. We keep 12 presses running, which is not easy at current output.',
    statements: [
      { id: 'm1', text: '"The Press 4 bladder replacement was postponed twice to keep output up."', answer: 'useful', feedback: 'A specific equipment fact that coincides with the problem period.', hint: 'Is this a specific, checkable fact about equipment?', ev: { title: 'Press 4 bladder change postponed', text: 'Maintenance: Press 4 curing bladder replacement postponed twice to protect output.' } },
      { id: 'm2', text: '"The canteen coffee machine has been broken all week."', answer: 'opinion', feedback: 'Not relevant to the defect investigation.', hint: 'Does this relate to tyre quality?' },
      { id: 'm3', text: '"Preventive maintenance on presses is scheduled by calendar date, not by cycle count."', answer: 'useful', feedback: 'A useful systemic fact about how maintenance is managed.', hint: 'This describes how the maintenance system works.', ev: { title: 'PM scheduled by calendar', text: 'Maintenance: press PM is scheduled by calendar date, not cycle count.' } },
    ],
  },
};

function interviewTask(key, title, station) {
  const iv = INTERVIEWS[key];
  return {
    id: `iv_${key}`, title, station, group: 'Interview personnel', prompt: `interview ${NPCS[iv.npc].name}`,
    run(ctx) {
      put(ctx.body, speakerLine(iv.npc, iv.intro));
      const box = h('div');
      put(ctx.body, box);
      classifyItems(box, {
        intro: 'Sort each statement: is it a useful lead to follow up, or an opinion / irrelevant? Good investigators separate facts from assumptions without dismissing the people who share them.',
        items: iv.statements.map((s) => ({ id: s.id, label: s.text, answer: s.answer, feedback: s.feedback, hint: s.hint })),
        categories: [{ value: 'useful', label: 'Useful lead to verify' }, { value: 'opinion', label: 'Opinion / not relevant' }],
        pointsEach: 4,
      }, (r) => {
        iv.statements.filter((s) => s.ev).forEach((s) => ctx.evidence({ id: `l1-${s.id}`, ...s.ev }));
        ctx.finish(r);
      });
    },
  };
}

export const level = {
  id: 'l1',
  num: 1,
  title: 'The Defective Tyre Mystery',
  area: 'inspection',
  briefing: {
    speaker: 'manager',
    text: 'The percentage of rejected tyres has risen sharply. Rajesh, our production supervisor, says final inspection should simply reject the bad ones. I want you to investigate the process instead of accepting that explanation.',
    objectives: ['Inspect and classify suspect tyres at Final Inspection.', 'Interview the supervisor, operator, inspector and maintenance technician.', 'Report to Elena: classify the problem, choose containment and the next investigative step.'],
    learn: ['Customer focus and quality at the source', 'Prevention versus detection', 'Basic defect classification and inspection methods', 'Containment versus investigation', 'Cost of poor quality'],
  },
  debrief: {
    principle: 'Prevention at the source, with containment while you investigate',
    text: 'Inspection is necessary, but it only detects defects after they are made. TQM manages work as processes: you find where the defect is created and fix the cause there. Meanwhile, proportionate containment (holding and checking suspect product) protects the customer. Not every defect is visible, so the inspection method must match the type of nonconformity.',
  },
  badge: 'Defect Detective',
  reward: { id: 'checksheet', name: 'Check sheet', desc: 'A structured form for collecting defect data at the source.' },
  kpiEffect: (k, perf) => { k.complaints -= Math.round(2 * perf); k.confidence += 4 * perf; k.project = 'Investigation started'; },
  tasks: [
    {
      id: 'inspect', title: 'Classify suspect tyres', station: 'inspectTable', prompt: 'inspect suspect tyres at the inspection station',
      run(ctx) {
        classifyItems(ctx.body, {
          intro: 'Six tyres were set aside today. For each, decide what kind of nonconformity (if any) is present and which inspection method can confirm it. Not every defect can be seen.',
          items: CASES,
          categories: METHODS,
          pointsEach: 5,
        }, (r) => {
          ctx.evidence({ id: 'l1-methods', title: 'Inspection method must match defect type', text: 'Visual checks find appearance defects; measurement finds dimensional/uniformity issues; X-ray finds internal defects; cure problems need records + lab tests.' });
          ctx.finish(r);
        });
      },
    },
    interviewTask('supervisor', 'Interview the production supervisor', 'npcSupervisor'),
    interviewTask('operator', 'Interview the curing operator', 'npcOperator'),
    interviewTask('inspector', 'Interview the quality inspector', 'npcInspector'),
    interviewTask('maintenance', 'Interview the maintenance technician', 'npcMaint'),
    {
      id: 'decide', title: 'Report to Elena: make a quality decision', station: 'npcManager', requires: ['inspect', 'iv_supervisor', 'iv_operator', 'iv_inspector', 'iv_maintenance'], prompt: 'report your findings to Elena',
      run(ctx) {
        const copq = h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, h('th', null, 'Weekly cost of poor quality (fictional)'), h('th', null, 'Category'), h('th', { class: 'num' }, 'Cost'))),
          h('tbody', null,
            h('tr', null, h('td', null, 'Scrapped tyres: 588 × 62'), h('td', null, 'Internal failure'), h('td', { class: 'num' }, '36,456')),
            h('tr', null, h('td', null, 'Rework: 744 × 9'), h('td', null, 'Internal failure'), h('td', { class: 'num' }, '6,696')),
            h('tr', null, h('td', null, 'Extra sorting inspection'), h('td', null, 'Appraisal'), h('td', { class: 'num' }, '4,800')),
            h('tr', null, h('td', null, 'Complaints, warranty, freight (≈ per week)'), h('td', null, 'External failure'), h('td', { class: 'num' }, '18,900')),
            h('tr', null, h('td', null, 'Operator training & PM planning'), h('td', null, 'Prevention'), h('td', { class: 'num' }, '2,100'))));
        decisionSequence(ctx.body, [
          {
            speaker: 'manager', scenario: 'You have inspected the tyres and heard from four colleagues. What are we dealing with?',
            prompt: 'How should the problem be classified, based on the evidence collected?',
            options: [
              { text: 'An inspection problem: inspectors need to reject more tyres', correct: false, feedback: 'Inspection is already finding the defects. The evidence points to where they are created.' },
              { text: 'A recurring, process-originated defect (mainly sidewall blisters, concentrated on curing line B) that began about three weeks ago', correct: true, feedback: 'This statement uses the evidence: defect type, location and timing. It frames the issue as a process problem to investigate.' },
              { text: 'An operator discipline problem on the night shift', correct: false, feedback: 'No data supports this, and blaming people closes the investigation too early.' },
              { text: 'A perception problem: nothing has really changed', correct: false, feedback: 'The reject rate rose from about 3.1% to 4.9%. That is a real change.' },
            ],
            points: 10,
          },
          {
            speaker: 'supervisor', scenario: 'We cannot stop the line. Let inspection deal with it.',
            prompt: 'What immediate containment is appropriate while the cause is investigated?',
            options: [
              { text: 'Increase final inspection only and continue as normal', correct: false, feedback: 'Extra inspection can be part of containment, but on its own it treats the symptom and lets the cause continue unchecked.' },
              { text: 'Hold and 100% inspect suspect tyres from curing line B made in the last three weeks, add a temporary blister check at curing, and start a root cause investigation', correct: true, feedback: 'Proportionate containment protects the customer now, targeted at the suspect population, while the investigation finds the cause.' },
              { text: 'Stop all production in the plant indefinitely until the cause is found', correct: false, feedback: 'Disproportionate here. Stopping a process can be the right call when a safety risk demands it under approved procedures, but an indefinite plant-wide stop is not justified by this evidence.' },
              { text: 'Wait for more customer complaints to confirm the problem', correct: false, feedback: 'Waiting lets defective tyres reach customers: the most expensive and damaging outcome.' },
            ],
            points: 10,
          },
          {
            speaker: 'manager', scenario: 'Containment is in place. Where do we go next?',
            prompt: 'What is the best next investigative step?',
            options: [
              { text: 'Replace every curing bladder in the plant immediately', correct: false, feedback: 'This jumps to a solution before the cause is verified, and may waste money without fixing anything.' },
              { text: 'Retrain the night shift', correct: false, feedback: 'There is no evidence that shift matters, and training is a solution, not an investigation.' },
              { text: 'Stratify reject data by press, shift and material batch, and review Press 4 pressure records and maintenance history', correct: true, feedback: 'Collecting and separating the data tests the leads you gathered (Press 4 alarms, postponed bladder change) without assuming the answer.' },
              { text: 'Ask customers whether they are satisfied', correct: false, feedback: 'Customer feedback matters, but it will not locate the process cause of this defect.' },
            ],
            points: 10,
          },
          {
            title: 'Cost of poor quality',
            extra: () => copq,
            prompt: 'Elena asks you to summarise the cost of poor quality. Which statement is correct?',
            options: [
              { text: 'Inspection (appraisal) is the largest cost, so cutting inspection is the priority', correct: false, feedback: 'Appraisal is the smallest failure-related cost here, and cutting it would increase escapes.' },
              { text: 'Failure costs (internal + external ≈ 62,000/week) dwarf prevention (2,100/week), so investing in prevention at the source pays back', correct: true, feedback: 'Correct. External failures also damage customer trust, which the table does not even capture.' },
              { text: 'External failures cost nothing because the customer pays for them', correct: false, feedback: 'Warranty, freight, replacements and lost reputation all fall on the manufacturer.' },
            ],
            points: 10,
          },
        ], (r) => ctx.finish(r), { finishLabel: 'Complete the report' });
      },
    },
  ],
};
