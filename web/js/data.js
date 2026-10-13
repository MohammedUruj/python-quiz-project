// Fictional datasets used by the levels. All numbers are invented for training purposes.

import { normalSeries } from './stats.js';

export const DEFECT_DATASETS = {
  sep_all: {
    label: 'September, all curing lines',
    rows: [
      { label: 'Light / undercure spot', value: 64 },
      { label: 'Tread splice open', value: 51 },
      { label: 'Blister', value: 182 },
      { label: 'Bead area defect', value: 38 },
      { label: 'Flash / trim excess', value: 27 },
      { label: 'Dimension out of tol.', value: 22 },
      { label: 'Foreign material', value: 14 },
      { label: 'Other', value: 10 },
    ],
  },
  aug_all: {
    label: 'August, all curing lines',
    rows: [
      { label: 'Light / undercure spot', value: 58 },
      { label: 'Tread splice open', value: 55 },
      { label: 'Blister', value: 72 },
      { label: 'Bead area defect', value: 41 },
      { label: 'Flash / trim excess', value: 30 },
      { label: 'Dimension out of tol.', value: 25 },
      { label: 'Foreign material', value: 15 },
      { label: 'Other', value: 12 },
    ],
  },
  sep_lineA: {
    label: 'September, curing line A only',
    rows: [
      { label: 'Light / undercure spot', value: 35 },
      { label: 'Tread splice open', value: 33 },
      { label: 'Blister', value: 41 },
      { label: 'Bead area defect', value: 26 },
      { label: 'Flash / trim excess', value: 18 },
      { label: 'Dimension out of tol.', value: 16 },
      { label: 'Foreign material', value: 10 },
      { label: 'Other', value: 7 },
    ],
  },
};

// Line B = all minus line A (kept consistent by construction).
DEFECT_DATASETS.sep_lineB = {
  label: 'September, curing line B only',
  rows: DEFECT_DATASETS.sep_all.rows.map((r, i) => ({ label: r.label, value: r.value - DEFECT_DATASETS.sep_lineA.rows[i].value })),
};

/** Inspection records for the interactive, stratified check sheet. */
export const CHECK_RECORDS = [
  ['T-2301', 'Press 4', 'A', 'Blister'], ['T-2302', 'Press 3', 'B', 'Splice open'], ['T-2303', 'Press 4', 'C', 'Blister'],
  ['T-2304', 'Press 5', 'A', 'Light spot'], ['T-2305', 'Press 4', 'B', 'Blister'], ['T-2306', 'Press 4', 'A', 'Blister'],
  ['T-2307', 'Press 3', 'C', 'Bead area'], ['T-2308', 'Press 4', 'C', 'Blister'], ['T-2309', 'Press 5', 'B', 'Splice open'],
  ['T-2310', 'Press 4', 'B', 'Light spot'], ['T-2311', 'Press 4', 'A', 'Blister'], ['T-2312', 'Press 3', 'A', 'Blister'],
  ['T-2313', 'Press 4', 'C', 'Blister'], ['T-2314', 'Press 5', 'C', 'Other'], ['T-2315', 'Press 4', 'B', 'Blister'],
  ['T-2316', 'Press 3', 'B', 'Light spot'], ['T-2317', 'Press 4', 'A', 'Splice open'], ['T-2318', 'Press 4', 'C', 'Blister'],
  ['T-2319', 'Press 5', 'A', 'Bead area'], ['T-2320', 'Press 4', 'B', 'Blister'], ['T-2321', 'Press 3', 'C', 'Other'],
  ['T-2322', 'Press 4', 'A', 'Blister'], ['T-2323', 'Press 5', 'B', 'Blister'], ['T-2324', 'Press 4', 'C', 'Light spot'],
].map(([id, press, shift, defect]) => ({ id, press, shift, defect }));

export const CHECK_PRESSES = ['Press 3', 'Press 4', 'Press 5'];
export const CHECK_DEFECTS = ['Blister', 'Light spot', 'Splice open', 'Bead area', 'Other'];

/**
 * Process measurement datasets for the histogram / control chart explorer.
 * Seeds are fixed so every participant sees identical data; properties are asserted in tests.
 */
export const PROCESS_DATA = {
  tread: {
    label: 'Tread width, extruder line 2 (mm)',
    unit: 'mm',
    values: normalSeries(20240917, 50, 210.6, 0.55),
    lsl: 208, usl: 212,
    binStart: 208.4, binWidth: 0.4, bins: 9,
    baseline: 50,
    note: 'Specification 210.0 ± 2.0 mm. Fifty consecutive treads, in production order.',
  },
  pressure: {
    label: 'Press 4 bladder pressure during cure hold (bar)',
    unit: 'bar',
    values: [...normalSeries(4401, 20, 15.2, 0.15), ...normalSeries(4402, 12, 14.45, 0.18)],
    lsl: 14.0, usl: null,
    binStart: 14.0, binWidth: 0.15, bins: 10,
    baseline: 20,
    note: 'Minimum pressure 14.0 bar (one-sided specification). One reading per cure cycle sample, in time order. Control limits use the first 20 samples.',
  },
};

/** Humidity vs blister rate (weekly) - correlation that is NOT the cause in the Level 3 story. */
export const HUMIDITY_SCATTER = [
  [48, 1.9], [51, 2.2], [55, 2.0], [58, 2.6], [61, 3.9], [63, 4.6], [66, 5.8], [70, 6.1], [68, 6.4], [72, 6.0],
];
