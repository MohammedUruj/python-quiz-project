// Game orchestration: levels, tasks, HUD, panels (mission log, evidence, map, KPIs, badges).

import { h, html, clear, openModal, toast, closeAllModals, isModalOpen, put } from './ui.js';
import { LEVELS, levelById, ALL_BADGES } from './levels/index.js';
import { stationById, AREAS, STATIONS } from './world.js';
import { kpiView } from './state.js';
import { portraitSVG, NPCS, AVATARS } from './art.js';
import { lineSVG } from './charts.js';
import { renderReport } from './levels/final.js';
import { openQuiz } from './quiz.js';

export const lvLabel = (lv) => (lv.id === 'tutorial' ? 'Tutorial' : lv.id === 'final' ? 'Final challenge' : `Level ${lv.num}`);

export function createGame({ state, world, hud }) {
  const touchUI = window.matchMedia('(pointer: coarse)').matches;

  // ---------- progression ----------
  function ensureUnlocks() {
    let prevComplete = true;
    for (const lv of LEVELS) {
      const st = state.levelStatus(lv.id);
      if (st === 'locked' && prevComplete) state.setLevelStatus(lv.id, 'available');
      prevComplete = state.levelStatus(lv.id) === 'complete';
    }
  }

  function currentLevel() {
    return LEVELS.find((lv) => state.levelStatus(lv.id) !== 'complete') || null;
  }

  const taskDone = (lv, t) => state.task(lv.id, t.id).done;
  const taskReady = (lv, t) => (t.requires || []).every((r) => taskDone(lv, lv.tasks.find((x) => x.id === r)));

  function availableTasks(lv) {
    return lv ? lv.tasks.filter((t) => !taskDone(lv, t) && taskReady(lv, t)) : [];
  }

  function levelProgress(lv) {
    const done = lv.tasks.filter((t) => taskDone(lv, t)).length;
    return { done, total: lv.tasks.length };
  }

  // ---------- world hooks ----------
  function stationState(stationId) {
    const lv = currentLevel();
    if (!lv) return stationId === 'quizTerminal' && !(state.data.quiz && state.data.quiz.result) ? { active: true } : null;
    if (!state.flag(`briefed_${lv.id}`)) return stationId === 'npcManager' && lv.id === 'tutorial' ? { active: true } : null;
    return availableTasks(lv).some((t) => t.station === stationId) ? { active: true } : null;
  }

  function promptFor(station) {
    const lv = currentLevel();
    const t = lv && state.flag(`briefed_${lv.id}`) && availableTasks(lv).find((x) => x.station === station.id);
    const action = t ? t.prompt : `${station.verb} the ${station.label.replace(/ \(.*\)/, '')}`;
    return station.kind === 'npc' && !t ? `talk to ${station.label.replace(/ \(.*\)/, '')}` : action;
  }

  function onNearest(station) {
    if (!station) { hud.prompt.hidden = true; return; }
    hud.prompt.hidden = false;
    put(clear(hud.prompt), touchUI ? 'Tap ' : 'Press ', h('kbd', null, touchUI ? '●' : 'E'), ` to ${promptFor(station)}.`);
  }

  function onInteract(stationId) {
    if (isModalOpen()) return;
    const station = stationById[stationId];
    if (stationId === 'quizTerminal') return openAssessment();
    const lv = currentLevel();
    if (lv && !state.flag(`briefed_${lv.id}`)) {
      showBriefing(lv);
      return;
    }
    const t = lv && availableTasks(lv).find((x) => x.station === stationId);
    if (t) return runTask(lv, t, false);
    const blocked = lv && lv.tasks.find((x) => x.station === stationId && !taskDone(lv, x));
    if (blocked) {
      const missing = (blocked.requires || []).map((r) => lv.tasks.find((x) => x.id === r)).filter((x) => !taskDone(lv, x));
      toast(`First complete: ${missing.map((m) => m.title).join('; ')}`, 'warn', 4200);
      return;
    }
    showStationInfo(station);
  }

  // ---------- tasks ----------
  function runTask(lv, task, practice) {
    const station = stationById[task.station];
    const area = AREAS.find((a) => a.id === station.area);
    world.setPaused(true);
    const modal = openModal({
      title: task.title,
      subtitle: `${lv.id === 'final' ? lv.title : `${lvLabel(lv)} · ${lv.title}`} · ${area.name}${practice ? ' · PRACTICE (best score kept)' : ''}`,
      wide: true,
      onClose: () => { if (!isModalOpen()) world.setPaused(false); },
    });
    const ctx = {
      body: modal.body,
      state,
      practice,
      evidence(item) {
        if (state.addEvidence(item)) toast(`📁 Evidence collected: ${item.title}`, 'info', 2600);
      },
      finish(result) {
        const { gained } = state.recordTask(lv.id, task.id, result);
        if (result.max > 0) toast(gained > 0 ? `+${gained} QIP · ${result.points}/${result.max} on "${task.title}"` : `Score ${result.points}/${result.max} (best kept)`, gained > 0 ? 'good' : 'info');
        else toast(`Completed: ${task.title}`, 'good');
        if (!practice) state.log(`${lv.title}: completed "${task.title}" (${result.points}/${result.max})`);
        modal.close();
        afterTask(lv);
      },
    };
    try {
      task.run(ctx);
    } catch (err) {
      console.error(err);
      put(modal.body, h('p', { class: 'feedback bad' }, 'Something went wrong loading this activity. Please close and try again.'));
    }
  }

  function afterTask(lv) {
    if (state.levelStatus(lv.id) !== 'complete' && lv.tasks.every((t) => taskDone(lv, t))) completeLevel(lv);
    else updateHud();
  }

  function completeLevel(lv) {
    const before = kpiView(state.kpi);
    const { best, max } = state.levelScore(lv.id);
    const perf = max > 0 ? best / max : 1;
    state.setLevelStatus(lv.id, 'complete');
    if (lv.kpiEffect) state.updateKpi(lv.title, (k) => lv.kpiEffect(k, perf));
    const after = kpiView(state.kpi);
    const newBadge = lv.badge && state.addBadge(lv.badge);
    if (lv.reward) state.addInventory(lv.reward);
    state.log(`Completed ${lvLabel(lv)}: ${lv.title} (${best}/${max} QIP)`);
    ensureUnlocks();
    updateHud();
    showDebrief(lv, { best, max, perf, before, after, newBadge });
  }

  // ---------- briefings & debriefs ----------
  function showBriefing(lv) {
    world.setPaused(true);
    const npc = NPCS[lv.briefing.speaker];
    const modal = openModal({ title: lv.id === 'final' ? lv.title : `${lvLabel(lv)}: ${lv.title}`, subtitle: 'Mission briefing', wide: true, onClose: () => { if (!isModalOpen()) world.setPaused(false); } });
    put(modal.body, 
      h('div', { class: 'briefing' }, html(portraitSVG(npc, 96)), h('div', null, h('p', { class: 'who' }, `${npc.name} · ${npc.role}`), h('blockquote', null, lv.briefing.text))),
      h('div', { class: 'two-col' },
        h('div', null, h('h4', null, 'Objectives'), h('ol', null, lv.briefing.objectives.map((o) => h('li', null, o)))),
        h('div', null, h('h4', null, 'You will learn'), h('ul', null, lv.briefing.learn.map((o) => h('li', null, o))))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', onclick: () => {
          state.flag(`briefed_${lv.id}`, true);
          state.log(`Mission accepted: ${lv.title}`);
          modal.close();
          updateHud();
          const first = availableTasks(lv)[0];
          if (first && lv.id !== 'tutorial') toast(`Objective: ${first.title}. Open the Mission Log (L) to quick-travel.`, 'info', 4500);
        } }, 'Accept mission')));
  }

  function showDebrief(lv, { best, max, perf, before, after, newBadge }) {
    world.setPaused(true);
    const next = currentLevel();
    const modal = openModal({ title: `${lvLabel(lv)} complete`, subtitle: lv.title, wide: true, onClose: () => { if (!isModalOpen()) world.setPaused(false); } });
    const delta = (label, a, b, unit, lower) => {
      const d = Math.round((b - a) * 100) / 100;
      const good = lower ? d < 0 : d > 0;
      return h('div', { class: 'kpi-cell' }, h('span', null, label), h('b', null, `${b}${unit}`), d ? h('small', { class: good ? 'good-text' : 'bad-text' }, `${d > 0 ? '+' : ''}${d}${unit}`) : h('small', { class: 'muted' }, 'no change'));
    };
    put(modal.body, 
      h('div', { class: 'debrief-score' }, h('div', { class: 'score-ring', style: { '--p': `${Math.round(perf * 100)}` } }, h('b', null, `${best}`), h('span', null, `of ${max} QIP`)),
        h('div', null, h('h3', null, lv.debrief.principle), h('p', null, lv.debrief.text))),
      lv.kpiEffect ? h('div', null, h('h4', null, 'Factory indicators after this level (fictional)'), h('div', { class: 'kpi-board' },
        delta('Rejection rate', before.rejectionRate, after.rejectionRate, '%', true),
        delta('First-pass yield', before.fpy, after.fpy, '%', false),
        delta('Rework rate', before.reworkRate, after.reworkRate, '%', true),
        delta('Complaints/month', before.complaints, after.complaints, '', true))) : null,
      h('div', { class: 'rewards' },
        newBadge ? h('div', { class: 'badge-earned' }, h('span', { class: 'medal' }, '🏅'), h('div', null, h('b', null, `Badge earned: ${lv.badge}`))) : null,
        lv.reward ? h('div', { class: 'badge-earned' }, h('span', { class: 'medal' }, '🧰'), h('div', null, h('b', null, `New in your inventory: ${lv.reward.name}`), h('p', { class: 'muted small' }, lv.reward.desc))) : null),
      h('p', { class: 'muted small' }, 'Practice activities can be replayed from the Mission Log; your best score is kept.'),
      h('div', { class: 'actions' },
        lv.id === 'final' ? h('button', { class: 'btn', onclick: () => { modal.close(); showReport(); } }, 'View factory report') : null,
        h('button', { class: 'btn primary', onclick: () => {
          modal.close();
          if (next) showBriefing(next);
          else { world.teleportTo('quizTerminal'); toast('Head to the assessment terminal in the Training Room.', 'info', 4000); }
        } }, next ? `Next: ${next.id === 'final' ? '' : `${lvLabel(next)}: `}${next.title}` : 'Go to the final assessment')));
  }

  function showStationInfo(station) {
    world.setPaused(true);
    const modal = openModal({ title: station.label, subtitle: AREAS.find((a) => a.id === station.area).name, onClose: () => { if (!isModalOpen()) world.setPaused(false); } });
    if (station.kind === 'npc') {
      const npc = NPCS[station.npc];
      put(modal.body, h('div', { class: 'speech' }, html(portraitSVG(npc, 56)), h('div', { class: 'speech-bubble' }, h('strong', null, npc.name), h('span', { class: 'role' }, ` · ${npc.role}`), h('p', null, idleLine(station.npc)))));
    } else put(modal.body, h('p', null, station.info));
    const replays = [];
    LEVELS.forEach((lv) => lv.tasks.forEach((t) => { if (t.station === station.id && taskDone(lv, t)) replays.push({ lv, t }); }));
    if (replays.length) {
      put(modal.body, h('h4', null, 'Practice again'), h('div', { class: 'options' }, replays.map(({ lv, t }) => {
        const rec = state.task(lv.id, t.id);
        return h('button', { class: 'option', onclick: () => { modal.close(); runTask(lv, t, true); } }, h('span', null, `${t.title}`), h('span', { class: 'muted' }, `  best ${rec.best}/${rec.max}`));
      })));
    }
  }

  function idleLine(npc) {
    const lv = currentLevel();
    const lines = {
      manager: lv ? `Your current mission is "${lv.title}". Check the Mission Log if you need direction.` : 'You have completed every mission. The final assessment is waiting in the Training Room.',
      supervisor: 'Output matters, but I am starting to see that quality problems eat our output too.',
      operator: 'Press 4 has been much calmer since the new bladder went in.',
      inspector: 'Inspection tells us what went wrong. Prevention stops it happening.',
      maintenance: 'Cycle-based PM makes my planning easier, not harder.',
      lab: 'Data first, opinions second. Bring me evidence and I will help you test it.',
      customer: 'Customers remember how we handled a problem far longer than the problem itself.',
      builder: 'Small improvements every day add up. Ask the people who do the work.',
    };
    return lines[npc] || 'Hello!';
  }

  // ---------- panels ----------
  function openPanel(fn, opts) {
    if (isModalOpen()) closeAllModals();
    world.setPaused(true);
    const modal = openModal({ ...opts, onClose: () => { if (!isModalOpen()) world.setPaused(false); } });
    fn(modal);
    return modal;
  }

  function showMissionLog() {
    openPanel((modal) => {
      const lvNow = currentLevel();
      put(modal.body, h('p', { class: 'muted' }, 'Yellow ! markers in the factory show where your current objectives are. Use "Go" to quick-travel.'));
      LEVELS.forEach((lv) => {
        const st = state.levelStatus(lv.id);
        const { done, total } = levelProgress(lv);
        const sc = state.levelScore(lv.id);
        const isNow = lvNow && lvNow.id === lv.id;
        const sec = h('details', { class: `log-level ${st}`, open: isNow },
          h('summary', null, h('span', { class: `status-dot ${st}` }), h('b', null, lv.id === 'final' ? lv.title : `${lvLabel(lv)}: ${lv.title}`), h('span', { class: 'muted' }, ` · ${st === 'locked' ? 'locked' : `${done}/${total} tasks · ${sc.best} QIP`}`)));
        if (st !== 'locked') {
          if (isNow && !state.flag(`briefed_${lv.id}`)) put(sec, h('div', { class: 'actions left' }, h('button', { class: 'btn primary small', onclick: () => { modal.close(); showBriefing(lv); } }, 'Open mission briefing')));
          put(sec, h('ul', { class: 'task-list' }, lv.tasks.map((t) => {
            const rec = state.task(lv.id, t.id);
            const ready = taskReady(lv, t);
            const s = stationById[t.station];
            return h('li', { class: rec.done ? 'done' : ready ? 'ready' : 'waiting' },
              h('span', { class: 'check' }, rec.done ? '✔' : ready ? '●' : '○'),
              h('span', { class: 'task-title' }, t.title, h('small', { class: 'muted' }, ` · ${s.label}${rec.done ? ` · best ${rec.best}/${rec.max}` : ''}`)),
              (ready || rec.done) ? h('button', { class: 'btn small', onclick: () => { modal.close(); world.teleportTo(t.station); } }, 'Go') : h('small', { class: 'muted' }, 'needs earlier tasks'));
          })));
        }
        put(modal.body, sec);
      });
      put(modal.body, h('h4', null, 'Recent activity'), h('ul', { class: 'activity' }, state.data.log.slice(0, 8).map((l) => h('li', null, h('small', { class: 'muted' }, new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), ` ${l.text}`))));
    }, { title: 'Mission log', subtitle: `${state.player.name} · Quality Improvement Engineer`, wide: true });
  }

  function showEvidence() {
    openPanel((modal) => {
      put(modal.body, h('h4', null, 'Inventory'),
        state.data.inventory.length ? h('div', { class: 'inv-grid' }, state.data.inventory.map((i) => h('div', { class: 'inv-item' }, h('b', null, `🧰 ${i.name}`), h('p', { class: 'muted small' }, i.desc)))) : h('p', { class: 'muted' }, 'Nothing yet. Complete missions to earn quality tools.'),
        h('h4', null, `Evidence folder (${state.data.evidence.length})`),
        state.data.evidence.length ? h('div', { class: 'evidence-list' }, [...state.data.evidence].reverse().map((e) => h('div', { class: `evidence ${/VERIFIED/.test(e.title) ? 'verified' : ''}` }, h('b', null, e.title), h('p', null, e.text)))) : h('p', { class: 'muted' }, 'Interview people, read records and analyse data to collect evidence.'));
    }, { title: 'Evidence & inventory', wide: true });
  }

  function showMap() {
    openPanel((modal) => {
      const lv = currentLevel();
      const targets = new Set(lv && state.flag(`briefed_${lv.id}`) ? availableTasks(lv).map((t) => stationById[t.station].area) : []);
      put(modal.body, h('p', { class: 'muted' }, 'Tap an area to quick-travel. Areas with current objectives are highlighted. Production flows 1 → 5.'),
        h('div', { class: 'factory-map' }, AREAS.map((a) => h('button', {
          class: `map-area ${targets.has(a.id) ? 'target' : ''}`,
          style: { gridColumn: String(['mixing', 'control'].includes(a.id) ? 1 : ['components', 'training'].includes(a.id) ? 2 : ['building', 'lab'].includes(a.id) ? 3 : 4), gridRow: String(a.y < 400 ? 1 : 3) },
          onclick: () => { modal.close(); world.teleportArea(a.id); },
        }, h('b', null, `${a.step ? `${a.step}. ` : ''}${a.short}`), h('small', null, STATIONS.filter((s) => s.area === a.id && s.kind !== 'npc').map((s) => s.label).slice(0, 3).join(' · ')), targets.has(a.id) ? h('span', { class: 'map-flag' }, '!') : null)),
        h('div', { class: 'map-aisle' }, 'Main aisle')));
    }, { title: 'Factory map', subtitle: 'Qualitrax Tyres · fictional plant', wide: true });
  }

  function showKpis() {
    openPanel((modal) => {
      const v = kpiView(state.kpi);
      const hist = state.data.kpiHistory;
      put(modal.body, 
        h('div', { class: 'kpi-board' },
          kcell('Rejection rate', `${v.rejectionRate}%`), kcell('First-pass yield', `${v.fpy}%`), kcell('Rework rate', `${v.reworkRate}%`),
          kcell('Complaints / month', v.complaints), kcell('Good output / week', v.output.toLocaleString()), kcell('Customer confidence', `${v.confidence}/100`)),
        h('p', null, h('b', null, 'Improvement project status: '), v.project),
        hist.length > 1 ? h('div', { class: 'chart-box' }, html(lineSVG([
          { label: 'Rejection rate %', values: hist.map((x) => kpiView(x).rejectionRate) },
          { label: 'Rework rate %', values: hist.map((x) => kpiView(x).reworkRate), cls: 'alt' },
        ], { title: 'Rejection and rework rate by milestone', labels: hist.map((x, i) => (i === 0 ? 'Start' : `M${i}`)), unit: '%' }))) : null,
        h('div', { class: 'formula' },
          h('p', null, h('b', null, 'Definitions (fictional weekly data, final inspection)')),
          h('p', null, 'Rejection rate = rejected units ÷ inspected units × 100'),
          h('p', null, 'Rework rate = reworked units ÷ inspected units × 100'),
          h('p', null, 'First-pass yield = (inspected − rejected − reworked) ÷ inspected × 100. Numerator: units passing first time with no rework or rejection, a subset of the denominator.'),
          h('p', null, 'Good output = inspected − rejected. Customer confidence is a fictional 0–100 simulation index.'),
          h('p', { class: 'muted small' }, `This week: ${state.kpi.inspected.toLocaleString()} inspected, ${state.kpi.rejected} rejected, ${state.kpi.reworked} reworked.`)));
    }, { title: 'Factory performance dashboard', subtitle: 'Simulation indicators (fictional data)', wide: true });
  }
  const kcell = (k, v) => h('div', { class: 'kpi-cell' }, h('span', null, k), h('b', null, String(v)));

  function showBadges() {
    openPanel((modal) => {
      put(modal.body, h('div', { class: 'badge-grid' }, ALL_BADGES.map((b) => {
        const has = state.data.badges.includes(b.name);
        return h('div', { class: `badge ${has ? 'earned' : ''}` }, h('span', { class: 'medal' }, has ? '🏅' : '🔒'), h('b', null, b.name), h('small', null, b.desc));
      })), h('p', { class: 'muted small' }, 'Badges and bands are gamification labels, not formal qualifications.'));
    }, { title: 'Badges' });
  }

  function showReport() {
    const report = state.flag('final_report');
    openPanel((modal) => {
      if (report) put(modal.body, renderReport(report, state));
      else put(modal.body, h('p', null, 'Complete the final challenge to generate the factory performance report.'));
    }, { title: 'Factory performance report', wide: true });
  }

  function showHelp() {
    openPanel((modal) => {
      put(modal.body, h('div', { class: 'help-grid' },
        h('div', null, h('h4', null, 'Keyboard'), h('ul', null,
          h('li', null, h('kbd', null, 'W A S D'), ' or arrow keys: move'), h('li', null, h('kbd', null, 'E'), ' / Enter: interact'),
          h('li', null, h('kbd', null, 'L'), ' mission log · ', h('kbd', null, 'I'), ' evidence · ', h('kbd', null, 'M'), ' map'),
          h('li', null, h('kbd', null, 'K'), ' KPI dashboard · ', h('kbd', null, 'B'), ' badges · ', h('kbd', null, 'Esc'), ' close'))),
        h('div', null, h('h4', null, 'Mouse & touch'), h('ul', null,
          h('li', null, 'Click or tap the floor to walk there.'), h('li', null, 'Click a machine or person to walk to it; click again to interact.'),
          h('li', null, 'On phones and tablets use the on-screen pad and the ● button.'))),
        h('div', null, h('h4', null, 'Scoring'), h('ul', null,
          h('li', null, 'Quality Improvement Points (QIP) reward sound, evidence-based decisions in practice activities.'),
          h('li', null, 'Wrong answers explain why. Retry for fewer points; replays keep your best score.'),
          h('li', null, 'The final assessment is scored separately and saved for your trainer.')))),
      h('p', { class: 'muted small' }, 'All companies, people and data in this game are fictional and for training purposes only.'));
    }, { title: 'How to play', wide: true });
  }

  function showMenu() {
    openPanel((modal) => {
      put(modal.body, h('div', { class: 'options' },
        h('button', { class: 'option', onclick: () => { modal.close(); showReport(); } }, 'Factory performance report'),
        h('button', { class: 'option', onclick: () => { modal.close(); showHelp(); } }, 'How to play'),
        h('button', { class: 'option', onclick: () => { modal.close(); openAssessment(); } }, 'Final assessment'),
        h('a', { class: 'option', href: '/host', target: '_blank', rel: 'noopener' }, 'Host dashboard (trainers)'),
        h('button', { class: 'option danger', onclick: () => {
          if (window.confirm('Reset all progress on this device? Saved assessment results on the server are not affected.')) { state.reset(); window.location.reload(); }
        } }, 'Reset my progress on this device')));
    }, { title: 'Menu' });
  }

  async function openAssessment() {
    const finalDone = state.levelStatus('final') === 'complete';
    let cfg = { require_levels_before_quiz: true };
    try { const res = await fetch('/api/config'); if (res.ok) cfg = await res.json(); } catch { /* offline: keep default */ }
    if (cfg.require_levels_before_quiz && !finalDone && !(state.data.quiz && state.data.quiz.result)) {
      toast('The final assessment unlocks after the Quality Championship challenge.', 'warn', 4000);
      return;
    }
    world.setPaused(true);
    openQuiz({ state, onBadge: (b) => { if (state.addBadge(b)) toast(`🏅 Badge earned: ${b}`, 'good'); updateHud(); }, onClose: () => { if (!isModalOpen()) world.setPaused(false); } });
  }

  // ---------- HUD ----------
  function updateHud() {
    const lv = currentLevel();
    const p = state.player;
    const avatar = AVATARS.find((a) => a.id === p.avatar) || AVATARS[0];
    hud.avatar.innerHTML = portraitSVG({ ...avatar }, 40);
    hud.name.textContent = p.name;
    hud.points.textContent = state.points.toLocaleString();
    hud.badges.textContent = String(state.data.badges.length);
    const complete = LEVELS.filter((l) => state.levelStatus(l.id) === 'complete').length;
    hud.overall.style.width = `${(complete / LEVELS.length) * 100}%`;
    hud.overallLabel.textContent = `${complete}/${LEVELS.length} missions`;
    if (lv) {
      const { done, total } = levelProgress(lv);
      hud.level.textContent = lv.id === 'final' ? lv.title : `${lvLabel(lv)}: ${lv.title}`;
      hud.levelBar.style.width = `${(done / total) * 100}%`;
      const nextTask = state.flag(`briefed_${lv.id}`) ? availableTasks(lv)[0] : null;
      hud.objective.textContent = nextTask ? `▶ ${nextTask.title} · ${AREAS.find((a) => a.id === stationById[nextTask.station].area).short}` : state.flag(`briefed_${lv.id}`) ? '' : '▶ Talk to Elena Marsh in the Control Room to get your briefing';
    } else {
      hud.level.textContent = 'All missions complete';
      hud.levelBar.style.width = '100%';
      hud.objective.textContent = state.data.quiz && state.data.quiz.result ? '✔ Final assessment submitted' : '▶ Take the final assessment (Training Room terminal)';
    }
  }

  function start() {
    ensureUnlocks();
    updateHud();
    state.onChange(updateHud);
    const lv = currentLevel();
    if (lv && lv.id === 'tutorial' && !state.flag('briefed_tutorial')) {
      setTimeout(() => showBriefing(lv), 400);
    } else if (lv && !state.flag(`briefed_${lv.id}`)) {
      setTimeout(() => showBriefing(lv), 400);
    }
  }

  return {
    start, stationState, onNearest, onInteract, updateHud,
    showMissionLog, showEvidence, showMap, showKpis, showBadges, showHelp, showMenu, showReport, openAssessment,
  };
}
