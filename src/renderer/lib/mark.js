// The mascot's body: one solid silhouette plus two eye shapes clipped to it.
// No mouth, no outline, no gradients — the whole character reads through eye
// geometry and body language, which is what keeps the silhouette this clean.

import DATA from '../../shared/mascot-data.js';
import { ringPath, centroid, clamp } from './geom.js';

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

// Seasonal accessories. Everything is authored in the shared viewBox, which only
// allows 15 units of headroom above the crown — so hats rest ON the head and
// lean off to one side rather than towering over it, which is the only way they
// fit without changing the viewBox for every shape.
export const ACCESSORIES = {
  santa: () => `
    <path d="M58 34 C78 -2 150 -14 186 -6 L172 44 C140 34 92 38 62 50 Z" fill="#c0392b"/>
    <rect x="46" y="30" width="130" height="24" rx="12" fill="#f7f7f7"/>
    <circle cx="190" cy="-6" r="14" fill="#f7f7f7"/>`,
  witch: () => `
    <path d="M96 38 C104 4 118 -12 132 -14 L166 40 C140 46 116 46 96 38 Z" fill="#2f2b3d"/>
    <ellipse cx="120" cy="44" rx="80" ry="16" fill="#2f2b3d"/>
    <rect x="92" y="26" width="60" height="12" rx="6" fill="#8f7ae6"
          transform="rotate(-9 122 32)"/>`,
  party: () => `
    <path d="M108 40 L140 -12 L172 44 Z" fill="#f2a03d"/>
    <path d="M120 22 L146 14 L152 26 L126 34 Z" fill="#e4576a"/>
    <circle cx="140" cy="-14" r="10" fill="#5ec9a8"/>`,
  // Shades sit on the eye line, so they take the per-shape face fit the eyes do.
  shades: (face) => {
    const fit = (x, y) => [
      HEAD_C + face.x + (x - HEAD_C) * face.sx,
      HEAD_C + face.y + (y - HEAD_C) * face.sy,
    ];
    const [lx, ly] = fit(98, 110);
    const [rx, ry] = fit(160, 116);
    const w = 54 * face.eye;
    const h = 36 * face.eye;
    return `
      <rect x="${(lx - w / 2).toFixed(1)}" y="${(ly - h / 2).toFixed(1)}"
            width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(h * 0.34).toFixed(1)}"
            fill="#1c1c22"/>
      <rect x="${(rx - w / 2).toFixed(1)}" y="${(ry - h / 2).toFixed(1)}"
            width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(h * 0.34).toFixed(1)}"
            fill="#1c1c22"/>
      <rect x="${(lx + w / 2 - 2).toFixed(1)}" y="${((ly + ry) / 2 - 4).toFixed(1)}"
            width="${Math.max(2, rx - lx - w + 4).toFixed(1)}" height="7" rx="3" fill="#1c1c22"/>`;
  },
};

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
    this.shapeKey = 'blob';
    this.shape = DATA.shapes.blob;
    this.clipId = `head-clip-${++clipSeq}`;

    const svg = el('svg', {
      class: 'mark',
      viewBox: DATA.viewBox,
      xmlns: SVG_NS,
      'aria-hidden': 'true',
    });

    const defs = el('defs');
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
    if (!DATA.shapes[key] || key === this.shapeKey) return;
    this.shapeKey = key;
    this.shape = DATA.shapes[key];
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

  setColors({ coat, ink }) {
    this.head.style.fill = coat;
    this.eyes.forEach((e) => (e.style.fill = ink));
  }

  // `key` is an ACCESSORIES name, or null for none.
  setAccessory(key) {
    const next = key && ACCESSORIES[key] ? key : null;
    if (next === this.accKey) return;
    this.accKey = next;
    this.acc.innerHTML = next ? ACCESSORIES[next](this.shape.face) : '';
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
