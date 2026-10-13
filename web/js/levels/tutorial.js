import { h, html, clear, put } from '../ui.js';
import { tyreSVG } from '../art.js';
import { dialogue, decisionSequence, attemptPoints } from '../activities.js';
import { kpiView } from '../state.js';

const TYRES = [
  { id: 'A', defect: 'none', flag: false, why: 'No visible anomaly. It still goes through the normal inspection and sampling plan.' },
  { id: 'B', defect: 'blister', flag: true, why: 'A raised blister on the sidewall can indicate trapped air or a separation under the surface.' },
  { id: 'C', defect: 'none', flag: false, why: 'No visible anomaly on this side.' },
  { id: 'D', defect: 'chunk', flag: true, why: 'Missing tread blocks (a chunked tread) are a clear nonconformity.' },
  { id: 'E', defect: 'crack', flag: true, why: 'Cracks in the sidewall surface need assessment against the standard.' },
  { id: 'F', defect: 'none', flag: false, why: 'No visible anomaly.' },
  { id: 'G', defect: 'bulge', flag: true, why: 'A sidewall bulge can mean internal structural separation. It must not be released without further evaluation.' },
  { id: 'H', defect: 'foreign', flag: true, why: 'A bright embedded particle suggests foreign material contamination.' },
];

export const level = {
  id: 'tutorial',
  num: 0,
  title: 'Welcome to the Factory',
  area: 'control',
  briefing: {
    speaker: 'manager',
    text: 'Welcome to Qualitrax Tyres. Our customer complaints have increased, rejection is rising, and our teams are treating symptoms instead of solving problems. Your mission is to help us build a culture of quality.',
    objectives: ['Walk to the Plant Manager and talk to her (move with WASD / arrow keys, or tap the floor).', 'Read the production performance board.', 'Spot the tyres that need further inspection at Final Inspection.'],
    learn: ['How to move, interact and use quick travel', 'Reading quality KPIs', 'Why quality matters at every process stage'],
  },
  debrief: {
    principle: 'Quality is built at every process stage',
    text: 'A tyre passes through mixing, component preparation, building, curing and inspection. A problem created at any stage travels downstream, gets more expensive to fix, and may escape to a customer. In TQM, every process owner is responsible for the quality of their own output and treats the next process as their customer.',
  },
  badge: null,
  reward: { id: 'log', name: 'Mission log & evidence folder', desc: 'Collected evidence appears here as you investigate.' },
  kpiEffect: null,
  tasks: [
    {
      id: 'welcome', title: 'Meet the Plant Manager', station: 'npcManager', prompt: 'talk to Elena Marsh',
      run(ctx) {
        dialogue(ctx.body, [
          { who: 'manager', text: `Good to meet you, ${ctx.state.player.name}. I'm Elena Marsh, the plant manager.` },
          { who: 'manager', text: 'Our customer complaints have increased, rejection is rising, and our teams are treating symptoms instead of solving problems. Your mission is to help us build a culture of quality.' },
          { who: 'manager', text: 'Some tips: walk up to people and machines and press E (or tap the ● button) to interact. Yellow "!" markers show where your current objectives are. Open the Mission Log (L) to see objectives and quick-travel there.' },
          { who: 'manager', text: 'You earn Quality Improvement Points (QIP) for sound, evidence-based decisions. Practice activities can be retried, and your best score counts. The final assessment at the end is scored separately.' },
        ], () => {
          decisionSequence(ctx.body, [{
            title: 'Quick check',
            prompt: 'Elena says teams are "treating symptoms instead of solving problems". Which action treats only a symptom?',
            options: [
              { text: 'Adding more inspectors to sort out defective tyres', correct: true, feedback: 'Exactly. Sorting catches defects after they are made; the process that creates them is unchanged. Inspection is still needed, but it is not a cure.' },
              { text: 'Finding out where in the process the defects are created', correct: false, feedback: 'That is solving the problem at its source, not treating a symptom.' },
              { text: 'Checking whether the defect rate changed after a process change', correct: false, feedback: 'That is good data-driven verification, not symptom treatment.' },
            ],
            points: 10,
          }], (r) => ctx.finish({ points: r.points, max: r.max }), { finishLabel: 'Accept the mission' });
        }, { doneLabel: 'Got it' });
      },
    },
    {
      id: 'board', title: 'Read the production performance board', station: 'kpiBoard', requires: ['welcome'], prompt: 'read the production board',
      run(ctx) {
        const k = ctx.state.kpi;
        const v = kpiView(k);
        const board = h('div', { class: 'kpi-board' },
          h('div', { class: 'kpi-cell' }, h('span', null, 'Inspected / week'), h('b', null, k.inspected.toLocaleString())),
          h('div', { class: 'kpi-cell' }, h('span', null, 'Rejected / week'), h('b', { class: 'bad' }, k.rejected.toLocaleString())),
          h('div', { class: 'kpi-cell' }, h('span', null, 'Reworked / week'), h('b', { class: 'warn' }, k.reworked.toLocaleString())),
          h('div', { class: 'kpi-cell' }, h('span', null, 'Complaints / month'), h('b', { class: 'bad' }, String(k.complaints))),
          h('div', { class: 'kpi-cell' }, h('span', null, 'Rejection rate'), h('b', null, '? %')),
          h('div', { class: 'kpi-cell' }, h('span', null, 'First-pass yield'), h('b', null, `${v.fpy.toFixed(1)} %`)));
        put(ctx.body, 
          h('p', null, 'The board summarises this week\'s fictional figures. Quality decisions start with reading data correctly.'),
          board,
          h('div', { class: 'formula' }, h('b', null, 'Rejection rate'), ' = rejected units ÷ inspected units × 100', h('br'), h('b', null, 'First-pass yield (FPY)'), ' = units passing first time (no rework, no rejection) ÷ units entering × 100'));
        const q = h('div');
        put(ctx.body, q);
        decisionSequence(q, [
          {
            prompt: `The rejection rate cell is blank. What is this week's rejection rate (${k.rejected.toLocaleString()} rejected out of ${k.inspected.toLocaleString()} inspected)?`,
            options: [
              { text: `${(v.rejectionRate).toFixed(1)}%`, correct: true, feedback: `${k.rejected} ÷ ${k.inspected} × 100 = ${v.rejectionRate.toFixed(2)}%.` },
              { text: `${(v.reworkRate).toFixed(1)}%`, correct: false, feedback: 'That is the rework rate. Use rejected units in the numerator.' },
              { text: `${(100 - v.fpy).toFixed(1)}%`, correct: false, feedback: 'That combines rejects and rework (the first-pass loss). The rejection rate uses rejected units only.' },
              { text: `${(v.rejectionRate * 10).toFixed(0)}%`, correct: false, feedback: 'Check the decimal place: divide rejected by inspected, then multiply by 100.' },
            ],
            points: 10,
          },
          {
            prompt: 'Why is first-pass yield lower than the share of tyres that are finally shipped?',
            options: [
              { text: 'FPY excludes tyres that only passed after rework, so it reveals hidden rework effort', correct: true, feedback: 'Right. Reworked tyres may ship, but rework costs time and money. FPY exposes this "hidden factory".' },
              { text: 'FPY includes customer complaints', correct: false, feedback: 'Complaints are tracked separately; FPY is about units passing a process first time.' },
              { text: 'FPY is calculated only for scrapped tyres', correct: false, feedback: 'FPY counts units that pass first time, not scrapped ones.' },
            ],
            points: 10,
          },
        ], (r) => {
          ctx.evidence({ id: 'kpi-baseline', title: 'Baseline KPIs', text: `Rejection rate ${v.rejectionRate.toFixed(2)}%, FPY ${v.fpy.toFixed(1)}%, rework ${v.reworkRate.toFixed(1)}%, ${k.complaints} complaints/month (fictional).` });
          ctx.finish({ points: r.points, max: r.max });
        });
      },
    },
    {
      id: 'spot', title: 'Spot tyres needing further inspection', station: 'inspectTable', requires: ['welcome'], prompt: 'inspect tyres at the final inspection station',
      run(ctx) {
        const flagged = new Set();
        let attempts = 0;
        const grid = h('div', { class: 'tyre-grid' }, TYRES.map((t) => {
          const card = h('button', { class: 'tyre-card', 'aria-pressed': 'false', onclick: () => {
            if (card.disabled) return;
            if (flagged.has(t.id)) flagged.delete(t.id); else flagged.add(t.id);
            card.setAttribute('aria-pressed', String(flagged.has(t.id)));
          } }, html(tyreSVG(t.defect, { size: 120, label: `Tyre ${t.id}` })), h('span', { class: 'tyre-id' }, `Tyre ${t.id}`), h('span', { class: 'tyre-note' }));
          t.card = card;
          return card;
        }));
        const fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
        const check = h('button', { class: 'btn primary', onclick: () => {
          attempts += 1;
          let wrong = 0;
          TYRES.forEach((t) => {
            const ok = flagged.has(t.id) === t.flag;
            t.card.classList.toggle('ok', ok); t.card.classList.toggle('no', !ok);
            if (!ok) wrong += 1;
            if (attempts >= 2 || ok) t.card.querySelector('.tyre-note').textContent = t.why;
          });
          if (!wrong) {
            fb.className = 'feedback good';
            put(clear(fb), h('strong', null, 'Well spotted. '), 'Notice that tyres with no visible anomaly are not automatically "good": some defects (internal separations, under-cure) cannot be seen from the outside. That is why inspection uses several methods, and why preventing defects at each process stage matters more than sorting at the end.');
            TYRES.forEach((t) => { t.card.disabled = true; });
            check.replaceWith(h('button', { class: 'btn primary', onclick: () => {
              ctx.evidence({ id: 'defect-gallery', title: 'Visible defect types', text: 'Blister, chunked tread, sidewall cracking, bulge, foreign material. Bulges and blisters may indicate internal problems.' });
              ctx.finish({ points: attemptPoints(20, attempts), max: 20 });
            } }, 'Collect evidence & continue'));
          } else {
            fb.className = 'feedback bad';
            fb.textContent = `${wrong} tyre(s) are classified incorrectly (red outline). Look closely at the sidewall and tread, then check again.`;
          }
        } }, 'Check my selection');
        put(ctx.body, 
          h('p', null, 'Click every tyre that shows a visible defect and therefore needs further inspection. Look at the tread blocks, sidewall surface and shape.'),
          grid, fb, h('div', { class: 'actions' }, check));
      },
    },
  ],
};
