import { h, clear, put } from '../ui.js';
import { decisionSequence, multiSelect, classifyItems, speakerLine } from '../activities.js';

/** Fictional customer indicators driven by how well each step of the response was handled. */
export function customerMeters(perf) {
  const p = (k) => (perf[k] == null ? 0 : perf[k]);
  const done = (k) => perf[k] != null;
  const confidence = Math.round(38 + 10 * p('review') + 16 * p('escalate') + 8 * p('team') + 12 * p('trace') + 12 * p('actions'));
  const recurrence = Math.round(85 - 10 * p('trace') - 45 * p('actions') - 10 * p('team'));
  const delivery = Math.round((96 - (done('escalate') ? 3 : 0) + (done('actions') ? 2.5 * p('actions') : 0)) * 10) / 10;
  const cost = Math.round(60 + (done('escalate') ? 25 : 0) - 40 * p('actions') - 10 * p('trace'));
  return { confidence, recurrence, delivery, cost };
}

function meterPanel(state) {
  const m = customerMeters(state.flag('l5_perf') || {});
  const bar = (label, v, max, unit, good) => h('div', { class: 'meter' }, h('span', null, label), h('div', { class: 'meter-bar' }, h('i', { class: good ? 'good' : 'bad', style: { width: `${Math.max(2, Math.min(100, (v / max) * 100))}%` } })), h('b', null, `${v}${unit}`));
  return h('div', { class: 'meters' },
    bar('Customer confidence', m.confidence, 100, '/100', m.confidence >= 60),
    bar('Recurrence risk', m.recurrence, 100, '%', m.recurrence < 40),
    bar('On-time delivery', m.delivery, 100, '%', m.delivery >= 95),
    bar('Response cost index', m.cost, 120, '', m.cost < 60),
    h('p', { class: 'muted small' }, 'Fictional simulation indicators, not predictions of real customer behaviour.'));
}

function setPerf(state, key, value) {
  state.flag('l5_perf', { ...(state.flag('l5_perf') || {}), [key]: value });
}

const COMPLAINT = () => h('div', { class: 'complaint' },
  h('div', { class: 'complaint-head' }, h('b', null, 'Customer complaint CC-0912'), h('span', { class: 'tag bad' }, 'URGENT')),
  h('p', null, h('b', null, 'From: '), 'Northline Fleet Services (fictional distributor)'),
  h('p', null, h('b', null, 'Product: '), 'Qualitrax QX 205/55 R16, delivery DN-8841 (120 tyres)'),
  h('p', null, '"During pre-fitment inspection on 24 September our technicians found a bulge in the sidewall of three new tyres. The tyres have not been fitted. Photos attached. Serial numbers on two tyres are partly unreadable in the photos: 3725-04-11?? and 3725-04-12??. We need to know what is going on. Our fleet customers are asking questions."'),
  h('p', { class: 'muted small' }, 'Attachments: 3 photos (bulge visible on upper sidewall).'));

export const level = {
  id: 'l5',
  num: 5,
  title: 'The Customer Complaint Crisis',
  area: 'control',
  briefing: {
    speaker: 'customer',
    text: 'I handle customer quality. We have a serious complaint: sidewall bulges on new tyres. Management wants a fast answer, but fast must not mean careless. We coordinate across functions, follow our safety and nonconformity procedures, and we never promise what we have not verified.',
    objectives: ['Review the complaint and identify missing information.', 'Assess seriousness and escalate with Elena (required safety procedure).', 'Organise the cross-functional team at the huddle board.', 'Trace the manufacturing history with the lab.', 'Define corrective and preventive actions and effectiveness checks.'],
    learn: ['Voice of the customer', 'Severity, escalation and traceability', 'Correction vs containment vs corrective vs preventive action', 'Cross-functional problem solving', 'Effectiveness checks'],
  },
  debrief: {
    principle: 'Customer focus means facts, speed and follow-through',
    text: 'A good complaint response protects the customer first (containment), escalates potential safety issues through approved procedures, uses traceability to define the affected population, investigates the cause with evidence, and communicates honestly. Corrective action removes the cause; preventive action addresses similar risks before they occur; effectiveness checks prove the fix worked.',
  },
  badge: 'Customer Champion',
  reward: { id: 'complaint-kit', name: 'Complaint response checklist', desc: 'Contain, escalate, trace, investigate, correct, prevent, verify, communicate.' },
  kpiEffect: (k, perf) => { k.complaints -= Math.round(4 * perf); k.confidence += 10 * perf; k.project = 'Complaint CC-0912 closed with verified actions'; },
  tasks: [
    {
      id: 'review', title: 'Review the complaint', station: 'complaintDesk', prompt: 'review the new customer complaint',
      run(ctx) {
        put(ctx.body, meterPanel(ctx.state), COMPLAINT());
        const box = h('div'); put(ctx.body, box);
        multiSelect(box, {
          prompt: 'What information is missing or needed before the investigation can proceed?',
          options: [
            { text: 'Complete serial / production (DOT) codes of the affected tyres, for traceability', correct: true, feedback: 'Traceability defines when, where and how the tyres were made, and which others may be affected.' },
            { text: 'Return of the affected tyres (or samples) for laboratory analysis', correct: true, feedback: 'Physical analysis is essential to understand the defect.' },
            { text: 'Storage and handling conditions since delivery', correct: true, feedback: 'Needed to assess all possible causes objectively, without assuming misuse.' },
            { text: 'Whether any tyres from the delivery were fitted or sold on', correct: true, feedback: 'Determines how far containment must reach.' },
            { text: 'The distributor\'s annual purchase volume', correct: false, feedback: 'Commercial value must not change how a quality issue is handled.' },
            { text: 'Which competitor brands they also stock', correct: false, feedback: 'Irrelevant to this investigation.' },
          ],
          pointsEach: 4,
        }, (r) => {
          setPerf(ctx.state, 'review', r.points / r.max);
          ctx.evidence({ id: 'l5-complaint', title: 'Complaint CC-0912: sidewall bulges', text: '3 of 120 tyres (DN-8841) with sidewall bulges found before fitment; partial serials 3725-04-11xx/12xx; tyres to be returned.' });
          ctx.finish(r);
        });
      },
    },
    {
      id: 'escalate', title: 'Assess seriousness and escalate', station: 'npcManager', requires: ['review'], prompt: 'assess the complaint with Elena',
      run(ctx) {
        put(ctx.body, h('div', { class: 'safety-banner', role: 'note' }, h('b', null, 'Safety procedure (not scored). '), 'Potentially safety-critical tyre defects must be handled through your organisation\'s approved safety, traceability, escalation and nonconformity procedures. This step is required to continue, but it is not a points puzzle.'), meterPanel(ctx.state));
        const box = h('div'); put(ctx.body, box);
        decisionSequence(box, [
          {
            speaker: 'manager', scenario: 'The sales director wants this "made to go away quickly". What is your assessment?',
            prompt: 'How serious is a sidewall bulge on a new tyre?',
            options: [
              { text: 'Potentially safety-critical: a bulge can indicate internal structural separation. Treat it as high severity until evaluated', correct: true, feedback: 'Correct. Severity is judged by the potential consequence, not by how many tyres are affected so far.' },
              { text: 'Cosmetic: the tyres were not even fitted', correct: false, feedback: 'A bulge is not cosmetic. It may indicate a structural defect.' },
              { text: 'Probably customer damage; low priority', correct: false, feedback: 'There is no evidence of misuse. Assumptions like this delay containment.' },
            ],
            points: 0,
          },
          {
            prompt: 'What is the appropriate immediate response?',
            options: [
              { text: 'Escalate immediately under the approved procedure (quality manager / product safety), place suspect stock on hold using traceability, ask the customer to keep the delivery quarantined, and arrange return of the tyres', correct: true, feedback: 'Escalation, containment and evidence collection happen in parallel, through authorised channels.' },
              { text: 'Send three replacement tyres and close the complaint', correct: false, feedback: 'Replacement is a correction, but it ignores other affected tyres and the cause.' },
              { text: 'Tell the customer the bulges were caused by misuse', correct: false, feedback: 'Never make unsupported claims. It damages trust and may leave unsafe product in the field.' },
              { text: 'Personally announce a recall of every tyre made this year', correct: false, feedback: 'Recall and field actions are decided by authorised people under approved procedures, based on evidence. Your role is to escalate promptly with the facts.' },
            ],
            points: 0,
          },
          {
            prompt: 'Which population should containment cover first?',
            options: [
              { text: 'Only the three tyres in the photos', correct: false, feedback: 'Other tyres made under the same conditions may have the same defect.' },
              { text: 'Tyres made under the same conditions, identified by traceability (production window, press, line), wherever they are: warehouse, in transit and at customers', correct: true, feedback: 'Traceability lets containment be targeted and complete. The scope is refined as evidence comes in.' },
              { text: 'Nothing until the lab report arrives', correct: false, feedback: 'Containment protects customers while the investigation runs.' },
            ],
            points: 0,
          },
        ], (r) => {
          const firstTry = r.record.filter((x) => x.attempts === 1).length / r.record.length;
          setPerf(ctx.state, 'escalate', firstTry);
          ctx.evidence({ id: 'l5-escalated', title: 'Escalated under safety procedure', text: 'Treated as potentially safety-critical; suspect stock on hold; customer asked to quarantine; tyres returned for analysis.' });
          ctx.finish({ points: 0, max: 0 });
        }, { finishLabel: 'Escalate and contain' });
      },
    },
    {
      id: 'team', title: 'Organise the cross-functional team', station: 'whiteboard', requires: ['escalate'], prompt: 'organise the response team at the huddle board',
      run(ctx) {
        put(ctx.body, meterPanel(ctx.state));
        const box = h('div'); put(ctx.body, box);
        classifyItems(box, {
          intro: 'Assign each task to the function best placed to own it. Complaints are solved across departments, not by Quality alone.',
          categories: [{ value: 'prod', label: 'Production' }, { value: 'qa', label: 'Quality / Lab' }, { value: 'eng', label: 'Engineering' }, { value: 'maint', label: 'Maintenance' }, { value: 'cs', label: 'Customer service' }],
          items: [
            { id: 't1', label: 'Pull build and cure records for the affected serial numbers', answer: ['prod', 'qa'], feedback: 'Production owns the records; Quality often runs the trace.', hint: 'Who holds the production records?' },
            { id: 't2', label: 'X-ray and section the returned tyres', answer: 'qa', feedback: 'Laboratory analysis is a Quality function.', hint: 'Which function owns the X-ray room?' },
            { id: 't3', label: 'Review design margins and whether this failure mode is known', answer: 'eng', feedback: 'Product engineering owns design knowledge and the DFMEA.', hint: 'Who owns the tyre design?' },
            { id: 't4', label: 'Confirm Press 4 bladder history for the build dates', answer: 'maint', feedback: 'Maintenance holds the equipment history.', hint: 'Who keeps the bladder change records?' },
            { id: 't5', label: 'Keep the customer informed with factual updates on agreed dates', answer: 'cs', feedback: 'One clear voice to the customer, with facts agreed by the team.', hint: 'Who is the customer\'s contact?' },
            { id: 't6', label: 'Check warehouse stock and shipments from the same production window', answer: ['qa', 'prod'], feedback: 'Quality leads containment; Production/logistics support it.', hint: 'Who leads containment?' },
          ],
          pointsEach: 4,
        }, (r) => { setPerf(ctx.state, 'team', r.points / r.max); ctx.finish(r); });
      },
    },
    {
      id: 'trace', title: 'Trace the manufacturing history', station: 'npcLab', requires: ['escalate'], prompt: 'trace the returned tyres with Dr. Haddad',
      run(ctx) {
        put(ctx.body, meterPanel(ctx.state), speakerLine('lab', 'The tyres arrived this morning. The full serials are readable on the actual tyres. Click each one to pull its traceability record.'));
        const recs = [
          { s: 'QX-3725-04-1187', built: '9 Sep, building machine 2', cure: 'Press 4, cycle 3,468', p: 'hold pressure min 14.2 bar (alarm 14.6)', batch: 'M-5519' },
          { s: 'QX-3725-04-1203', built: '10 Sep, building machine 3', cure: 'Press 4, cycle 3,532', p: 'hold pressure min 14.3 bar (alarm 14.6)', batch: 'M-5521' },
          { s: 'QX-3725-04-1219', built: '11 Sep, building machine 2', cure: 'Press 4, cycle 3,601', p: 'hold pressure min 14.1 bar (alarm 14.6)', batch: 'M-5524' },
        ];
        const shown = new Set();
        const list = h('div', { class: 'trace-list' }, recs.map((r) => {
          const out = h('div', { class: 'trace-out' });
          return h('div', { class: 'trace-row' }, h('button', { class: 'btn', onclick: (e) => {
            shown.add(r.s); e.currentTarget.disabled = true;
            put(clear(out), h('span', null, `Built: ${r.built}`), h('span', null, `Cured: ${r.cure}`), h('span', { class: 'bad-text' }, r.p), h('span', null, `Compound: ${r.batch}`));
            if (shown.size === recs.length) next();
          } }, `Trace ${r.s}`), out);
        }));
        const box = h('div');
        put(ctx.body, list, box);
        const next = () => decisionSequence(box, [
          {
            prompt: 'What do the three traceability records have in common?',
            options: [
              { text: 'All were cured on Press 4 in week 37 during the low-pressure period, from different compound batches and building machines', correct: true, feedback: 'The common factor is Press 4 during the period of low hold pressure. Different batches and machines make those less likely causes.' },
              { text: 'All came from the same compound batch', correct: false, feedback: 'Check the batch numbers: M-5519, M-5521, M-5524.' },
              { text: 'All were built on the same building machine', correct: false, feedback: 'Machines 2 and 3 were both involved.' },
            ],
            points: 8,
          },
          {
            title: 'Lab result',
            scenario: 'X-ray and sectioning: all three tyres show a ply separation in the upper sidewall under the bulge. Bond surfaces show poor adhesion, consistent with insufficient cure pressure. No foreign material, no impact damage.',
            prompt: 'What does this tell you?',
            options: [
              { text: 'The defect is manufacturing-related and consistent with the verified Press 4 low-pressure cause, so the affected population is Press 4 output during that period', correct: true, feedback: 'The evidence links the complaint to a known, verified cause, which defines the containment scope.' },
              { text: 'The customer damaged the tyres', correct: false, feedback: 'The lab found no impact damage and a manufacturing-type separation.' },
              { text: 'The design is unsafe and every tyre size must be redesigned', correct: false, feedback: 'The evidence points to a process condition on one press, not to the design.' },
            ],
            points: 8,
          },
          {
            title: 'Communicate',
            prompt: 'What should Customer Service tell the distributor now?',
            options: [
              { text: '"It is definitely your storage conditions."', correct: false, feedback: 'Contradicted by the evidence and damaging to trust.' },
              { text: '"Our tyres are perfect. This cannot happen."', correct: false, feedback: 'An unsupported claim. Never deny a verified problem.' },
              { text: 'A factual update: complaint confirmed and escalated; affected production window identified and contained; analysis indicates a manufacturing-related internal separation; replacements arranged; full root cause and corrective action report by an agreed date', correct: true, feedback: 'Honest, specific and committed: this rebuilds confidence.' },
              { text: 'Nothing until the investigation is completely closed', correct: false, feedback: 'Silence erodes trust. Give factual interim updates.' },
            ],
            points: 8,
          },
        ], (r) => {
          setPerf(ctx.state, 'trace', r.points / r.max);
          ctx.evidence({ id: 'l5-trace', title: 'Complaint traced to Press 4, week 37', text: 'All 3 bulged tyres cured on Press 4 (cycles 3,468–3,601) with low hold pressure; lab: ply separation consistent with insufficient cure pressure.' });
          ctx.finish(r);
        });
      },
    },
    {
      id: 'actions', title: 'Define corrective and preventive actions', station: 'complaintDesk', requires: ['trace', 'team'], prompt: 'finalise the complaint response actions',
      run(ctx) {
        put(ctx.body, meterPanel(ctx.state));
        const box = h('div'); put(ctx.body, box);
        let total = 0; let max = 0;
        classifyItems(box, {
          intro: 'Classify each action. Correction fixes the immediate nonconformity; containment stops suspect product moving on; corrective action removes the cause; preventive action reduces the risk of similar problems elsewhere.',
          categories: [{ value: 'correction', label: 'Correction' }, { value: 'containment', label: 'Containment' }, { value: 'corrective', label: 'Corrective action' }, { value: 'preventive', label: 'Preventive / risk reduction' }],
          items: [
            { id: 'a1', label: 'Replace the three affected tyres for the customer', answer: 'correction', feedback: 'Fixes the immediate problem for this customer.', hint: 'Does this remove the cause, or fix the immediate issue?' },
            { id: 'a2', label: 'Hold and inspect Press 4 output from the affected window in the warehouse and in transit', answer: 'containment', feedback: 'Stops suspect product reaching customers.', hint: 'Does it stop suspect product moving on?' },
            { id: 'a3', label: 'Customers quarantine stock from the affected serial range under the approved procedure', answer: 'containment', feedback: 'Containment extends into the field via traceability.', hint: 'Is this about suspect product already shipped?' },
            { id: 'a4', label: 'Cycle-count bladder PM with controlled deferral on all presses', answer: 'corrective', feedback: 'Removes the verified cause and its systemic enabler.', hint: 'Does it remove the verified cause?' },
            { id: 'a5', label: 'Automatic escalation of repeated pressure alarms to maintenance', answer: ['corrective', 'preventive'], feedback: 'Closes the gap that let the alarms be reset without action.', hint: 'It addresses how the alarms were handled.' },
            { id: 'a6', label: 'FMEA review of other curing wear parts (seals, valves) for similar hidden degradation', answer: 'preventive', feedback: 'Addresses similar risks before they cause a problem.', hint: 'Does this act on a problem that has not occurred yet?' },
          ],
          pointsEach: 4,
        }, (r1) => {
          total += r1.points; max += r1.max;
          clear(box);
          multiSelect(box, {
            prompt: 'How will you check that the actions were effective?',
            options: [
              { text: 'No bulge complaints traced to production after the fix, monitored for 6 months', correct: true, feedback: 'Measures the customer outcome.' },
              { text: 'Press 4 hold pressure stays in statistical control and blister rate ≤ 1%', correct: true, feedback: 'Measures the process.' },
              { text: 'Audit confirms no bladder PM was deferred without approval', correct: true, feedback: 'Checks that the new system is actually followed.' },
              { text: 'Customer confirms the response and actions met their requirements', correct: true, feedback: 'Closes the loop with the voice of the customer.' },
              { text: 'The customer stopped calling', correct: false, feedback: 'Silence is not evidence. They may simply have switched supplier.' },
              { text: 'The corrective action form was filled in', correct: false, feedback: 'Documentation is needed, but it does not prove effectiveness.' },
            ],
            pointsEach: 4,
          }, (r2) => {
            total += r2.points; max += r2.max;
            setPerf(ctx.state, 'actions', total / max);
            put(clear(box), meterPanel(ctx.state), h('div', { class: 'feedback good' }, h('strong', null, 'Response complete. '), 'The simulated indicators above reflect how well each step was handled. Confidence recovers through containment, honesty and verified action, not through speed alone.'),
              h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => ctx.finish({ points: total, max }) }, 'Close the complaint')));
          });
        });
      },
    },
  ],
};
