import { h, html, clear, put } from '../ui.js';
import { decisionSequence, classifyItems, speakerLine } from '../activities.js';
import { compareSVG } from '../charts.js';
import { round } from '../stats.js';

const WASTE_CATS = [
  { value: 'motion', label: 'Muda: motion' }, { value: 'waiting', label: 'Muda: waiting' }, { value: 'transport', label: 'Muda: transport' },
  { value: 'inventory', label: 'Muda: inventory' }, { value: 'defects', label: 'Muda: defects / rework' }, { value: 'overproc', label: 'Muda: over-processing' },
  { value: 'mura', label: 'Mura (unevenness)' }, { value: 'muri', label: 'Muri (overburden)' }, { value: 'value', label: 'Value-adding' },
];

const HOTSPOTS = [
  { id: 'h1', x: 60, y: 40, label: '1. Builder walks 25 m to the bead store for every tyre', answer: 'motion', feedback: 'Walking that adds no value: motion waste. Point-of-use storage removes it.' },
  { id: 'h2', x: 330, y: 160, label: '2. Builder waits about 20 s for the green-tyre carrier to come back', answer: 'waiting', feedback: 'Idle time waiting for equipment: waiting waste.' },
  { id: 'h3', x: 150, y: 60, label: '3. Bead apexes are moved from rack A to rack B, then back to the builder', answer: 'transport', feedback: 'Moving material more than necessary: transport waste.' },
  { id: 'h4', x: 250, y: 50, label: '4. Three days of tread stock queue beside the servicer (compound can age)', answer: 'inventory', feedback: 'Excess work-in-progress hides problems and risks ageing material: inventory waste.' },
  { id: 'h5', x: 200, y: 140, label: '5. About 1 tyre in 12 needs its tread splice reopened and rejoined', answer: 'defects', feedback: 'Rework is defect waste, and it adds variation to the cycle.' },
  { id: 'h6', x: 120, y: 150, label: '6. Components are wiped with solvent twice; the standard requires once', answer: 'overproc', feedback: 'Doing more than the customer or standard requires: over-processing.' },
  { id: 'h7', x: 380, y: 40, label: '7. 40% of the weekly volume is built on Fridays', answer: 'mura', feedback: 'Uneven workload (Mura) creates overtime peaks and rushed work.' },
  { id: 'h8', x: 290, y: 110, label: '8. Builders lift 25 kg tread rolls from floor level by hand', answer: 'muri', feedback: 'Overburden on people (Muri): injury risk, fatigue and errors.' },
  { id: 'h9', x: 200, y: 95, label: '9. Builder applies the ply to the drum per specification', answer: 'value', feedback: 'This transforms the product in a way the customer pays for: value-adding.' },
  { id: 'h10', x: 40, y: 150, label: '10. Builders search a shared drawer for the splice roller', answer: 'motion', feedback: 'Searching is motion waste. A shadow board (5S) fixes it.' },
];

function cellScene() {
  const marks = HOTSPOTS.map((p) => `<g><circle cx="${p.x}" cy="${p.y}" r="11" class="hot"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle" class="hot-t">${p.id.slice(1)}</text></g>`).join('');
  return `<svg class="cell-scene" viewBox="0 0 420 200" role="img" aria-label="Building cell 2 layout with numbered observation points">
  <rect x="0" y="0" width="420" height="200" rx="8" class="floor"/>
  <rect x="160" y="70" width="90" height="60" rx="6" class="mach"/><circle cx="205" cy="100" r="22" class="drum"/>
  <rect x="20" y="15" width="60" height="40" rx="4" class="rack"/><text x="50" y="12" class="lbl" text-anchor="middle">bead store</text>
  <rect x="120" y="30" width="50" height="40" rx="4" class="rack"/><rect x="230" y="20" width="60" height="40" rx="4" class="rack"/>
  <rect x="320" y="130" width="70" height="50" rx="4" class="cart"/><text x="355" y="196" class="lbl" text-anchor="middle">carrier stand</text>
  <rect x="270" y="100" width="40" height="30" rx="3" class="roll"/><rect x="20" y="130" width="50" height="40" rx="3" class="rack"/>
  <rect x="350" y="20" width="60" height="40" rx="3" class="board"/><text x="380" y="70" class="lbl" text-anchor="middle">schedule</text>
  ${marks}</svg>`;
}

// ---------- layout simulator ----------
export const SLOTS = [
  { id: 'P1', label: 'Beside builder (left)', dist: 3 },
  { id: 'P2', label: 'Beside builder (right)', dist: 4 },
  { id: 'P3', label: 'Across the aisle', dist: 10 },
  { id: 'P4', label: 'Storage wall', dist: 25 },
  { id: 'P5', label: 'End of line', dist: 30 },
];
export const ITEMS = [
  { id: 'bead', label: 'Bead rack', trips: 1.0, start: 'P4' },
  { id: 'carrier', label: 'Green-tyre carrier stand', trips: 1.0, start: 'P5' },
  { id: 'tools', label: 'Splice tools', trips: 0.3, start: 'P3' },
];
export const CARDS = [
  { id: 'shadow', label: '5S shadow board for tools at the builder', good: true },
  { id: 'std', label: 'Visual standard work with splice checkpoints', good: true },
  { id: 'lift', label: 'Lift assist for tread rolls', good: true },
  { id: 'kanban', label: 'Second carrier + kanban WIP limit of 8 green tyres', good: true },
  { id: 'nosplice', label: 'Remove the in-cell splice check (final inspection will catch it)', good: false, why: 'Shifts splice defects downstream to final inspection and customers.' },
  { id: 'speed', label: 'Run the drum 15% faster', good: false, why: 'Overburdens people and machine (Muri) and raises splice defects.' },
];

/** Deterministic cell model. layout: {bead, carrier, tools: slotId}; cards: Set of card ids. */
export function cellMetrics(layout, cards) {
  const d = (item) => SLOTS.find((s) => s.id === layout[item]).dist;
  const has = (c) => cards.has(c);
  const walk = 2 * (d('bead') * 1 + d('carrier') * 1 + d('tools') * 0.3);
  const search = has('shadow') ? 2 : 12;
  const wait = has('kanban') ? 4 : 20;
  let reworkRate = 1 / 12;
  if (has('std')) reworkRate *= 0.5;
  if (has('speed')) reworkRate *= 1.4;
  const inCellRework = has('nosplice') ? 0 : reworkRate;
  const lift = has('lift') ? 2 : 7.5;
  let valueAdd = 96;
  if (has('speed')) valueAdd *= 0.87;
  const cycle = valueAdd + walk / 1.2 + search + wait + inCellRework * 90 + lift + (has('nosplice') ? -8 : 0);
  const downstream = Math.round(12 * (has('std') ? 0.6 : 1) * (has('speed') ? 1.4 : 1) * (has('nosplice') ? 2 : 1));
  let variation = 100;
  if (has('std')) variation -= 35;
  if (has('shadow')) variation -= 10;
  if (has('lift')) variation -= 10;
  if (has('kanban')) variation -= 15;
  if (has('speed')) variation += 20;
  return {
    cycle: round(cycle, 1),
    walk: round(walk, 0),
    wip: has('kanban') ? 8 : 22,
    rework: round(inCellRework * 100, 1),
    downstream,
    variation,
    muri: has('lift') ? 'Low' : has('speed') ? 'Very high' : 'High',
  };
}

function layoutSim(ctx) {
  const layout = Object.fromEntries(ITEMS.map((i) => [i.id, i.start]));
  const cards = new Set();
  const base = cellMetrics(layout, new Set());
  const grid = h('div', { class: 'layout-grid' });
  const cardBox = h('div', { class: 'options' });
  const result = h('div');
  const fb = h('div', { class: 'feedback' });
  const renderGrid = () => {
    put(clear(grid), h('div', { class: 'layout-row head' }, h('span', null, 'Item'), SLOTS.map((s) => h('span', null, `${s.label} (${s.dist} m)`))),
      ITEMS.map((it) => h('div', { class: 'layout-row' }, h('b', null, it.label), SLOTS.map((s) => {
        const takenBy = Object.entries(layout).find(([k, v]) => v === s.id && k !== it.id);
        return h('button', { class: `slot ${layout[it.id] === s.id ? 'on' : ''}`, disabled: !!takenBy, title: takenBy ? `Occupied by ${ITEMS.find((x) => x.id === takenBy[0]).label}` : '', 'aria-pressed': String(layout[it.id] === s.id), onclick: () => { layout[it.id] = s.id; renderGrid(); } }, layout[it.id] === s.id ? '●' : takenBy ? '×' : '');
      }))));
  };
  const renderCards = () => {
    put(clear(cardBox), CARDS.map((c) => h('button', { class: 'option check', 'aria-pressed': String(cards.has(c.id)), onclick: () => {
      if (cards.has(c.id)) cards.delete(c.id);
      else if (cards.size >= 3) { fb.className = 'feedback bad'; fb.textContent = 'Budget allows three improvement cards. Remove one first.'; return; }
      else cards.add(c.id);
      fb.textContent = ''; renderCards();
    } }, h('span', { class: 'tick' }), h('span', null, c.label))));
  };
  const simulate = () => {
    const m = cellMetrics(layout, cards);
    const shifting = CARDS.filter((c) => !c.good && cards.has(c.id));
    put(clear(result), 
      h('div', { class: 'chart-box' }, html(compareSVG([
        { label: 'Cycle time (s)', before: base.cycle, after: m.cycle, lowerIsBetter: true },
        { label: 'Walking per tyre (m)', before: base.walk, after: m.walk, lowerIsBetter: true },
        { label: 'Work-in-progress (tyres)', before: base.wip, after: m.wip, lowerIsBetter: true },
        { label: 'In-cell rework (%)', before: base.rework, after: m.rework, lowerIsBetter: true },
        { label: 'Splice defects at final insp./wk', before: base.downstream, after: m.downstream, lowerIsBetter: true },
        { label: 'Cycle variation index', before: base.variation, after: m.variation, lowerIsBetter: true },
      ], { title: 'Building cell 2: current vs proposed (simulated)', beforeLabel: 'Current', afterLabel: 'Proposed' }))),
      h('p', { class: 'muted small' }, `Overburden (Muri): ${base.muri} → ${m.muri}. The model is a simplified, fictional simulation.`),
      shifting.length ? h('div', { class: 'feedback bad' }, h('strong', null, 'System check: '), shifting.map((c) => c.why).join(' '), ' Improvements are judged on the whole value stream, not one cell.') : null,
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => submit(m, shifting) }, 'Submit this proposal')));
  };
  const submit = (m, shifting) => {
    const bestWalk = cellMetrics({ bead: 'P1', carrier: 'P2', tools: 'P3' }, new Set()).walk;
    const walkGain = Math.max(0, Math.min(1, (base.walk - m.walk) / (base.walk - bestWalk)));
    const goodCards = CARDS.filter((c) => c.good && cards.has(c.id)).length;
    const pts = Math.max(0, Math.round(15 * walkGain + 5 * goodCards - 10 * shifting.length));
    ctx.state.flag('l6_metrics', { base, after: m });
    ctx.evidence({ id: 'l6-layout', title: 'Cell 2 kaizen proposal', text: `Cycle ${base.cycle}s → ${m.cycle}s, walking ${base.walk} m → ${m.walk} m, WIP ${base.wip} → ${m.wip}, downstream splice defects ${base.downstream} → ${m.downstream}/wk.` });
    ctx.finish({ points: pts, max: 30, summary: shifting.length ? 'shifted' : 'clean' });
  };
  renderGrid(); renderCards();
  put(ctx.body, 
    speakerLine('builder', 'This is our cell. Move things where they make sense and pick the improvements you think will help. We will see what the numbers say.'),
    h('h4', null, '1. Rearrange the cell (one item per location)'), grid,
    h('h4', null, '2. Choose up to three improvement cards'), cardBox, fb,
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: simulate }, 'Run simulation')), result);
}

function huddle(ctx) {
  put(ctx.body, speakerLine('builder', 'Team huddle time. Everyone brought one idea. Let\'s decide together what to do with each.'));
  const box = h('div'); put(ctx.body, box);
  classifyItems(box, {
    intro: 'Evaluate each suggestion for feasibility and risk. What should happen to it?',
    categories: [{ value: 'now', label: 'Do now (quick, low risk)' }, { value: 'pdca', label: 'Trial with PDCA' }, { value: 'analyse', label: 'Analyse further first' }, { value: 'decline', label: 'Decline, explaining why' }],
    items: [
      { id: 's1', label: 'Aisha: "Paint a colour band on the drum so we can see splice overlap at a glance."', answer: ['pdca', 'now'], feedback: 'Low cost and promising. Trial it and measure the splice rework rate.', hint: 'It affects quality: how will you know it works?' },
      { id: 's2', label: 'Builder on B-shift: "When we\'re behind, skip the splice check to catch up."', answer: 'decline', feedback: 'Decline, and explain: it shifts defects downstream. Then ask why the team falls behind (Mura?).', hint: 'Does this remove waste, or move a quality problem elsewhere?' },
      { id: 's3', label: 'Tomás: "Label bead rack positions by size so nobody grabs the wrong bead."', answer: 'now', feedback: 'Simple error-proofing with almost no risk: do it now.', hint: 'Cost and risk are both tiny.' },
      { id: 's4', label: 'Kwame: "Install a lift assist for tread rolls."', answer: ['analyse', 'pdca'], feedback: 'Good idea; it needs a safety and cost assessment, then a trial.', hint: 'It involves equipment and safety: what must happen first?' },
      { id: 's5', label: 'Rajesh: "Buy a fully automatic building machine."', answer: 'analyse', feedback: 'A major investment needs a business case. It is not a kaizen quick win.', hint: 'Large investment, long lead time.' },
      { id: 's6', label: 'Mei: "Share final-inspection splice data with the builders every shift."', answer: 'now', feedback: 'Fast feedback connects builders to their customer (final inspection).', hint: 'Low cost, immediate benefit.' },
    ],
    pointsEach: 4,
  }, (r1) => {
    clear(box);
    decisionSequence(box, [
      {
        title: 'Prioritise',
        prompt: 'Which improvement should the team agree to start first as its main project?',
        options: [
          { text: 'The splice colour-band trial: biggest quality impact for little cost, measurable with existing data', correct: true, feedback: 'High impact, low cost, measurable: ideal for a PDCA trial.' },
          { text: 'The fully automatic machine', correct: false, feedback: 'Too large and slow for a team kaizen; it needs a separate business case.' },
          { text: 'Skipping the splice check when behind', correct: false, feedback: 'Already declined: it shifts the problem.' },
        ],
        points: 6,
      },
      {
        title: 'Agree the action',
        prompt: 'How should the action be agreed?',
        options: [
          { text: 'Everyone tries it whenever they like', correct: false, feedback: 'Without an owner, scope and measure, you cannot learn from the result.' },
          { text: 'Aisha owns a 2-week trial on builder 2; measure splice rework against builder 1; review at the huddle on the 14th', correct: true, feedback: 'Owner, scope, measure, comparison and review date: a proper PDCA trial.' },
          { text: 'The manager decides alone and announces it', correct: false, feedback: 'Ownership by the people doing the work is what makes kaizen stick.' },
        ],
        points: 6,
      },
      {
        title: 'Review the outcome',
        scenario: 'Two weeks later: builder 2 splice rework fell from 8.1% to 3.2% (≈ 900 tyres); builder 1 stayed at 8.4%. Cycle time unchanged. Builders say the band is easy to use.',
        prompt: 'What next?',
        options: [
          { text: 'Standardise it in the work instruction, train both shifts, roll it out to builder 1 and other cells, and recognise Aisha\'s idea', correct: true, feedback: 'Standardise, spread (yokoten) and recognise. That is how continuous improvement compounds.' },
          { text: 'Keep it as Aisha\'s personal trick', correct: false, feedback: 'Unshared improvements disappear when people change jobs.' },
          { text: 'Stop measuring: two weeks proves it forever', correct: false, feedback: 'Keep monitoring to confirm the gain holds.' },
        ],
        points: 6,
      },
    ], (r2) => {
      ctx.evidence({ id: 'l6-huddle', title: 'Huddle: splice colour band standardised', text: 'Builder 2 splice rework 8.1% → 3.2% in a 2-week trial; standardised and rolled out; idea owner recognised.' });
      ctx.finish({ points: r1.points + r2.points, max: r1.max + r2.max });
    });
  });
}

export const level = {
  id: 'l6',
  num: 6,
  title: 'The Kaizen Factory Transformation',
  area: 'building',
  briefing: {
    speaker: 'builder',
    text: 'I\'m Aisha, a tyre builder in cell 2. We have plenty of ideas about what slows us down, but nobody usually asks. Walk the cell with us, see the waste for yourself, and let\'s improve it together, without just pushing problems onto the next department.',
    objectives: ['Do a waste walk in building cell 2 (Muda, Mura, Muri).', 'Redesign the cell layout at the tyre building machine and test it in the simulator.', 'Run a team huddle with Aisha to agree and review improvements.'],
    learn: ['Kaizen and employee involvement', 'Muda (waste), Mura (unevenness), Muri (overburden)', 'Before/after measurement', 'Avoiding problem-shifting', 'Standardisation and spreading improvements'],
  },
  debrief: {
    principle: 'Kaizen: everyone, every day, everywhere, measured and sustained',
    text: 'Lean tools (waste walks, 5S, point-of-use storage, kanban) help remove Muda, Mura and Muri. TQM is the broader management system: customer focus, process thinking, fact-based decisions, everyone\'s involvement and continuous improvement. Lean contributes methods for flow and waste; TQM ensures improvements serve the customer and do not shift problems elsewhere.',
  },
  badge: 'Kaizen Innovator',
  reward: { id: 'kaizen', name: 'Kaizen card', desc: 'Idea → evaluate → trial → measure → standardise → share.' },
  kpiEffect: (k, perf) => { k.reworked -= 160 * perf; k.rejected -= 30 * perf; k.project = 'Cell 2 kaizen standardised'; },
  tasks: [
    {
      id: 'walk', title: 'Waste walk in building cell 2', station: 'kaizencell', prompt: 'walk building cell 2 and look for waste',
      run(ctx) {
        put(ctx.body, h('div', { class: 'chart-box' }, html(cellScene())));
        const box = h('div'); put(ctx.body, box);
        classifyItems(box, {
          intro: 'You observe cell 2 for an hour. Classify each numbered observation. Muda = non-value-adding activity; Mura = unevenness; Muri = overburden. Not everything is waste.',
          items: HOTSPOTS.map((p) => ({ id: p.id, label: p.label, answer: p.answer, feedback: p.feedback, hint: 'Ask: does the customer pay for this? Is it uneven? Is it overburdening someone?' })),
          categories: WASTE_CATS,
          pointsEach: 3,
        }, (r) => {
          ctx.evidence({ id: 'l6-walk', title: 'Waste walk: cell 2', text: 'Motion (walking, searching), waiting, transport, inventory, rework, over-processing, Mura (Friday peaks), Muri (manual lifting).' });
          ctx.finish(r);
        });
      },
    },
    { id: 'layout', title: 'Redesign the cell layout', station: 'builder', requires: ['walk'], prompt: 'redesign the cell at the tyre building machine', run: layoutSim },
    { id: 'huddle', title: 'Run the team huddle', station: 'npcBuilder', requires: ['walk'], prompt: 'run a team huddle with Aisha', run: huddle },
  ],
};
