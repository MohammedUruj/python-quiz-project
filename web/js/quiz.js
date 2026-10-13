// Final assessment: one question at a time, review before submit (if allowed by the host),
// server-side scoring, idempotent submission and a stable result screen.

import { h, html, clear, openModal, toast, put } from './ui.js';
import { paretoSVG, controlSVG } from './charts.js';
import { LEVELS } from './levels/index.js';

export function newSubmissionId() {
  if (window.crypto && crypto.randomUUID && window.isSecureContext) return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

function chartFor(q) {
  if (!q.chart) return null;
  const c = q.chart;
  if (c.type === 'pareto') return h('div', { class: 'chart-box' }, html(paretoSVG(c.labels.map((label, i) => ({ label, value: c.values[i] })), { title: c.title })));
  if (c.type === 'control') {
    const sig = c.points.map((p, i) => ({ p, i })).filter(({ p }) => p > c.ucl || p < c.lcl).map(({ i }) => ({ index: i }));
    return h('div', { class: 'chart-box' }, html(controlSVG(c.points, { cl: c.cl, ucl: c.ucl, lcl: c.lcl }, { title: c.title, signals: sig, unit: c.unit })));
  }
  return null;
}

export function openQuiz({ state, onBadge, onClose }) {
  const modal = openModal({ title: 'Final Assessment: The Quality Championship', subtitle: 'Scored separately from practice points', wide: true, onClose });
  const body = modal.body;
  const save = () => state.save();
  let submitting = false;

  const quiz = () => state.data.quiz;

  function intro() {
    clear(body);
    const status = h('p', { class: 'muted' }, 'Loading assessment settings…');
    const start = h('button', { class: 'btn primary', disabled: true, onclick: begin }, 'Start the assessment');
    put(body, 
      h('div', { class: 'quiz-intro' },
        h('p', null, `Participant: `, h('b', null, state.player.name), state.player.team ? ` · ${state.player.team}` : ''),
        h('ul', null,
          h('li', null, 'One question at a time; you can move back and forward before submitting.'),
          h('li', null, 'Your answers are saved on this device as you go, so you can resume if the page closes.'),
          h('li', null, 'Once submitted, your result is final and saved for your trainer.'),
          h('li', null, 'Performance bands are gamification labels, not formal qualifications.')),
        status),
      h('div', { class: 'actions' }, start));
    fetch('/api/config').then((r) => r.json()).then((cfg) => {
      status.textContent = `${cfg.question_count} questions · pass mark ${cfg.passing_threshold}% · ${cfg.allow_review ? 'review before submitting is enabled' : 'answers are submitted at the end without a review screen'}.`;
      start.disabled = false;
    }).catch(() => { status.textContent = 'The assessment server cannot be reached. Start the game with "python run.py" and reload this page.'; });
  }

  async function begin(e) {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const res = await fetch('/api/quiz');
      if (!res.ok) throw new Error('quiz');
      const data = await res.json();
      state.data.quiz = { submissionId: newSubmissionId(), startedAt: Date.now(), questions: data.questions, config: data.config, answers: {}, index: 0, result: null };
      save();
      question();
    } catch {
      toast('Could not load the assessment. Is the server running?', 'bad');
      btn.disabled = false;
    }
  }

  function progress() {
    const q = quiz();
    const answered = Object.keys(q.answers).length;
    return h('div', { class: 'quiz-progress' },
      h('div', { class: 'quiz-progress-top' }, h('span', null, `Question ${q.index + 1} of ${q.questions.length}`), h('span', { class: 'muted' }, `${answered} answered`)),
      h('div', { class: 'bar' }, h('i', { style: { width: `${((q.index + 1) / q.questions.length) * 100}%` } })));
  }

  function question() {
    const q = quiz();
    const item = q.questions[q.index];
    clear(body);
    const opts = item.options.map((o, i) => h('label', { class: `quiz-opt ${q.answers[item.id] === i ? 'selected' : ''}` },
      h('input', { type: 'radio', name: 'quiz-opt', value: String(i), checked: q.answers[item.id] === i, onchange: () => {
        q.answers[item.id] = i; save();
        body.querySelectorAll('.quiz-opt').forEach((el, j) => el.classList.toggle('selected', j === i));
      } }),
      h('span', { class: 'opt-key' }, String.fromCharCode(65 + i)), h('span', null, o)));
    const last = q.index === q.questions.length - 1;
    put(body, progress(),
      h('div', { class: 'quiz-q' },
        h('span', { class: 'tag' }, item.topic),
        item.scenario ? h('div', { class: 'scenario' }, item.scenario) : null,
        chartFor(item),
        h('p', { class: 'prompt', id: 'quiz-prompt' }, item.prompt),
        h('div', { class: 'quiz-opts', role: 'radiogroup', 'aria-labelledby': 'quiz-prompt' }, opts)),
      h('div', { class: 'actions spread' },
        h('button', { class: 'btn', disabled: q.index === 0, onclick: () => { q.index -= 1; save(); question(); } }, '← Previous'),
        last
          ? (q.config.allow_review ? h('button', { class: 'btn primary', onclick: review }, 'Review answers →') : h('button', { class: 'btn primary', onclick: (e) => confirmSubmit(e.currentTarget) }, 'Submit final answers'))
          : h('button', { class: 'btn primary', onclick: () => { q.index += 1; save(); question(); } }, 'Next →')));
  }

  function review() {
    const q = quiz();
    clear(body);
    const unanswered = q.questions.filter((x) => q.answers[x.id] == null).length;
    put(body, h('h3', null, 'Review your answers'),
      h('p', { class: 'muted' }, 'Click a question to change your answer. Nothing is scored until you submit.'),
      h('ol', { class: 'review-list' }, q.questions.map((x, i) => h('li', null, h('button', { class: `review-item ${q.answers[x.id] == null ? 'missing' : ''}`, onclick: () => { q.index = i; save(); question(); } },
        h('span', null, x.prompt), h('b', null, q.answers[x.id] == null ? 'Not answered' : `${String.fromCharCode(65 + q.answers[x.id])}. ${x.options[q.answers[x.id]]}`))))),
      unanswered ? h('div', { class: 'feedback bad' }, `${unanswered} question(s) unanswered. Unanswered questions are scored as incorrect.`) : null,
      h('div', { class: 'actions spread' },
        h('button', { class: 'btn', onclick: () => { q.index = q.questions.length - 1; question(); } }, '← Back to questions'),
        h('button', { class: 'btn primary', onclick: (e) => confirmSubmit(e.currentTarget) }, 'Submit final answers')));
  }

  function confirmSubmit(btn) {
    const q = quiz();
    const unanswered = q.questions.filter((x) => q.answers[x.id] == null).length;
    const msg = unanswered ? `Submit with ${unanswered} unanswered question(s)? This cannot be undone.` : 'Submit your final answers? This cannot be undone.';
    if (!window.confirm(msg)) return;
    submit(btn);
  }

  async function submit(btn) {
    if (submitting) return; // guards against double clicks
    submitting = true;
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    const q = quiz();
    const answers = {};
    q.questions.forEach((x) => { answers[x.id] = q.answers[x.id] ?? null; });
    const payload = {
      submission_id: q.submissionId,
      participant: { name: state.player.name, team: state.player.team || '', employee_id: state.player.employeeId || '' },
      answers,
      practice_points: state.points,
      badges: state.data.badges,
      levels_completed: LEVELS.filter((l) => state.levelStatus(l.id) === 'complete').length,
      duration_seconds: Math.round((Date.now() - q.startedAt) / 1000),
    };
    try {
      const res = await fetch('/api/results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      q.result = data.result;
      save();
      const top = [...(q.config.bands || [])].sort((a, b) => b.min - a.min)[0];
      if (top && q.result.band === top.label) onBadge('Quality Champion');
      result();
    } catch (err) {
      submitting = false;
      btn.disabled = false;
      btn.textContent = 'Try submitting again';
      if (/^Expected \d+ answers/.test(err.message)) {
        // The host changed the assessment length while this attempt was open.
        put(body, h('div', { class: 'feedback bad' }, 'Your trainer changed the assessment settings while you were answering. Please start the updated assessment.',
          h('div', { class: 'actions left' }, h('button', { class: 'btn primary', onclick: () => { state.data.quiz = null; save(); intro(); } }, 'Load the updated assessment'))));
        return;
      }
      toast(`Could not submit: ${err.message}. Your answers are safe; try again.`, 'bad', 5000);
    }
  }

  function result() {
    const r = quiz().result; // stored server result: never recalculated on revisit
    clear(body);
    put(body, 
      h('div', { class: `result-hero ${r.passed ? 'pass' : 'fail'}` },
        h('div', { class: 'score-ring', style: { '--p': `${Math.round(r.percent)}` } }, h('b', null, `${r.percent}%`), h('span', null, `${r.score} / ${r.total}`)),
        h('div', null,
          h('h3', null, r.band),
          h('p', null, r.passed ? `Passed (pass mark ${r.passing_threshold}%).` : `Below the pass mark of ${r.passing_threshold}%. Review the explanations below and talk to your trainer.`),
          h('p', { class: 'muted small' }, `Submitted ${new Date(r.created_at).toLocaleString()} · Practice QIP at submission: ${r.practice_points} · Reference ${r.submission_id.slice(0, 8)}`),
          h('p', { class: 'muted small' }, 'Bands are gamification categories, not formal qualifications.'))),
      h('h4', null, 'Answers and explanations'),
      h('ol', { class: 'explain-list' }, r.review.map((it) => h('li', { class: it.is_correct ? 'ok' : 'no' },
        h('p', null, h('b', null, it.is_correct ? '✔ ' : '✖ '), it.prompt),
        h('p', { class: 'small' }, 'Your answer: ', h('b', null, it.selected == null ? 'not answered' : it.options[it.selected])),
        it.is_correct ? null : h('p', { class: 'small' }, 'Correct answer: ', h('b', null, it.options[it.correct])),
        h('p', { class: 'small muted' }, it.explanation)))),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => modal.close() }, 'Close')));
  }

  const q = quiz();
  if (q && q.result) result();
  else if (q && q.questions) question();
  else intro();
}
