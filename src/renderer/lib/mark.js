// The mascot's body: one silhouette plus two eye shapes clipped to it. No mouth
// and no outline — the whole character reads through eye geometry and body
// language, which is what keeps the silhouette this clean.
//
// The fill may be flat or a three-stop gradient. That is the one concession, and
// it is a safe one: a gradient changes what the shape is painted with, never
// what the shape is, so the silhouette stays exactly as readable.

import DATA from '../../shared/mascot-data.js';
import { ringPath, centroid, clamp } from './geom.js';
import { gradientVector } from '../../shared/themes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HEAD_C = DATA.HEAD_C;

export const SHAPE_KEYS = Object.keys(DATA.shapes);
export const SHAPE_LABELS = Object.fromEntries(SHAPE_KEYS.map((k) => [k, DATA.shapes[k].label]));
export const EXPRESSION_COUNT = DATA.expressions.length;

const el = (name, attrs) => {
  const n = document.createElementNS(SVG_NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

let clipSeq = 0;

// Where the neutral face's eyes actually are, read from the art rather than
// copied into a constant that can drift out of date under it. Anything worn on
// the eye line is placed from this.
const EYE_HOME = DATA.expressions[10].map((ring) => centroid(ring));
const EYE_SPAN = EYE_HOME[1][0] - EYE_HOME[0][0];
const EYE_MID_Y = (EYE_HOME[0][1] + EYE_HOME[1][1]) / 2;

// What it can wear. Everything is authored in the shared viewBox, which only
// allows 15 units of headroom above the crown — so hats rest ON the head and
// lean off to one side rather than towering over it, which is the only way they
// fit without changing the viewBox for every shape.
//
// Nothing here uses fixed coordinates any more, because the five bodies have
// very different crowns: a square is 210 units across where a wedge is 67, and a
// cloud's crown sits 22 units lower than a circle's. One set of numbers fits
// exactly one of them, so every piece is authored against this fit instead.
function fitFor(shape, face) {
  const s = shape.spans;
  const n = s.length;
  const top = s[0][0];
  const [hatY, hatL, hatR] = s[Math.round(n * 0.12)];
  const [browY, browL, browR] = s[Math.round(n * 0.22)];
  const [chinY, chinL, chinR] = s[Math.round(n * 0.82)];
  return {
    face,
    cx: HEAD_C,
    top,
    // The ceiling. Two units inside the viewBox edge, so nothing worn is ever
    // clipped off the top no matter which body it is sitting on.
    sky: Math.max(-13, top - 15),
    hatY, hatL, hatR, hatW: hatR - hatL,
    browY, browL, browR, browW: browR - browL,
    chinY, chinL, chinR, chinW: chinR - chinL,
    eyeL: EYE_HOME[0],
    eyeR: EYE_HOME[1],
    eyeSpan: EYE_SPAN,
    eyeY: EYE_MID_Y,
  };
}

const n1 = (v) => Number(v).toFixed(1);

export const ACCESSORIES = {
  // The three that shipped first, re-cut onto the fit so they sit on a wedge and
  // a cloud as well as they ever sat on the old round body.
  santa: (k) => `
    <path d="M${n1(k.hatL)} ${n1(k.hatY + 12)} C${n1(k.cx - k.hatW * 0.24)} ${n1(k.sky + 4)}
             ${n1(k.cx + k.hatW * 0.3)} ${n1(k.sky - 1)} ${n1(k.hatR + 10)} ${n1(k.sky + 6)}
             L${n1(k.hatR - 4)} ${n1(k.hatY + 20)} C${n1(k.cx + k.hatW * 0.16)} ${n1(k.hatY + 12)}
             ${n1(k.cx - k.hatW * 0.24)} ${n1(k.hatY + 14)} ${n1(k.hatL + 4)} ${n1(k.hatY + 26)} Z" fill="#c0392b"/>
    <rect x="${n1(k.hatL - 8)}" y="${n1(k.hatY + 8)}" width="${n1(k.hatW + 16)}" height="22" rx="11" fill="#f7f7f7"/>
    <circle cx="${n1(k.hatR + 12)}" cy="${n1(k.sky + 6)}" r="13" fill="#f7f7f7"/>`,
  witch: (k) => {
    const w = Math.min(k.hatW * 0.5, 84);
    return `
    <ellipse cx="${n1(k.cx)}" cy="${n1(k.hatY + 16)}" rx="${n1(Math.min(k.hatW * 0.66, 92))}" ry="14" fill="#2f2b3d"/>
    <path d="M${n1(k.cx - w * 0.5)} ${n1(k.hatY + 16)} C${n1(k.cx - w * 0.34)} ${n1(k.sky + 14)}
             ${n1(k.cx + w * 0.12)} ${n1(k.sky + 4)} ${n1(k.cx + w * 0.3)} ${n1(k.sky - 2)}
             L${n1(k.cx + w * 0.62)} ${n1(k.hatY + 16)} Z" fill="#2f2b3d"/>
    <rect x="${n1(k.cx - w * 0.46)}" y="${n1(k.hatY + 3)}" width="${n1(w * 1)}" height="12" rx="6"
          fill="#8f7ae6" transform="rotate(-7 ${n1(k.cx)} ${n1(k.hatY + 9)})"/>`;
  },
  party: (k) => `
    <path d="M${n1(k.cx - k.hatW * 0.18)} ${n1(k.hatY + 14)} L${n1(k.cx + k.hatW * 0.06)} ${n1(k.sky + 2)}
             L${n1(k.cx + k.hatW * 0.3)} ${n1(k.hatY + 18)} Z" fill="#f2a03d"/>
    <path d="M${n1(k.cx - k.hatW * 0.08)} ${n1(k.hatY + 2)} L${n1(k.cx + k.hatW * 0.12)} ${n1(k.hatY - 5)}
             L${n1(k.cx + k.hatW * 0.16)} ${n1(k.hatY + 4)} L${n1(k.cx - k.hatW * 0.04)} ${n1(k.hatY + 11)} Z" fill="#e4576a"/>
    <circle cx="${n1(k.cx + k.hatW * 0.06)}" cy="${n1(k.sky)}" r="9" fill="#5ec9a8"/>`,
  // Anything on the eye line takes the same per-shape face fit the eyes do, so
  // it lands on the eyes rather than near them.
  shades: (k) => eyewear(k, '#1c1c22', '#1c1c22', 0.34),
  glasses: (k) => eyewear(k, 'none', '#3b3b46', 0.5, 5),
  monocle: (k) => {
    const [rx, ry] = onFace(k, k.eyeR);
    const r = 30 * k.face.eye;
    return `<circle cx="${n1(rx)}" cy="${n1(ry)}" r="${n1(r)}" fill="none" stroke="#d8b45a" stroke-width="5"/>
      <path d="M${n1(rx)} ${n1(ry + r)} L${n1(rx - 6)} ${n1(ry + r + 34)}" stroke="#d8b45a" stroke-width="3" fill="none"/>`;
  },
  eyepatch: (k) => {
    const [lx, ly] = onFace(k, k.eyeL);
    const w = 58 * k.face.eye;
    return `<path d="M${n1(k.hatL - 4)} ${n1(k.hatY + 4)} L${n1(k.hatR + 4)} ${n1(k.hatY - 6)}"
              stroke="#26262e" stroke-width="6" fill="none"/>
      <rect x="${n1(lx - w / 2)}" y="${n1(ly - w * 0.42)}" width="${n1(w)}" height="${n1(w * 0.84)}"
            rx="${n1(w * 0.22)}" fill="#26262e"/>`;
  },
  mask: (k) => {
    const [lx, ly] = onFace(k, k.eyeL);
    const [rx, ry] = onFace(k, k.eyeR);
    const pad = 40 * k.face.eye;
    return `<path d="M${n1(lx - pad)} ${n1(ly - pad * 0.72)}
      Q${n1(k.cx)} ${n1((ly + ry) / 2 - pad * 1.05)} ${n1(rx + pad)} ${n1(ry - pad * 0.72)}
      L${n1(rx + pad * 0.8)} ${n1(ry + pad * 0.66)}
      Q${n1(k.cx)} ${n1((ly + ry) / 2 + pad * 0.2)} ${n1(lx - pad * 0.8)} ${n1(ly + pad * 0.66)} Z"
      fill="#2b2f7a" opacity="0.92"/>`;
  },

  // ---- hair ----
  bangs: (k) => hair(k, '#3b2f2a', `M${n1(k.hatL)} ${n1(k.hatY + 6)}
    Q${n1(k.cx)} ${n1(k.sky)} ${n1(k.hatR)} ${n1(k.hatY + 6)}
    L${n1(k.hatR - 6)} ${n1(k.browY + 6)}
    Q${n1(k.cx + k.hatW * 0.16)} ${n1(k.browY - 12)} ${n1(k.cx - k.hatW * 0.04)} ${n1(k.browY + 10)}
    Q${n1(k.cx - k.hatW * 0.26)} ${n1(k.browY - 8)} ${n1(k.hatL + 6)} ${n1(k.browY + 4)} Z`),
  sideSwept: (k) => hair(k, '#c8973f', `M${n1(k.hatL + 2)} ${n1(k.hatY + 10)}
    Q${n1(k.cx - k.hatW * 0.1)} ${n1(k.sky)} ${n1(k.hatR)} ${n1(k.hatY + 2)}
    Q${n1(k.hatR - k.hatW * 0.1)} ${n1(k.browY + 14)} ${n1(k.cx + k.hatW * 0.06)} ${n1(k.browY + 2)}
    Q${n1(k.cx - k.hatW * 0.2)} ${n1(k.browY + 18)} ${n1(k.hatL + 2)} ${n1(k.browY - 2)} Z`),
  curls: (k) => {
    const r = Math.max(15, k.hatW * 0.13);
    const y = Math.max(k.sky + r * 0.7, k.hatY - r * 0.2);
    return hair(k, '#2f2a33', dome(k, k.hatY + 20),
      [-2.1, -1.1, 0, 1.1, 2.1].map((o, i) =>
        `<circle cx="${n1(k.cx + o * r * 0.95)}" cy="${n1(y + (i % 2 ? r * 0.4 : 0))}" r="${n1(r)}"/>`).join(''));
  },
  afro: (k) => {
    const w = Math.max(70, k.hatW * 0.62);
    return hair(k, '#4a3a30', `M${n1(k.cx - w)} ${n1(k.hatY + 12)}
      Q${n1(k.cx - w * 1.02)} ${n1(k.sky)} ${n1(k.cx)} ${n1(k.sky - 1)}
      Q${n1(k.cx + w * 1.02)} ${n1(k.sky)} ${n1(k.cx + w)} ${n1(k.hatY + 12)}
      Q${n1(k.cx)} ${n1(k.hatY - 6)} ${n1(k.cx - w)} ${n1(k.hatY + 12)} Z`);
  },
  mohawk: (k) => {
    const h = k.hatY - k.sky;
    const spikes = [-2, -1, 0, 1, 2].map((o) => {
      const x = k.cx + o * Math.max(9, k.hatW * 0.075);
      const t = k.sky + Math.abs(o) * h * 0.22;
      return `M${n1(x - 9)} ${n1(k.hatY + 14)} L${n1(x)} ${n1(t)} L${n1(x + 9)} ${n1(k.hatY + 14)} Z`;
    }).join('');
    return hair(k, '#e0524d', spikes);
  },
  bun: (k) => {
    const r = Math.max(15, k.hatW * 0.12);
    const y = Math.max(k.sky + r * 0.6, k.hatY - r * 0.5);
    return hair(k, '#5c4033', dome(k, k.hatY + 22),
    `<circle cx="${n1(k.cx)}" cy="${n1(y)}" r="${n1(r)}"/>
     <circle cx="${n1(k.cx)}" cy="${n1(y)}" r="${n1(r * 0.52)}" fill="#6f4d3e"/>`);
  },
  ponytail: (k) => hair(k, '#8a5a3c', dome(k, k.hatY + 20),
  `<path d="M${n1(k.hatR - 10)} ${n1(k.hatY + 6)}
     Q${n1(k.chinR + 16)} ${n1(k.browY + 30)} ${n1(k.chinR - 4)} ${n1(k.chinY - 10)}
     Q${n1(k.chinR - 26)} ${n1(k.browY + 40)} ${n1(k.hatR - 22)} ${n1(k.hatY + 16)} Z"/>`),
  braids: (k) => hair(k, '#c8973f', dome(k, k.hatY + 20),
  [[k.browL - 2, -1], [k.browR + 2, 1]].map(([x, s]) => `
    <path d="M${n1(x)} ${n1(k.browY - 6)}
      Q${n1(x + s * 16)} ${n1(k.browY + 34)} ${n1(x + s * 4)} ${n1(k.chinY - 16)}
      Q${n1(x - s * 12)} ${n1(k.browY + 30)} ${n1(x - s * 6)} ${n1(k.browY - 2)} Z"/>`).join('')),
  longHair: (k) => hair(k, '#2f2a33', dome(k, k.browY - 4),
  `<path d="M${n1(k.browL + 4)} ${n1(k.browY - 14)}
     Q${n1(k.chinL - 6)} ${n1(k.browY + 40)} ${n1(k.chinL + 10)} ${n1(k.chinY)}
     L${n1(k.browL + 24)} ${n1(k.chinY - 6)} Z"/>
   <path d="M${n1(k.browR - 4)} ${n1(k.browY - 14)}
     Q${n1(k.chinR + 6)} ${n1(k.browY + 40)} ${n1(k.chinR - 10)} ${n1(k.chinY)}
     L${n1(k.browR - 24)} ${n1(k.chinY - 6)} Z"/>`),

  // ---- hats ----
  beanie: (k) => `
    <path d="M${n1(k.hatL - 2)} ${n1(k.hatY + 8)} Q${n1(k.cx)} ${n1(k.sky + 2)} ${n1(k.hatR + 2)} ${n1(k.hatY + 8)} Z" fill="#4757c4"/>
    <rect x="${n1(k.hatL - 6)}" y="${n1(k.hatY)}" width="${n1(k.hatW + 12)}" height="17" rx="8.5" fill="#5b6ee1"/>
    <circle cx="${n1(k.cx)}" cy="${n1(k.sky + 6)}" r="9" fill="#f7f7f7"/>`,
  cap: (k) => `
    <path d="M${n1(k.hatL + 2)} ${n1(k.hatY + 6)} Q${n1(k.cx)} ${n1(k.sky)} ${n1(k.hatR - 2)} ${n1(k.hatY + 6)} Z" fill="#2f7ad6"/>
    <path d="M${n1(k.cx - 6)} ${n1(k.hatY + 4)} L${n1(k.hatR + 34)} ${n1(k.hatY + 2)}
             Q${n1(k.hatR + 42)} ${n1(k.hatY + 12)} ${n1(k.hatR + 30)} ${n1(k.hatY + 16)}
             L${n1(k.cx - 4)} ${n1(k.hatY + 16)} Z" fill="#25619f"/>
    <circle cx="${n1(k.cx)}" cy="${n1(k.sky + 5)}" r="6" fill="#25619f"/>`,
  tophat: (k) => {
    const w = Math.min(k.hatW * 0.72, 116);
    return `
    <rect x="${n1(k.cx - w / 2 - 16)}" y="${n1(k.hatY + 2)}" width="${n1(w + 32)}" height="12" rx="6" fill="#1f1f27"/>
    <rect x="${n1(k.cx - w / 2)}" y="${n1(k.sky)}" width="${n1(w)}" height="${n1(k.hatY + 4 - k.sky)}" rx="4" fill="#26262e"/>
    <rect x="${n1(k.cx - w / 2)}" y="${n1(k.hatY - 8)}" width="${n1(w)}" height="9" fill="#b8434b"/>`;
  },
  crown: (k) => {
    const w = Math.min(k.hatW * 0.66, 112);
    const l = k.cx - w / 2;
    const r = k.cx + w / 2;
    return `
    <path d="M${n1(l)} ${n1(k.hatY + 10)} L${n1(l)} ${n1(k.sky + 8)} L${n1(l + w * 0.25)} ${n1(k.hatY - 6)}
             L${n1(k.cx)} ${n1(k.sky)} L${n1(r - w * 0.25)} ${n1(k.hatY - 6)} L${n1(r)} ${n1(k.sky + 8)}
             L${n1(r)} ${n1(k.hatY + 10)} Z" fill="${DATA.STAR_GOLD}"/>
    <circle cx="${n1(k.cx)}" cy="${n1(k.sky + 4)}" r="5" fill="#e4576a"/>`;
  },
  graduate: (k) => {
    const w = Math.min(k.hatW * 0.9, 150);
    return `
    <path d="M${n1(k.cx - w * 0.32)} ${n1(k.hatY + 4)} Q${n1(k.cx)} ${n1(k.sky + 10)} ${n1(k.cx + w * 0.32)} ${n1(k.hatY + 4)} Z" fill="#2b2b33"/>
    <path d="M${n1(k.cx)} ${n1(k.sky)} L${n1(k.cx + w / 2)} ${n1(k.sky + 12)} L${n1(k.cx)} ${n1(k.sky + 24)}
             L${n1(k.cx - w / 2)} ${n1(k.sky + 12)} Z" fill="#1f1f27"/>
    <path d="M${n1(k.cx + w * 0.34)} ${n1(k.sky + 16)} L${n1(k.cx + w * 0.42)} ${n1(k.hatY + 20)}"
          stroke="${DATA.STAR_GOLD}" stroke-width="3.5" fill="none"/>
    <circle cx="${n1(k.cx + w * 0.42)}" cy="${n1(k.hatY + 24)}" r="5" fill="${DATA.STAR_GOLD}"/>`;
  },
  chef: (k) => {
    const w = Math.min(k.hatW * 0.6, 100);
    return `
    <rect x="${n1(k.cx - w / 2)}" y="${n1(k.hatY - 4)}" width="${n1(w)}" height="16" rx="4" fill="#f2f2ef"/>
    <path d="M${n1(k.cx - w / 2)} ${n1(k.hatY - 2)} Q${n1(k.cx - w * 0.62)} ${n1(k.sky)} ${n1(k.cx - w * 0.2)} ${n1(k.sky + 2)}
             Q${n1(k.cx)} ${n1(k.sky - 2)} ${n1(k.cx + w * 0.2)} ${n1(k.sky + 2)}
             Q${n1(k.cx + w * 0.62)} ${n1(k.sky)} ${n1(k.cx + w / 2)} ${n1(k.hatY - 2)} Z" fill="#fbfbf9"/>`;
  },
  cowboy: (k) => `
    <path d="M${n1(k.hatL - 26)} ${n1(k.hatY + 10)} Q${n1(k.cx)} ${n1(k.hatY - 12)} ${n1(k.hatR + 26)} ${n1(k.hatY + 10)}
             Q${n1(k.cx)} ${n1(k.hatY + 26)} ${n1(k.hatL - 26)} ${n1(k.hatY + 10)} Z" fill="#8a5a3c"/>
    <path d="M${n1(k.cx - k.hatW * 0.22)} ${n1(k.hatY + 8)} Q${n1(k.cx)} ${n1(k.sky)} ${n1(k.cx + k.hatW * 0.22)} ${n1(k.hatY + 8)} Z" fill="#6f452c"/>
    <rect x="${n1(k.cx - k.hatW * 0.24)}" y="${n1(k.hatY - 2)}" width="${n1(k.hatW * 0.48)}" height="7" fill="#3f2a1c"/>`,
  headband: (k) => `
    <rect x="${n1(k.hatL - 4)}" y="${n1(k.hatY + 2)}" width="${n1(k.hatW + 8)}" height="15" rx="7.5" fill="#e0524d"/>
    <rect x="${n1(k.cx - 16)}" y="${n1(k.hatY + 2)}" width="32" height="15" fill="#f7f7f7"/>`,
  flower: (k) => {
    const cx = k.cx + Math.min(k.hatW * 0.28, 52);
    const cy = k.hatY + 4;
    return `<g>${[0, 72, 144, 216, 288].map((a) =>
      `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="13" ry="21" transform="rotate(${a} ${n1(cx)} ${n1(cy)})" fill="#f08bb0"/>`).join('')}
      <circle cx="${n1(cx)}" cy="${n1(cy)}" r="10" fill="${DATA.STAR_GOLD}"/></g>`;
  },
  bow: (k) => {
    const cx = k.cx + k.hatW * 0.26;
    const cy = k.hatY + 2;
    return `
    <path d="M${n1(cx)} ${n1(cy)} L${n1(cx - 30)} ${n1(cy - 15)} L${n1(cx - 30)} ${n1(cy + 15)} Z" fill="#e4576a"/>
    <path d="M${n1(cx)} ${n1(cy)} L${n1(cx + 30)} ${n1(cy - 15)} L${n1(cx + 30)} ${n1(cy + 15)} Z" fill="#e4576a"/>
    <circle cx="${n1(cx)}" cy="${n1(cy)}" r="8" fill="#c93f52"/>`;
  },
  halo: (k) => `
    <ellipse cx="${n1(k.cx)}" cy="${n1(k.sky + 4)}" rx="${n1(Math.min(k.hatW * 0.34, 58))}" ry="9"
             fill="none" stroke="${DATA.STAR_GOLD}" stroke-width="6"/>`,
  horns: (k) => `
    <path d="M${n1(k.cx - k.hatW * 0.26)} ${n1(k.hatY + 8)} Q${n1(k.cx - k.hatW * 0.34)} ${n1(k.sky)} ${n1(k.cx - k.hatW * 0.1)} ${n1(k.hatY + 2)} Z" fill="#c0392b"/>
    <path d="M${n1(k.cx + k.hatW * 0.26)} ${n1(k.hatY + 8)} Q${n1(k.cx + k.hatW * 0.34)} ${n1(k.sky)} ${n1(k.cx + k.hatW * 0.1)} ${n1(k.hatY + 2)} Z" fill="#c0392b"/>`,
  antenna: (k) => `
    <path d="M${n1(k.cx)} ${n1(k.hatY + 6)} Q${n1(k.cx + 12)} ${n1(k.sky + 12)} ${n1(k.cx + 4)} ${n1(k.sky + 2)}"
          stroke="#5ec9a8" stroke-width="4" fill="none"/>
    <circle cx="${n1(k.cx + 4)}" cy="${n1(k.sky)}" r="7" fill="#5ec9a8"/>`,

  // ---- worn elsewhere ----
  headphones: (k) => `
    <path d="M${n1(k.browL - 4)} ${n1(k.browY + 10)} Q${n1(k.cx)} ${n1(k.sky + 2)} ${n1(k.browR + 4)} ${n1(k.browY + 10)}"
          stroke="#3b3b46" stroke-width="10" fill="none" stroke-linecap="round"/>
    <rect x="${n1(k.browL - 16)}" y="${n1(k.browY + 4)}" width="26" height="42" rx="12" fill="#26262e"/>
    <rect x="${n1(k.browR - 10)}" y="${n1(k.browY + 4)}" width="26" height="42" rx="12" fill="#26262e"/>`,
  earmuffs: (k) => `
    <path d="M${n1(k.browL + 2)} ${n1(k.browY + 6)} Q${n1(k.cx)} ${n1(k.sky + 4)} ${n1(k.browR - 2)} ${n1(k.browY + 6)}"
          stroke="#8f7ae6" stroke-width="9" fill="none" stroke-linecap="round"/>
    <ellipse cx="${n1(k.browL - 2)}" cy="${n1(k.browY + 26)}" rx="17" ry="22" fill="#b9a8f2"/>
    <ellipse cx="${n1(k.browR + 2)}" cy="${n1(k.browY + 26)}" rx="17" ry="22" fill="#b9a8f2"/>`,
  scarf: (k) => `
    <path d="M${n1(k.chinL + 4)} ${n1(k.chinY - 10)} Q${n1(k.cx)} ${n1(k.chinY + 16)} ${n1(k.chinR - 4)} ${n1(k.chinY - 10)}
             L${n1(k.chinR - 10)} ${n1(k.chinY + 6)} Q${n1(k.cx)} ${n1(k.chinY + 32)} ${n1(k.chinL + 10)} ${n1(k.chinY + 6)} Z" fill="#c0392b"/>
    <path d="M${n1(k.cx + k.chinW * 0.18)} ${n1(k.chinY + 8)} l14 34 l-20 4 l-6 -32 Z" fill="#a52f24"/>`,
  bowtie: (k) => {
    const y = k.chinY + 6;
    return `
    <path d="M${n1(k.cx)} ${n1(y)} L${n1(k.cx - 26)} ${n1(y - 15)} L${n1(k.cx - 26)} ${n1(y + 15)} Z" fill="#4757c4"/>
    <path d="M${n1(k.cx)} ${n1(y)} L${n1(k.cx + 26)} ${n1(y - 15)} L${n1(k.cx + 26)} ${n1(y + 15)} Z" fill="#4757c4"/>
    <circle cx="${n1(k.cx)}" cy="${n1(y)}" r="7" fill="#39469f"/>`;
  },
  necktie: (k) => {
    const y = k.chinY;
    return `
    <path d="M${n1(k.cx - 12)} ${n1(y - 4)} L${n1(k.cx + 12)} ${n1(y - 4)} L${n1(k.cx + 6)} ${n1(y + 10)} L${n1(k.cx - 6)} ${n1(y + 10)} Z" fill="#b8434b"/>
    <path d="M${n1(k.cx - 7)} ${n1(y + 10)} L${n1(k.cx + 7)} ${n1(y + 10)} L${n1(k.cx + 13)} ${n1(y + 44)}
             L${n1(k.cx)} ${n1(y + 54)} L${n1(k.cx - 13)} ${n1(y + 44)} Z" fill="#c94f57"/>`;
  },
};

// Two lenses on the eye line plus a bridge, which is every pair of eyewear here.
function eyewear(k, fill, stroke, rx, sw = 0) {
  const [lx, ly] = onFace(k, k.eyeL);
  const [rx2, ry] = onFace(k, k.eyeR);
  const w = 54 * k.face.eye;
  const h = 36 * k.face.eye;
  const box = (x, y) => `<rect x="${n1(x - w / 2)}" y="${n1(y - h / 2)}" width="${n1(w)}" height="${n1(h)}"
    rx="${n1(h * rx)}" fill="${fill}"${sw ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
  return `${box(lx, ly)}${box(rx2, ry)}
    <rect x="${n1(lx + w / 2 - 2)}" y="${n1((ly + ry) / 2 - 4)}"
          width="${n1(Math.max(2, rx2 - lx - w + 4))}" height="${sw ? 5 : 7}" rx="3" fill="${stroke}"/>`;
}

// A filled cap from the ceiling down to `bottom`: the mass every hair style is
// built on, so none of them read as a wire balanced on the head.
const dome = (k, bottom) =>
  `M${n1(k.hatL - 2)} ${n1(bottom)} Q${n1(k.cx)} ${n1(k.sky - 2)} ${n1(k.hatR + 2)} ${n1(bottom)} Z`;

// Hair is one crown mass plus optional extras, drawn in a single fill so the
// pieces read as one head of hair rather than a pile of shapes.
const hair = (k, colour, crown, extra = '') =>
  `<g fill="${colour}"><path d="${crown}"/>${extra}</g>`;

// Apply the per-shape face fit the eyes get, so eyewear lands on the eyes.
const onFace = (k, [x, y]) => [
  HEAD_C + k.face.x + (x - HEAD_C) * k.face.sx,
  HEAD_C + k.face.y + (y - HEAD_C) * k.face.sy,
];

// Grouped for the settings window, which now has a lot to lay out.
export const ACCESSORY_GROUPS = [
  { key: 'hair', keys: ['bangs', 'sideSwept', 'curls', 'afro', 'mohawk', 'bun', 'ponytail', 'braids', 'longHair'] },
  { key: 'hats', keys: ['beanie', 'cap', 'tophat', 'crown', 'graduate', 'chef', 'cowboy', 'headband',
    'santa', 'witch', 'party', 'flower', 'bow', 'halo', 'horns', 'antenna'] },
  { key: 'face', keys: ['shades', 'glasses', 'monocle', 'eyepatch', 'mask'] },
  { key: 'extras', keys: ['headphones', 'earmuffs', 'scarf', 'bowtie', 'necktie'] },
];

export const ACCESSORY_KEYS = Object.keys(ACCESSORIES);

// What, if anything, it should be wearing today. Deliberately narrow windows so
// an accessory stays a small surprise rather than the bot's permanent look.
export function seasonalAccessory(date = new Date()) {
  const m = date.getMonth();
  const d = date.getDate();
  if (m === 0 && d <= 2) return 'party';
  if (m === 11 || (m === 0 && d <= 5)) return 'santa';
  if (m === 9 && d >= 24) return 'witch';
  if (m === 6 || m === 7) return 'shades';
  return null;
}

export class Mark {
  constructor(container) {
    this.shapeKey = SHAPE_KEYS[0];
    this.shape = DATA.shapes[this.shapeKey];
    // Ids are per-instance: the settings window renders a second Mark beside the
    // real one, and two elements sharing a clip id is a rendering coin toss.
    this.clipId = `head-clip-${++clipSeq}`;
    this.gradId = `coat-grad-${clipSeq}`;
    this.grad = null;

    const svg = el('svg', {
      class: 'mark',
      viewBox: DATA.viewBox,
      xmlns: SVG_NS,
      'aria-hidden': 'true',
    });

    const defs = el('defs');
    this.defs = defs;
    this.clipPath = el('clipPath', { id: this.clipId });
    this.clipShape = el('path', { d: this.shape.path });
    this.clipPath.appendChild(this.clipShape);
    defs.appendChild(this.clipPath);
    svg.appendChild(defs);

    // Everything below lives inside `body`, which carries the squash / lean /
    // rotate transform, so the eyes stay welded to the head while it moves.
    this.body = el('g', { class: 'mark__body' });

    this.head = el('path', { class: 'mark__head', d: this.shape.path });
    this.body.appendChild(this.head);

    this.face = el('g', { class: 'mark__face', 'clip-path': `url(#${this.clipId})` });

    // Cheek blush — two soft ovals. Added before the eyes so the eyes always sit
    // on top of it, and tinted warm rather than reusing the eye colour.
    this.blush = el('g', { class: 'mark__blush', opacity: '0' });
    this.blushL = el('ellipse', { cx: 62, cy: 150, rx: 26, ry: 16 });
    this.blushR = el('ellipse', { cx: 168, cy: 150, rx: 26, ry: 16 });
    this.blush.appendChild(this.blushL);
    this.blush.appendChild(this.blushR);
    this.face.appendChild(this.blush);

    this.eyes = [el('path', { class: 'mark__eye' }), el('path', { class: 'mark__eye' })];
    this.eyes.forEach((e) => this.face.appendChild(e));

    this.body.appendChild(this.face);

    // Seasonal accessory, above the face so a hat is not clipped to the
    // silhouette but below the star so a celebration still reads.
    this.acc = el('g', { class: 'mark__acc' });
    this.accKey = null;
    this.body.appendChild(this.acc);

    // A single gold star, borrowed straight from the reference mark, used as a
    // "pinned / favourite" badge and for celebration beats.
    this.star = el('path', { class: 'mark__star', d: DATA.STAR_PATH, opacity: '0' });
    this.body.appendChild(this.star);

    svg.appendChild(this.body);
    container.appendChild(svg);
    this.svg = svg;

    this._lastHeadT = '';
    this._lastEyeT = ['', ''];
    this._lastEyeD = ['', ''];
  }

  setShape(key) {
    // A settings file written by an older build can still name a shape that has
    // since been retired. Fall back rather than ignore, or the body silently
    // keeps whatever it happened to start as.
    const next = DATA.shapes[key] ? key : SHAPE_KEYS[0];
    if (next === this.shapeKey) return;
    this.shapeKey = next;
    this.shape = DATA.shapes[next];
    this.head.setAttribute('d', this.shape.path);
    this.clipShape.setAttribute('d', this.shape.path);
    // Blush follows the silhouette's lower cheek line so it never floats off the body.
    const belt = this.shape.spans[Math.round(this.shape.spans.length * 0.68)];
    if (belt) {
      const [y, l, r] = belt;
      this.blushL.setAttribute('cx', l + (HEAD_C - l) * 0.28);
      this.blushR.setAttribute('cx', r - (r - HEAD_C) * 0.28);
      this.blushL.setAttribute('cy', y);
      this.blushR.setAttribute('cy', y);
    }
    // Shades are fitted to the face, which just changed under them.
    if (this.accKey) {
      const key = this.accKey;
      this.accKey = null;
      this.setAccessory(key);
    }
  }

  // A flat coat is one fill. A gradient is a `<linearGradient>` in this mark's
  // own defs — built once, then only its stops and angle are touched, because
  // rebuilding the node would make the paint flicker on every settings keystroke
  // while someone is dragging a colour picker.
  setColors({ coat, ink, gradient }) {
    if (gradient) {
      if (!this.grad) {
        this.grad = el('linearGradient', { id: this.gradId, gradientUnits: 'objectBoundingBox' });
        this.gradStops = gradient.colors.map((_, i) => {
          const stop = el('stop', { offset: `${(i / (gradient.colors.length - 1)) * 100}%` });
          this.grad.appendChild(stop);
          return stop;
        });
        this.defs.appendChild(this.grad);
      }
      gradient.colors.forEach((c, i) => this.gradStops[i]?.setAttribute('stop-color', c));
      const v = gradientVector(gradient.angle);
      for (const [k, n] of Object.entries(v)) this.grad.setAttribute(k, n.toFixed(4));
      this.head.style.fill = `url(#${this.gradId})`;
    } else {
      this.head.style.fill = coat;
    }
    this.eyes.forEach((e) => (e.style.fill = ink));
  }

  // `key` is an ACCESSORIES name, or null for none.
  setAccessory(key) {
    const next = key && ACCESSORIES[key] ? key : null;
    if (next === this.accKey) return;
    this.accKey = next;
    this.acc.innerHTML = next ? ACCESSORIES[next](fitFor(this.shape, this.shape.face)) : '';
  }

  // `state` is rebuilt every frame by the mascot loop.
  update(state) {
    const { rings, gaze, lid, eyeScale, body, blush, star } = state;
    const face = this.shape.face;

    const ht = `translate(${(HEAD_C + body.x).toFixed(2)} ${(HEAD_C + body.y).toFixed(2)}) ` +
      `rotate(${body.rot.toFixed(2)}) scale(${body.sx.toFixed(4)} ${body.sy.toFixed(4)}) ` +
      `translate(${-HEAD_C} ${-HEAD_C})`;
    if (ht !== this._lastHeadT) { this.body.setAttribute('transform', ht); this._lastHeadT = ht; }

    for (let i = 0; i < this.eyes.length; i++) {
      const ring = rings[i];
      if (!ring) continue;
      const d = ringPath(ring);
      if (d !== this._lastEyeD[i]) { this.eyes[i].setAttribute('d', d); this._lastEyeD[i] = d; }

      const [cx, cy] = centroid(ring);
      // Per-shape face fitting: a Capsule is narrow, so its eyes pull inward and
      // shrink; a Blob leaves them exactly where the expression put them.
      const tx = HEAD_C + face.x + (cx - HEAD_C) * face.sx + gaze.x;
      const ty = HEAD_C + face.y + (cy - HEAD_C) * face.sy + gaze.y;
      const sc = face.eye * eyeScale;
      const t = `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) ` +
        `scale(${sc.toFixed(3)} ${(sc * (1 - lid)).toFixed(3)}) ` +
        `translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`;
      if (t !== this._lastEyeT[i]) { this.eyes[i].setAttribute('transform', t); this._lastEyeT[i] = t; }
    }

    this.blush.setAttribute('opacity', (blush * 0.62).toFixed(3));

    if (star > 0.001) {
      const s = 30 * star;
      this.star.setAttribute('opacity', clamp(star, 0, 1).toFixed(3));
      this.star.setAttribute('transform',
        `translate(${HEAD_C + this.shape.radius * 0.62} ${HEAD_C - this.shape.radius * 0.72}) ` +
        `rotate(${(1 - star) * 180}) scale(${s.toFixed(2)})`);
    } else if (this.star.getAttribute('opacity') !== '0') {
      this.star.setAttribute('opacity', '0');
    }
  }
}

export { DATA, HEAD_C };
