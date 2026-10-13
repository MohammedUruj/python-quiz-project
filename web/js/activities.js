// Reusable interactive activity widgets. Each one renders into a container and reports
// points through a callback. Wrong answers explain why and allow a retry (with fewer points).

import { h, html, clear, put, shuffle } from './ui.js';
import { portraitSVG, NPCS } from './art.js';

/** Points for an item answered correctly on attempt n (1-based). */
export function attemptPoints(full, attempt) {
  if (attempt <= 1) return full;
  if (attempt === 2) return Math.round(full / 2);
  return 0;
}

export function speakerLine(npcKey, text) {
  const p = NPCS[npcKey];
  return h('div', { class: 'speech' },
    html(portraitSVG(p, 56)),
    h('div', { class: 'speech-bubble' }, h('strong', null, `${p.name}`), h('span', { class: 'role' }, ` · ${p.role}`), h('p', null, text)));
}

/**
 * A sequence of decision steps. step = {title?, scenario?, prompt, options:[{text, correct, feedback}], points, extra?: () => Node}
 * Multiple options may be correct (any correct option is accepted).
 */
export function decisionSequence(container, steps, onDone, { finishLabel = 'Continue' } = {}) {
  let i = 0; let points = 0; const max = steps.reduce((a, s) => a + (s.points ?? 10), 0);
  const record = [];
  const render = () => {
    clear(container);
    const s = steps[i];
    let attempt = 0; let solved = false;
    const fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const next = h('button', { class: 'btn primary', disabled: true, onclick: () => {
      i += 1;
      if (i < steps.length) render(); else onDone({ points, max, record });
    } }, i === steps.length - 1 ? finishLabel : 'Next step →');
    const shown = s.keepOrder ? s.options : shuffle(s.options);
    const opts = shown.map((o, idx) => h('button', {
      class: 'option',
      onclick: (e) => {
        if (solved) return;
        attempt += 1;
        const btn = e.currentTarget;
        fb.className = `feedback ${o.correct ? 'good' : 'bad'}`;
        put(clear(fb), h('strong', null, o.correct ? '✔ Sound decision. ' : '✖ Not the best choice. '), o.feedback || '');
        if (o.correct) {
          solved = true;
          const pts = attemptPoints(s.points ?? 10, attempt);
          points += pts;
          record.push({ step: s.prompt, choice: o.text, attempts: attempt, points: pts });
          btn.classList.add('correct');
          opts.forEach((b) => { b.disabled = true; });
          next.disabled = false;
          if (s.onCorrect) s.onCorrect(o, idx);
          next.focus();
        } else {
          btn.classList.add('wrong');
          btn.disabled = true;
        }
      },
    }, h('span', { class: 'opt-key' }, String.fromCharCode(65 + idx)), h('span', null, o.text)));
    put(container, 
      h('div', { class: 'step-count' }, `Step ${i + 1} of ${steps.length}${s.title ? ` · ${s.title}` : ''}`),
      s.speaker ? speakerLine(s.speaker, s.scenario) : (s.scenario ? h('div', { class: 'scenario' }, s.scenario) : null),
      s.extra ? s.extra() : null,
      h('p', { class: 'prompt' }, s.prompt),
      h('div', { class: 'options' }, opts),
      fb,
      h('div', { class: 'actions' }, next),
    );
  };
  render();
}

/**
 * Classify each item into a category. items: [{id, label, detail?, art?, answer: value | [values], feedback}]
 * categories: [{value, label}]. All items must be correct to finish; wrong items can be changed.
 */
export function classifyItems(container, { intro, items, categories, pointsEach = 5, columns = false, checkLabel = 'Check my classification' }, onDone) {
  const choice = {}; const attempts = {}; const locked = {};
  let points = 0;
  const max = items.length * pointsEach;
  const rows = items.map((it) => {
    const fb = h('div', { class: 'item-fb' });
    const btns = categories.map((c) => h('button', {
      class: 'chip', 'aria-pressed': 'false',
      onclick: () => {
        if (locked[it.id]) return;
        choice[it.id] = c.value;
        btns.forEach((b) => b.setAttribute('aria-pressed', String(b === btnFor(c.value))));
      },
    }, c.label));
    const btnFor = (v) => btns[categories.findIndex((c) => c.value === v)];
    const row = h('div', { class: `classify-row ${columns ? 'card' : ''}` },
      h('div', { class: 'classify-item' }, it.art ? html(it.art) : null, h('div', null, h('strong', null, it.label), it.detail ? h('p', { class: 'muted' }, it.detail) : null)),
      h('div', { class: 'chips' }, btns), fb);
    return { it, row, fb, btns };
  });
  const status = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const check = h('button', { class: 'btn primary', onclick: () => {
    const missing = rows.filter((r) => !locked[r.it.id] && choice[r.it.id] == null);
    if (missing.length) { status.className = 'feedback bad'; status.textContent = `Classify every item first (${missing.length} left).`; return; }
    let wrong = 0;
    rows.forEach((r) => {
      if (locked[r.it.id]) return;
      attempts[r.it.id] = (attempts[r.it.id] || 0) + 1;
      const answers = [].concat(r.it.answer);
      const ok = answers.includes(choice[r.it.id]);
      r.row.classList.toggle('ok', ok); r.row.classList.toggle('no', !ok);
      put(clear(r.fb), ok ? '✔ ' : '✖ ', ok ? (r.it.feedback || 'Correct.') : (r.it.hint || 'Look again at the evidence for this item.'));
      if (ok) {
        locked[r.it.id] = true;
        points += attemptPoints(pointsEach, attempts[r.it.id]);
        r.btns.forEach((b) => { b.disabled = true; });
      } else wrong += 1;
    });
    if (wrong) { status.className = 'feedback bad'; status.textContent = `${wrong} item(s) need another look. Read the hint, change your choice and check again.`; }
    else {
      status.className = 'feedback good'; status.textContent = 'All items classified correctly.';
      check.remove();
      put(container, h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => onDone({ points, max }) }, 'Continue')));
    }
  } }, checkLabel);
  put(clear(container), intro ? h('div', { class: 'scenario' }, intro) : null, h('div', { class: columns ? 'classify-grid' : 'classify-list' }, rows.map((r) => r.row)), status, h('div', { class: 'actions' }, check));
}

/**
 * Select all that apply. options: [{text, correct, feedback}]. Score = correct picks - wrong picks (min 0).
 */
export function multiSelect(container, { scenario, prompt, options: given, pointsEach = 3, minCorrect = null, keepOrder = false }, onDone) {
  const options = keepOrder ? given : shuffle(given);
  const picked = new Set();
  const nCorrect = options.filter((o) => o.correct).length;
  const need = minCorrect ?? nCorrect;
  const fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
  let attempts = 0;
  const btns = options.map((o, i) => h('button', {
    class: 'option check', 'aria-pressed': 'false',
    onclick: (e) => {
      if (picked.has(i)) picked.delete(i); else picked.add(i);
      e.currentTarget.setAttribute('aria-pressed', String(picked.has(i)));
    },
  }, h('span', { class: 'tick' }), h('span', null, o.text)));
  const check = h('button', { class: 'btn primary', onclick: () => {
    attempts += 1;
    const goodPicks = [...picked].filter((i) => options[i].correct).length;
    const badPicks = [...picked].filter((i) => !options[i].correct).length;
    btns.forEach((b, i) => {
      b.classList.remove('correct', 'wrong', 'missed');
      const note = b.querySelector('.why');
      if (note) note.remove();
      if (picked.has(i)) b.classList.add(options[i].correct ? 'correct' : 'wrong');
      if (picked.has(i) && !options[i].correct) put(b, h('span', { class: 'why' }, options[i].feedback || ''));
    });
    if (goodPicks >= need && badPicks === 0) {
      const pts = Math.max(0, Math.round((nCorrect * pointsEach) * (attempts === 1 ? 1 : attempts === 2 ? 0.6 : 0.3)));
      btns.forEach((b, i) => {
        b.disabled = true;
        if (options[i].correct && !picked.has(i)) b.classList.add('missed');
        if (options[i].correct) put(b, h('span', { class: 'why good' }, options[i].feedback || ''));
      });
      fb.className = 'feedback good'; fb.textContent = 'Well reasoned.';
      check.replaceWith(h('button', { class: 'btn primary', onclick: () => onDone({ points: pts, max: nCorrect * pointsEach }) }, 'Continue'));
    } else {
      fb.className = 'feedback bad';
      fb.textContent = badPicks
        ? `${badPicks} selection(s) are not supported. Read the notes, adjust and check again.`
        : `You have ${goodPicks} of the ${need} key items. Something important is still missing.`;
    }
  } }, 'Check');
  put(clear(container), scenario ? h('div', { class: 'scenario' }, scenario) : null, h('p', { class: 'prompt' }, prompt), h('p', { class: 'muted small' }, 'Select all that apply.'), h('div', { class: 'options' }, btns), fb, h('div', { class: 'actions' }, check));
}

/** Simple dialogue: lines [{who: npcKey, text}] then onDone(). */
export function dialogue(container, lines, onDone, { doneLabel = 'Continue' } = {}) {
  let i = 0;
  const log = h('div', { class: 'dialogue' });
  const btn = h('button', { class: 'btn primary', onclick: () => step() }, 'Next');
  const step = () => {
    if (i >= lines.length) { onDone(); return; }
    const l = lines[i++];
    put(log, speakerLine(l.who, l.text));
    log.lastChild.scrollIntoView({ block: 'nearest' });
    if (i >= lines.length) btn.textContent = doneLabel;
  };
  put(clear(container), log, h('div', { class: 'actions' }, btn));
  step();
}

/** Ordering widget: click items in the requested order. Returns attempts via onDone. */
export function orderItems(container, { prompt, items, correctOrder, feedback }, onDone) {
  const chosen = [];
  const list = h('ol', { class: 'order-list' });
  const fb = h('div', { class: 'feedback' });
  let attempts = 0;
  const pool = items.map((it) => h('button', { class: 'chip big', onclick: (e) => {
    chosen.push(it.id); e.currentTarget.disabled = true; put(list, h('li', null, it.label));
    if (chosen.length === items.length) evaluate();
  } }, it.label));
  const reset = () => { chosen.length = 0; clear(list); pool.forEach((b) => { b.disabled = false; }); };
  const evaluate = () => {
    attempts += 1;
    const ok = typeof correctOrder === 'function' ? correctOrder(chosen) : chosen.every((id, i) => id === correctOrder[i]);
    if (ok) {
      fb.className = 'feedback good'; fb.textContent = feedback || 'Correct order.';
      put(container, h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => onDone({ attempts, order: [...chosen] }) }, 'Continue')));
    } else {
      fb.className = 'feedback bad'; fb.textContent = 'That order is not quite right. Try again.';
      setTimeout(reset, 900);
    }
  };
  put(clear(container), h('p', { class: 'prompt' }, prompt), h('div', { class: 'chips wrap' }, pool), list, fb);
}
