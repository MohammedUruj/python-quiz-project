// Original SVG artwork generated in code: tyres, character portraits and avatars.

let uid = 0;

/**
 * Side view of a tyre. defect: none | blister | bulge | crack | chunk | flash | foreign
 */
export function tyreSVG(defect = 'none', { size = 140, label = '' } = {}) {
  const id = `ty${uid++}`;
  const blocks = [];
  const n = 36;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360;
    const missing = defect === 'chunk' && i >= 4 && i <= 6;
    blocks.push(`<rect x="-3.6" y="-49" width="7.2" height="7" rx="1" transform="rotate(${a})" fill="${missing ? '#6b6b6b' : '#1a1b1e'}" />`);
  }
  let d = '';
  switch (defect) {
    case 'blister':
      d = `<ellipse cx="-22" cy="-20" rx="6" ry="4.5" fill="#3d4047" stroke="#5d626b" stroke-width="1"/><ellipse cx="-23.5" cy="-21.5" rx="2.2" ry="1.4" fill="#7a808a"/>`;
      break;
    case 'bulge':
      d = `<path d="M 22 -30 Q 44 -28 37 -6 Q 30 -14 22 -30 Z" fill="#3a3d44" stroke="#666b74" stroke-width="1"/><path d="M 27 -25 Q 36 -22 34 -12" stroke="#8a9099" stroke-width="1.6" fill="none"/>`;
      break;
    case 'crack':
      d = `<path d="M -30 12 l 4 -3 l 3 4 l 4 -4 l 3 3 l 4 -3 l 3 4" stroke="#9aa0a8" stroke-width="1.3" fill="none"/><path d="M -28 20 l 4 -2 l 3 3 l 4 -3 l 3 2" stroke="#9aa0a8" stroke-width="1.1" fill="none"/>`;
      break;
    case 'flash': {
      let spikes = '';
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const x1 = Math.cos(a) * 49; const y1 = Math.sin(a) * 49;
        const x2 = Math.cos(a) * 54; const y2 = Math.sin(a) * 54;
        spikes += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#2a2b2f" stroke-width="1.4" stroke-linecap="round"/>`;
      }
      d = spikes;
      break;
    }
    case 'foreign':
      d = `<circle cx="18" cy="24" r="2.6" fill="#d9b44a"/><circle cx="18" cy="24" r="4.6" fill="none" stroke="#d9b44a" stroke-opacity=".35"/>`;
      break;
    default:
      d = '';
  }
  const ring = defect === 'chunk' ? `<path d="M 31 -37 L 39 -29" stroke="#8d8d8d" stroke-width="3"/>` : '';
  return `<svg class="tyre-svg" width="${size}" height="${size}" viewBox="-60 -60 120 120" role="img" aria-label="${label || 'tyre'}">
  <defs><radialGradient id="${id}g" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#4a4e56"/><stop offset=".6" stop-color="#2b2d32"/><stop offset="1" stop-color="#1b1c1f"/></radialGradient>
  <path id="${id}p" d="M -33 0 A 33 33 0 0 1 33 0"/></defs>
  <circle r="50" fill="#141518"/>
  ${blocks.join('')}
  <circle r="42" fill="url(#${id}g)"/>
  <circle r="34" fill="none" stroke="#3b3e45" stroke-width="1"/>
  <text font-size="6.5" fill="#8b919b" font-family="Arial, sans-serif" letter-spacing="1"><textPath href="#${id}p" startOffset="50%" text-anchor="middle">QUALITRAX 205/55 R16</textPath></text>
  <circle r="22" fill="#b9bec6"/><circle r="22" fill="none" stroke="#7d838c" stroke-width="2"/>
  <circle r="7" fill="#7d838c"/>
  ${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(Math.cos((a * Math.PI) / 180) * 13).toFixed(1)}" cy="${(Math.sin((a * Math.PI) / 180) * 13).toFixed(1)}" r="2" fill="#5b6068"/>`).join('')}
  ${ring}${d}
</svg>`;
}

/** Character appearance presets used for NPCs and selectable player avatars. */
export const AVATARS = [
  { id: 'a1', skin: '#8d5524', hair: '#1b1b1b', style: 'short', hat: '#f2f2f2', coat: '#2c5d8f', label: 'Engineer (white hard hat, blue coverall)' },
  { id: 'a2', skin: '#f1c27d', hair: '#6b3e1e', style: 'bun', hat: '#f2f2f2', coat: '#3c6e47', label: 'Engineer (white hard hat, green coverall)' },
  { id: 'a3', skin: '#c68642', hair: '#2b1d14', style: 'long', hat: '#f2f2f2', coat: '#5b4a8a', label: 'Engineer (white hard hat, purple coverall)' },
  { id: 'a4', skin: '#e0ac69', hair: '#9a9a9a', style: 'short', hat: '#f2f2f2', coat: '#8a4b2c', label: 'Engineer (white hard hat, rust coverall)' },
];

export const NPCS = {
  manager: { name: 'Elena Marsh', role: 'Plant Manager', skin: '#f1c27d', hair: '#4a2f1b', style: 'bun', hat: '#2d6cdf', coat: '#30343b' },
  supervisor: { name: 'Rajesh Kumar', role: 'Production Supervisor', skin: '#a8703f', hair: '#151515', style: 'short', hat: '#f0b429', coat: '#3b4a5a' },
  operator: { name: 'Tomás Rivera', role: 'Curing Press Operator', skin: '#c68642', hair: '#2b1d14', style: 'short', hat: '#f0b429', coat: '#28507a' },
  inspector: { name: 'Mei Lin', role: 'Quality Inspector', skin: '#f3d3a7', hair: '#121212', style: 'long', hat: '#2bb673', coat: '#2f6b4f' },
  maintenance: { name: 'Kwame Mensah', role: 'Maintenance Technician', skin: '#6b4423', hair: '#111', style: 'short', hat: '#e4572e', coat: '#5c3d2e' },
  lab: { name: 'Dr. Sara Haddad', role: 'Quality Lab Lead', skin: '#d8a477', hair: '#3a2416', style: 'long', hat: '#2bb673', coat: '#e9eef3' },
  customer: { name: 'Jonas Berg', role: 'Customer Quality Engineer', skin: '#f6d5b8', hair: '#c9a26b', style: 'short', hat: null, coat: '#31476b' },
  builder: { name: 'Aisha Bello', role: 'Tyre Builder', skin: '#7a4b2a', hair: '#141414', style: 'bun', hat: '#f0b429', coat: '#28507a' },
};

export function portraitSVG(p, size = 72) {
  const hair = {
    short: `<path d="M -15 -8 Q -16 -24 0 -25 Q 16 -24 15 -8 Q 10 -16 0 -16 Q -10 -16 -15 -8 Z" fill="${p.hair}"/>`,
    bun: `<circle cx="0" cy="-27" r="6" fill="${p.hair}"/><path d="M -15 -6 Q -16 -24 0 -24 Q 16 -24 15 -6 Q 11 -15 0 -15 Q -11 -15 -15 -6 Z" fill="${p.hair}"/>`,
    long: `<path d="M -16 10 Q -19 -24 0 -25 Q 19 -24 16 10 L 11 10 Q 12 -12 0 -14 Q -12 -12 -11 10 Z" fill="${p.hair}"/>`,
  }[p.style || 'short'];
  const hat = p.hat ? `<path d="M -17 -12 Q -16 -30 0 -30 Q 16 -30 17 -12 Z" fill="${p.hat}"/><rect x="-20" y="-14" width="40" height="4" rx="2" fill="${p.hat}"/><rect x="-2" y="-30" width="4" height="17" fill="#000" opacity=".08"/>` : '';
  return `<svg class="portrait" width="${size}" height="${size}" viewBox="-36 -36 72 72" aria-hidden="true">
  <circle r="35" fill="#1d2733"/>
  <path d="M -26 36 Q -24 14 0 13 Q 24 14 26 36 Z" fill="${p.coat}"/>
  <path d="M -24 30 L 24 30" stroke="#d9e021" stroke-width="3" opacity=".85"/>
  <rect x="-5" y="6" width="10" height="9" fill="${p.skin}"/>
  ${p.style === 'long' ? hair : ''}
  <ellipse cx="0" cy="-5" rx="14" ry="16" fill="${p.skin}"/>
  ${p.style !== 'long' ? hair : ''}
  <circle cx="-5" cy="-5" r="1.6" fill="#1b1b1b"/><circle cx="5" cy="-5" r="1.6" fill="#1b1b1b"/>
  <path d="M -4 4 Q 0 7 4 4" stroke="#5a3a2a" stroke-width="1.3" fill="none"/>
  ${hat}
</svg>`;
}
