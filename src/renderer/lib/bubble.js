// Speech bubble that types itself out and parks on whichever side of the mascot
// has room inside the window.

import { clamp } from './geom.js';

export class Bubble {
  constructor(el, textEl) {
    this.el = el;
    this.textEl = textEl;
    this.visible = false;
    this.full = '';
    this.shown = 0;
    this.typeSpeed = 34;       // characters per second
    this.holdFor = 0;
    this.state = 'hidden';     // hidden | typing | holding | leaving
    this.onDone = null;
    this.onType = null;
  }

  say(text, { hold = null, speed = 34 } = {}) {
    this.full = String(text);
    this.shown = 0;
    this.typeSpeed = speed;
    // Long lines get proportionally longer on screen, with sane bounds.
    this.holdFor = hold ?? clamp(1.6 + this.full.length * 0.055, 2.2, 7);
    this.state = 'typing';
    this.visible = true;
    this.textEl.textContent = '';
    this.el.classList.add('is-visible');
    this.el.classList.remove('is-leaving');
  }

  hide() {
    if (this.state === 'hidden') return;
    this.state = 'leaving';
    this.leaveT = 0.22;
    this.el.classList.add('is-leaving');
  }

  update(dt) {
    if (this.state === 'typing') {
      this.shown += this.typeSpeed * dt;
      const n = Math.min(this.full.length, Math.floor(this.shown));
      if (n !== this._lastN) {
        this.textEl.textContent = this.full.slice(0, n);
        this._lastN = n;
        if (this.onType && n > 0 && this.full[n - 1] !== ' ') this.onType();
      }
      if (n >= this.full.length) { this.state = 'holding'; this.holdT = this.holdFor; }
    } else if (this.state === 'holding') {
      this.holdT -= dt;
      if (this.holdT <= 0) this.hide();
    } else if (this.state === 'leaving') {
      this.leaveT -= dt;
      if (this.leaveT <= 0) {
        this.state = 'hidden';
        this.visible = false;
        this.el.classList.remove('is-visible', 'is-leaving');
        if (this.onDone) this.onDone();
      }
    }
  }

  // Anchor above the mascot, flipping left/right and above/below to stay in frame.
  layout(anchor, frame) {
    if (!this.visible) return;
    const r = this.el.getBoundingClientRect();
    const w = r.width || 200, h = r.height || 60;
    const gap = 12;

    let below = anchor.y - anchor.r - gap - h < 4;
    let top = below ? anchor.y + anchor.r + gap : anchor.y - anchor.r - gap - h;
    let left = anchor.x - w / 2;

    left = clamp(left, 6, Math.max(6, frame.w - w - 6));
    top = clamp(top, 4, Math.max(4, frame.h - h - 4));

    this.el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    this.el.classList.toggle('is-below', below);

    // Tail tracks the mascot even when the bubble was clamped to the edge.
    const tailX = clamp(anchor.x - left, 16, Math.max(16, w - 16));
    this.el.style.setProperty('--tail-x', `${Math.round(tailX)}px`);
    this._rect = { left, top, w, h };
  }

  get rect() { return this.visible ? this._rect : null; }
}
