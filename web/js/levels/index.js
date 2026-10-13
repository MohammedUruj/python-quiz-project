import { level as tutorial } from './tutorial.js';
import { level as l1 } from './level1.js';
import { level as l2 } from './level2.js';
import { level as l3 } from './level3.js';
import { level as l4 } from './level4.js';
import { level as l5 } from './level5.js';
import { level as l6 } from './level6.js';
import { level as final } from './final.js';

export const LEVELS = [tutorial, l1, l2, l3, l4, l5, l6, final];
export const levelById = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

export const ALL_BADGES = [
  { name: 'Defect Detective', desc: 'Complete Level 1' },
  { name: 'Pareto Pro', desc: 'Complete Level 2' },
  { name: 'Root Cause Investigator', desc: 'Complete Level 3' },
  { name: 'PDCA Master', desc: 'Complete Level 4' },
  { name: 'Customer Champion', desc: 'Complete Level 5' },
  { name: 'Kaizen Innovator', desc: 'Complete Level 6' },
  { name: 'Quality Champion', desc: 'Reach the top band in the final assessment' },
];
