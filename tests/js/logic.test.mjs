// Logic tests for the game's pure modules. Run with:  node --test tests/js/
import test from 'node:test';
import assert from 'node:assert/strict';

import * as S from '../../web/js/stats.js';
import { DEFECT_DATASETS, CHECK_RECORDS, PROCESS_DATA } from '../../web/js/data.js';

// Modules below touch `window`/`localStorage` only inside functions, but provide minimal stubs anyway.
globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };

test('mean, stdev and rounding', () => {
  assert.equal(S.mean([1, 2, 3, 4]), 2.5);
  assert.equal(S.round(S.stdev([2, 4, 4, 4, 5, 5, 7, 9]), 3), 2.138);
  assert.equal(S.pct(90, 1500), 6);
});

test('pareto sorts descending with correct cumulative percentages', () => {
  const rows = S.pareto([{ label: 'B', value: 60 }, { label: 'A', value: 120 }, { label: 'C', value: 20 }]);
  assert.deepEqual(rows.map((r) => r.label), ['A', 'B', 'C']);
  assert.equal(S.round(rows[1].cumulative, 1), 90);
  assert.equal(rows[2].cumulative, 100);
  assert.deepEqual(S.vitalFew(rows, 80).map((r) => r.label), ['A', 'B']);
});

test('pareto of the quiz chart: top two = 75%', () => {
  const rows = S.pareto([120, 60, 30, 20, 10].map((value, i) => ({ label: `c${i}`, value })));
  assert.equal(rows[1].cumulative, 75);
});

test('defect datasets are internally consistent', () => {
  const total = (k) => S.sum(DEFECT_DATASETS[k].rows.map((r) => r.value));
  assert.equal(total('sep_lineA') + total('sep_lineB'), total('sep_all'));
  DEFECT_DATASETS.sep_lineB.rows.forEach((r) => assert.ok(r.value >= 0));
  const top = S.pareto(DEFECT_DATASETS.sep_all.rows)[0];
  assert.equal(top.label, 'Blister');
});

test('check sheet sample: blisters concentrated on Press 4, similar across shifts', () => {
  const p4 = CHECK_RECORDS.filter((r) => r.press === 'Press 4' && r.defect === 'Blister');
  const all = CHECK_RECORDS.filter((r) => r.defect === 'Blister');
  assert.equal(CHECK_RECORDS.length, 24);
  assert.ok(p4.length / all.length > 0.75);
  const shifts = ['A', 'B', 'C'].map((s) => p4.filter((r) => r.shift === s).length);
  assert.ok(Math.max(...shifts) - Math.min(...shifts) <= 1);
});

test('individuals chart limits use MR-bar / 1.128', () => {
  const xs = [10, 12, 11, 13, 12];
  const lim = S.individualsLimits(xs);
  const mr = (2 + 1 + 2 + 1) / 4;
  assert.equal(S.round(lim.ucl, 6), S.round(11.6 + 3 * (mr / 1.128), 6));
  assert.equal(S.round(lim.lcl, 6), S.round(11.6 - 3 * (mr / 1.128), 6));
});

test('control signals: beyond limits and run of 8', () => {
  const lim = { cl: 0, ucl: 3, lcl: -3 };
  assert.deepEqual(S.controlSignals([0, 4, 0], lim), [{ index: 1, rule: 'beyond' }]);
  const run = S.controlSignals([1, 1, 1, 1, 1, 1, 1, 1], lim);
  assert.deepEqual(run, [{ index: 7, rule: 'run8' }]);
});

test('tread width data: stable, off-centre, not capable (the Level 2 story)', () => {
  const d = PROCESS_DATA.tread;
  const lim = S.individualsLimits(d.values, d.baseline);
  assert.equal(S.controlSignals(d.values, lim).length, 0, 'should be in control');
  const cap = S.capability(d.values, d.lsl, d.usl);
  assert.ok(cap.cpk < 1.0 && cap.cpk > 0.6, `cpk ${cap.cpk}`);
  assert.ok(cap.cp > 1.33, `cp ${cap.cp}`);
  assert.ok(S.mean(d.values) > 210.4);
});

test('bladder pressure data: shift after sample 20 but still above the 14.0 bar minimum', () => {
  const d = PROCESS_DATA.pressure;
  const lim = S.individualsLimits(d.values, d.baseline);
  const sig = S.controlSignals(d.values, lim);
  assert.ok(sig.length > 0);
  assert.ok(sig.every((s) => s.index >= 17), 'no signals early in the baseline');
  assert.equal(sig.find((s) => s.rule === 'beyond').index, 20);
  assert.equal(S.outOfSpec(d.values, d.lsl, d.usl), 0);
});

test('KPI formulas: FPY numerator is a subset of the denominator', () => {
  assert.equal(S.rejectionRate(588, 12000), 4.9);
  assert.equal(S.firstPassYield(1000, 30, 50), 92);
  assert.equal(S.firstPassYield(10, 8, 8), 0);
});

test('PDCA scenarios produce the intended outcome classes', async () => {
  const { COUNTERMEASURES, BASELINE_RATE } = await import('../../web/js/levels/level4.js');
  assert.equal(BASELINE_RATE, 6.2);
  const avg = (k) => S.mean(COUNTERMEASURES[k].weekly);
  assert.ok(avg('system') <= 1.0, 'system fix meets target');
  assert.ok(avg('replace') <= 1.0, 'replace-only looks fine in the data');
  assert.equal(COUNTERMEASURES.replace.act, 'modify');
  const flashRise = COUNTERMEASURES.pressure.flash.at(-1) - COUNTERMEASURES.pressure.flash[0];
  assert.ok(flashRise > 1.5, 'pressure increase creates a trade-off');
  assert.ok(Math.abs(avg('inspect') - BASELINE_RATE) < 0.3, 'inspection does not prevent');
  const outcomes = new Set(Object.values(COUNTERMEASURES).map((c) => c.outcome));
  assert.equal(outcomes.size, 4);
});

test('kaizen model: best layout cuts walking; problem-shifting cards raise downstream defects', async () => {
  const { cellMetrics } = await import('../../web/js/levels/level6.js');
  const base = cellMetrics({ bead: 'P4', carrier: 'P5', tools: 'P3' }, new Set());
  const best = cellMetrics({ bead: 'P1', carrier: 'P2', tools: 'P3' }, new Set(['shadow', 'std', 'lift']));
  assert.ok(best.walk < base.walk / 4);
  assert.ok(best.cycle < base.cycle);
  assert.ok(best.downstream < base.downstream);
  const shifted = cellMetrics({ bead: 'P4', carrier: 'P5', tools: 'P3' }, new Set(['nosplice']));
  assert.ok(shifted.cycle < base.cycle, 'looks faster locally');
  assert.equal(shifted.downstream, base.downstream * 2, 'but doubles downstream defects');
});

test('final challenge priority scoring', async () => {
  const { priorityScore } = await import('../../web/js/levels/final.js');
  assert.equal(priorityScore(['complaint', 'press7', 'splice', 'kaizen']), 20);
  assert.equal(priorityScore(['press7', 'complaint', 'splice', 'kaizen']), 20);
  assert.equal(priorityScore(['kaizen', 'splice', 'press7', 'complaint']), 0);
});

test('customer meters improve with better handling', async () => {
  const { customerMeters } = await import('../../web/js/levels/level5.js');
  const good = customerMeters({ review: 1, escalate: 1, team: 1, trace: 1, actions: 1 });
  const poor = customerMeters({ review: 0.2, escalate: 0, team: 0.3, trace: 0.2, actions: 0.2 });
  assert.ok(good.confidence > poor.confidence);
  assert.ok(good.recurrence < poor.recurrence);
  assert.ok(good.confidence <= 100 && good.recurrence >= 0);
});

test('every level task points at a real station and valid prerequisites', async () => {
  const { LEVELS } = await import('../../web/js/levels/index.js');
  const { stationById } = await import('../../web/js/world.js');
  assert.equal(LEVELS.length, 8);
  for (const lv of LEVELS) {
    const ids = new Set(lv.tasks.map((t) => t.id));
    for (const t of lv.tasks) {
      assert.ok(stationById[t.station], `${lv.id}/${t.id} station ${t.station}`);
      (t.requires || []).forEach((r) => assert.ok(ids.has(r), `${lv.id}/${t.id} requires ${r}`));
      assert.equal(typeof t.run, 'function');
    }
  }
});
