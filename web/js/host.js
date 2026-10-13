// Host dashboard: login, results, summary statistics, settings, CSV export.

import { h, clear, $, toast, put } from './ui.js';

const TOKEN_KEY = 'tqm-host-token';
let token = null;
try { token = sessionStorage.getItem(TOKEN_KEY); } catch { /* ignore */ }
let results = [];

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) } });
  if (res.status === 401) { logout(false); throw new Error('Session expired. Please log in again.'); }
  const isJson = (res.headers.get('Content-Type') || '').includes('json');
  const data = isJson ? await res.json() : await res.blob();
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

function showDash(on) {
  $('#login').hidden = on;
  $('#dash').hidden = !on;
  $('#host-actions').hidden = !on;
}

function logout(callServer = true) {
  if (callServer && token) fetch('/api/host/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  token = null;
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  showDash(false);
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#login-error');
  err.hidden = true;
  try {
    const res = await fetch('/api/host/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: e.target.elements.pin.value.trim() }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    token = data.token;
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
    e.target.reset();
    showDash(true);
    load();
  } catch (ex) {
    err.textContent = ex.message; err.hidden = false;
  }
});

async function load() {
  try {
    const [r, s, c] = await Promise.all([api('/api/host/results'), api('/api/host/summary'), api('/api/host/config')]);
    results = r.results;
    renderSummary(s);
    renderResults();
    renderSettings(c.config, c.bank_size);
  } catch (ex) { toast(ex.message, 'bad'); }
}

function card(label, value) { return h('div', { class: 'summary-card-h' }, h('span', null, label), h('b', null, String(value))); }

function renderSummary(s) {
  put(clear($('#summary')), card('Participants', s.participants), card('Average score', `${s.average_percent}%`), card('Pass rate', `${s.pass_rate}%`), card('Highest score', `${s.highest_percent}%`));
  const bands = clear($('#bands'));
  const entries = Object.entries(s.bands).sort((a, b) => b[1] - a[1]);
  if (!entries.length) put(bands, h('p', { class: 'empty' }, 'No results yet.'));
  entries.forEach(([label, n]) => put(bands, h('div', { class: 'band-row' }, h('span', null, label), h('div', { class: 'meter-bar' }, h('i', { style: { width: `${(n / s.participants) * 100}%` } })), h('b', null, String(n)))));
  const q = clear($('#questions'));
  if (!s.questions.length) { put(q, h('p', { class: 'empty' }, 'Question statistics appear after the first submission.')); return; }
  put(q, h('table', { class: 'data-table' },
    h('thead', null, h('tr', null, h('th', null, 'Question'), h('th', null, 'Topic'), h('th', { class: 'num' }, 'Correct'))),
    h('tbody', null, s.questions.slice(0, 10).map((x) => h('tr', null, h('td', null, x.prompt), h('td', null, x.topic), h('td', { class: 'num' }, `${x.percent_correct}% (${x.correct}/${x.attempts})`))))));
}

function renderResults() {
  const f = ($('#filter').value || '').toLowerCase();
  const rows = results.filter((r) => !f || [r.participant_name, r.team, r.band, r.employee_id].join(' ').toLowerCase().includes(f));
  const box = clear($('#results'));
  if (!rows.length) { put(box, h('p', { class: 'empty' }, results.length ? 'No results match the filter.' : 'No results yet. Results appear here as participants submit the final assessment.')); return; }
  put(box, h('table', { class: 'data-table' },
    h('thead', null, h('tr', null, ['Submitted', 'Name', 'Team', 'Employee ID', 'Score', '%', 'Band', 'Pass', 'Practice QIP', 'Missions', 'Time', ''].map((c) => h('th', { class: ['Score', '%', 'Practice QIP', 'Missions', 'Time'].includes(c) ? 'num' : '' }, c)))),
    h('tbody', null, rows.map((r) => h('tr', null,
      h('td', null, new Date(r.created_at).toLocaleString()),
      h('td', null, r.participant_name), h('td', null, r.team || '—'), h('td', null, r.employee_id || '—'),
      h('td', { class: 'num' }, `${r.score}/${r.total}`), h('td', { class: 'num' }, `${r.percent}%`), h('td', null, r.band),
      h('td', { class: r.passed ? 'pass-yes' : 'pass-no' }, r.passed ? 'Pass' : 'Not yet'),
      h('td', { class: 'num' }, String(r.practice_points)), h('td', { class: 'num' }, `${r.levels_completed}/8`),
      h('td', { class: 'num' }, `${Math.round(r.duration_seconds / 60)} min`),
      h('td', null, h('button', { class: 'icon-del', title: 'Delete this result', 'aria-label': `Delete result for ${r.participant_name}`, onclick: () => del(r) }, '✕')))))));
}

async function del(r) {
  if (!window.confirm(`Delete the result for ${r.participant_name} (${r.percent}%)? This cannot be undone.`)) return;
  try { await api(`/api/host/results/${r.id}`, { method: 'DELETE' }); toast('Result deleted.', 'good'); load(); } catch (ex) { toast(ex.message, 'bad'); }
}

function bandRow(b = { label: '', min: 0 }) {
  const row = h('div', { class: 'band-edit' },
    h('input', { type: 'text', name: 'band_label', value: b.label, maxlength: '60', placeholder: 'Band label', 'aria-label': 'Band label', required: true }),
    h('input', { type: 'number', name: 'band_min', value: String(b.min), min: '0', max: '100', step: '1', 'aria-label': 'Minimum %', required: true }),
    h('button', { type: 'button', class: 'icon-del', 'aria-label': 'Remove band', onclick: () => row.remove() }, '✕'));
  return row;
}

function renderSettings(cfg, bankSize) {
  const f = $('#settings');
  f.elements.passing_threshold.value = cfg.passing_threshold;
  f.elements.question_count.value = cfg.question_count;
  f.elements.question_count.max = bankSize;
  f.elements.allow_review.checked = cfg.allow_review;
  f.elements.shuffle_questions.checked = cfg.shuffle_questions;
  f.elements.require_levels_before_quiz.checked = cfg.require_levels_before_quiz;
  put(clear($('#band-editor')), cfg.bands.map((b) => bandRow(b)));
  $('#settings-status').textContent = `Question bank: ${bankSize} questions (20 core questions cover every topic).`;
}

$('#add-band').addEventListener('click', () => put($('#band-editor'), bandRow()));

$('#settings').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const bands = [...document.querySelectorAll('.band-edit')].map((row) => ({ label: row.querySelector('[name=band_label]').value.trim(), min: Number(row.querySelector('[name=band_min]').value) }));
  const body = {
    passing_threshold: Number(f.elements.passing_threshold.value),
    question_count: Number(f.elements.question_count.value),
    allow_review: f.elements.allow_review.checked,
    shuffle_questions: f.elements.shuffle_questions.checked,
    require_levels_before_quiz: f.elements.require_levels_before_quiz.checked,
    bands,
  };
  try {
    const data = await api('/api/host/config', { method: 'PUT', body: JSON.stringify(body) });
    renderSettings(data.config, Number(f.elements.question_count.max));
    toast('Settings saved.', 'good');
  } catch (ex) { toast(ex.message, 'bad', 5000); }
});

$('#filter').addEventListener('input', renderResults);
$('#btn-refresh').addEventListener('click', load);
$('#btn-logout').addEventListener('click', () => logout(true));
$('#btn-export').addEventListener('click', async () => {
  try {
    const blob = await api('/api/host/export.csv');
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `tqm_results_${new Date().toISOString().slice(0, 10)}.csv` });
    put(document.body, a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (ex) { toast(ex.message, 'bad'); }
});
$('#btn-clear').addEventListener('click', async () => {
  const typed = window.prompt('This permanently deletes ALL results. Type DELETE to confirm.');
  if (typed !== 'DELETE') return;
  try { const d = await api('/api/host/results', { method: 'DELETE' }); toast(`${d.deleted} result(s) deleted.`, 'good'); load(); } catch (ex) { toast(ex.message, 'bad'); }
});

if (token) { showDash(true); load(); } else showDash(false);
