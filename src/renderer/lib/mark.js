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
  }

  setColors({ coat, ink }) {
    this.head.style.fill = coat;
    this.eyes.forEach((e) => (e.style.fill = ink));
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
