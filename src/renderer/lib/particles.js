// Canvas overlay for everything that floats off the mascot. Kept vector/typographic
// rather than emoji so it stays in the same flat, monochrome-plus-one-accent language
// as the body itself.

import { rand, pick, clamp, TAU, chance } from './geom.js';

const PALETTE = ['#EA4045', '#ED712E', '#F19D38', '#5BC67A', '#54B9A6', '#3C82F6', '#885CF5', '#EB4699'];

// ---- shape painters (all draw centred on 0,0 at unit scale) ----

function paintSparkle(ctx, s) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const bx = Math.cos(a), by = Math.sin(a);
    const mx = Math.cos(a + TAU / 8) * 0.22, my = Math.sin(a + TAU / 8) * 0.22;
    if (i === 0) ctx.moveTo(bx * s, by * s); else ctx.lineTo(bx * s, by * s);
    ctx.quadraticCurveTo(mx * s, my * s, Math.cos(a + TAU / 4) * s, Math.sin(a + TAU / 4) * s);
  }
  ctx.closePath();
  ctx.fill();
}

function paintHeart(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.75);
  ctx.bezierCurveTo(-s * 1.5, -s * 0.2, -s * 0.6, -s * 1.1, 0, -s * 0.35);
  ctx.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.5, -s * 0.2, 0, s * 0.75);
  ctx.closePath();
  ctx.fill();
}

function paintNote(ctx, s) {
  ctx.beginPath();
  ctx.ellipse(-s * 0.35, s * 0.6, s * 0.45, s * 0.34, -0.4, 0, TAU);
  ctx.fill();
  ctx.fillRect(s * 0.02, -s, s * 0.2, s * 1.6);
  ctx.beginPath();
  ctx.moveTo(s * 0.22, -s);
  ctx.quadraticCurveTo(s * 0.95, -s * 0.85, s * 0.8, -s * 0.25);
  ctx.quadraticCurveTo(s * 0.7, -s * 0.6, s * 0.22, -s * 0.55);
  ctx.closePath();
  ctx.fill();
}

function paintDrop(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.75, s * 0.05, s * 0.62, s, 0, s);
  ctx.bezierCurveTo(-s * 0.62, s, -s * 0.75, s * 0.05, 0, -s);
  ctx.closePath();
  ctx.fill();
}

function paintPuff(ctx, s) {
  ctx.beginPath();
  ctx.arc(-s * 0.4, 0, s * 0.6, 0, TAU);
  ctx.arc(s * 0.35, -s * 0.15, s * 0.5, 0, TAU);
  ctx.arc(s * 0.05, s * 0.3, s * 0.42, 0, TAU);
  ctx.fill();
}

function paintGlyph(ctx, s, text, font) {
  ctx.font = `700 ${(s * 2.4).toFixed(1)}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
}

// ---- emitter definitions ----
// Each returns a fresh particle. `origin` gives the mascot's centre and radius in
// canvas pixels so emitters can spawn on the silhouette rather than at a fixed point.

const SPAWN = {
  sparkle: (o) => ({
    kind: 'sparkle', x: o.cx + rand(-o.r, o.r), y: o.cy + rand(-o.r * 0.8, o.r * 0.5),
    vx: rand(-14, 14), vy: rand(-46, -20), life: rand(0.7, 1.2), size: rand(3.5, 7),
    spin: rand(-3, 3), rot: rand(TAU), color: null, grow: 1,
  }),
  heart: (o) => ({
    kind: 'heart', x: o.cx + rand(-o.r * 0.55, o.r * 0.55), y: o.cy - o.r * 0.25,
    vx: rand(-18, 18), vy: rand(-58, -34), life: rand(1.1, 1.8), size: rand(5, 9),
    spin: rand(-1.4, 1.4), rot: rand(-0.3, 0.3), color: '#EB4699', grow: 1.35, sway: rand(TAU),
  }),
  note: (o) => ({
    kind: 'note', x: o.cx + rand(-o.r * 0.7, o.r * 0.7), y: o.cy - o.r * 0.4,
    vx: rand(-26, 26), vy: rand(-52, -30), life: rand(1, 1.5), size: rand(4.5, 7.5),
    spin: rand(-2, 2), rot: rand(-0.4, 0.4), color: null, grow: 1, sway: rand(TAU),
  }),
  confetti: (o) => ({
    kind: 'confetti', x: o.cx + rand(-o.r * 0.9, o.r * 0.9), y: o.cy - o.r * 0.8,
    vx: rand(-120, 120), vy: rand(-230, -120), life: rand(1.3, 2.1), size: rand(3, 6),
    spin: rand(-9, 9), rot: rand(TAU), color: pick(PALETTE), gravity: 340, grow: 1,
  }),
  question: (o) => ({
    kind: 'glyph', text: '?', x: o.cx + rand(o.r * 0.3, o.r * 0.8), y: o.cy - o.r * 0.6,
    vx: rand(-8, 12), vy: rand(-34, -18), life: rand(1, 1.6), size: rand(6, 10),
    spin: rand(-1, 1), rot: rand(-0.25, 0.25), color: null, grow: 1.1,
  }),
  think: (o) => ({
    kind: 'dot', x: o.cx + o.r * 0.75, y: o.cy - o.r * 0.62,
    vx: rand(4, 16), vy: rand(-26, -14), life: rand(1, 1.6), size: rand(3, 5.5),
    spin: 0, rot: 0, color: null, grow: 1.5,
  }),
  ping: (o) => ({
    kind: 'ring', x: o.cx, y: o.cy, vx: 0, vy: 0, life: 0.95,
    size: o.r * 0.75, spin: 0, rot: 0, color: null, ringGrow: o.r * 1.5,
  }),
  shock: (o) => ({
    kind: 'spike', x: o.cx, y: o.cy, vx: 0, vy: 0, life: 0.5,
    size: o.r, spin: 0, rot: rand(TAU), color: null, ringGrow: o.r * 0.55,
  }),
  sweat: (o) => ({
    kind: 'drop', x: o.cx + (chance(0.5) ? -1 : 1) * o.r * rand(0.6, 0.85), y: o.cy - o.r * rand(0.2, 0.5),
    vx: rand(-8, 8), vy: rand(30, 70), life: rand(0.6, 1), size: rand(3.5, 6),
    spin: 0, rot: 0, color: '#54B9A6', gravity: 260, grow: 1,
  }),
  tear: (o) => ({
    kind: 'drop', x: o.cx + (chance(0.5) ? -1 : 1) * o.r * rand(0.25, 0.45), y: o.cy + o.r * 0.1,
    vx: rand(-5, 5), vy: rand(20, 45), life: rand(0.9, 1.4), size: rand(3, 5.5),
    spin: 0, rot: 0, color: '#3C82F6', gravity: 300, grow: 1,
  }),
  steam: (o) => ({
    kind: 'puff', x: o.cx + rand(-o.r * 0.6, o.r * 0.6), y: o.cy - o.r * 0.85,
    vx: rand(-16, 16), vy: rand(-44, -24), life: rand(0.7, 1.2), size: rand(4, 8),
    spin: rand(-1, 1), rot: rand(TAU), color: '#EA4045', grow: 2.1,
  }),
  glitch: (o) => ({
    kind: 'slice', x: o.cx, y: o.cy + rand(-o.r, o.r), vx: 0, vy: rand(-20, 20),
    life: rand(0.08, 0.2), size: rand(o.r * 0.3, o.r * 1.1), spin: 0, rot: 0,
    color: pick(['#EA4045', '#3C82F6', '#5BC67A']), thickness: rand(2, 7), grow: 1,
  }),
  swirl: (o) => ({
    kind: 'orbit', x: o.cx, y: o.cy, vx: 0, vy: 0, life: rand(1, 1.6),
    size: rand(3, 5), spin: 0, rot: 0, color: null, oy: -o.r * 1.05,
    orbitR: o.r * rand(0.4, 0.55), orbitA: rand(TAU), orbitSpeed: rand(4, 7), squash: 0.4, grow: 1,
  }),
  sleep: (o) => ({
    kind: 'glyph', text: 'z', x: o.cx + o.r * 0.62, y: o.cy - o.r * 1.02,
    vx: rand(10, 22), vy: rand(-26, -16), life: rand(1.6, 2.4), size: rand(5, 9),
    spin: rand(-0.5, 0.5), rot: -0.15, color: null, grow: 1.6, sway: rand(TAU),
  }),
  orbit: (o) => ({
    kind: 'orbit', x: o.cx, y: o.cy, vx: 0, vy: 0, life: rand(1.4, 2),
    size: rand(2.5, 4), spin: 0, rot: 0, color: null, oy: 0, overBody: true,
    orbitR: o.r * rand(0.95, 1.15), orbitA: rand(TAU), orbitSpeed: rand(2.5, 4), squash: 0.28, grow: 1,
  }),
  dust: (o) => ({
    kind: 'puff', x: o.cx + rand(-o.r * 0.8, o.r * 0.8), y: o.cy + o.r * 0.85,
    vx: rand(-70, 70), vy: rand(-30, -6), life: rand(0.35, 0.6), size: rand(3, 7),
    spin: rand(-2, 2), rot: rand(TAU), color: null, grow: 1.9, gravity: 90,
  }),
  star: (o) => ({
    kind: 'sparkle', x: o.cx + rand(-o.r, o.r), y: o.cy + rand(-o.r, o.r),
    vx: rand(-30, 30), vy: rand(-70, -30), life: rand(0.8, 1.3), size: rand(4, 8),
    spin: rand(-4, 4), rot: rand(TAU), color: '#f4c34e', grow: 1,
  }),
};

// How many particles per second each emitter sustains while an emotion is held.
const RATE = {
  sparkle: 11, heart: 4.5, note: 5, confetti: 26, question: 1.6, think: 2.4,
  ping: 1.1, shock: 9, sweat: 3.2, tear: 1.4, steam: 8, glitch: 22,
  swirl: 7, sleep: 0.9, orbit: 4, dust: 0, star: 0,
};

// Remember the spawn lifetime so fade can be expressed as a 1 -> 0 ratio.
const born = (p) => { p.life0 = p.life; return p; };

export class Particles {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.items = [];
    this.acc = 0;
    // Effects that fly clear of the body wear the coat colour — the character's
    // identity colour, picked to read against a desktop. Effects that ride on
    // top of the body (`overBody`) wear the eye colour instead, which is the one
    // guaranteed to contrast with the coat.
    this.tint = '#885CF5';
    this.ink = '#0E0E12';
    this.dpr = 1;
    this.max = 220;
  }

  resize(w, h, dpr) {
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  setColors({ coat, ink }) { this.tint = coat; this.ink = ink; }

  // Continuous emission driven by the active emotion.
  emit(type, origin, dt, multiplier = 1) {
    const spawn = SPAWN[type];
    if (!spawn) return;
    this.acc += (RATE[type] ?? 5) * multiplier * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      if (this.items.length < this.max) this.items.push(born(spawn(origin)));
    }
  }

  // One-shot burst, e.g. landing dust or a celebration pop.
  burst(type, origin, count = 12) {
    const spawn = SPAWN[type];
    if (!spawn) return;
    for (let i = 0; i < count && this.items.length < this.max; i++) this.items.push(born(spawn(origin)));
  }

  clearAccumulator() { this.acc = 0; }

  update(dt) {
    const out = [];
    for (const p of this.items) {
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.kind === 'orbit') {
        p.orbitA += p.orbitSpeed * dt;
      } else {
        if (p.gravity) p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.sway !== undefined) { p.sway += dt * 4; p.x += Math.cos(p.sway) * 14 * dt; }
      }
      p.rot += (p.spin || 0) * dt;
      out.push(p);
    }
    this.items = out;
  }

  draw(origin) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
    if (!this.items.length) return;
    const font = getComputedStyle(document.body).getPropertyValue('--font') || 'system-ui, sans-serif';

    // Same contact shadow the body carries, so effects sit in the same space.
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;

    for (const p of this.items) {
      const t = clamp(p.life / p.life0, 0, 1);
      const fade = p.kind === 'ring' || p.kind === 'spike' ? t : Math.min(1, t * 2.2);
      ctx.save();
      ctx.globalAlpha = fade;
      const paint = p.color || (p.overBody ? this.ink : this.tint);
      ctx.fillStyle = paint;
      ctx.strokeStyle = paint;

      if (p.kind === 'orbit') {
        const a = p.orbitA;
        ctx.translate(origin.cx + Math.cos(a) * p.orbitR,
          origin.cy + (p.oy || 0) + Math.sin(a) * p.orbitR * p.squash);
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, TAU);
        ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.translate(p.x, p.y);
        ctx.lineWidth = 3 * t;
        ctx.globalAlpha = fade * 0.65;
        ctx.beginPath();
        ctx.arc(0, 0, p.size + (1 - t) * p.ringGrow, 0, TAU);
        ctx.stroke();
      } else if (p.kind === 'spike') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          const r0 = p.size + (1 - t) * p.ringGrow * 0.4;
          const r1 = r0 + 10 * t + 6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
          ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.stroke();
        }
      } else if (p.kind === 'slice') {
        ctx.globalAlpha = fade * 0.8;
        ctx.fillRect(p.x - p.size / 2, p.y, p.size, p.thickness);
      } else {
        const grow = 1 + (1 - t) * ((p.grow || 1) - 1);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const s = p.size * grow;
        switch (p.kind) {
          case 'sparkle': paintSparkle(ctx, s); break;
          case 'heart': paintHeart(ctx, s); break;
          case 'note': paintNote(ctx, s); break;
          case 'drop': paintDrop(ctx, s); break;
          case 'puff': ctx.globalAlpha = fade * 0.5; paintPuff(ctx, s); break;
          case 'dot': ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill(); break;
          case 'confetti': ctx.fillRect(-s / 2, -s * 0.35, s, s * 0.7); break;
          case 'glyph': paintGlyph(ctx, s, p.text, font); break;
        }
      }
      ctx.restore();
    }
  }

  clear() { this.items.length = 0; this.acc = 0; }
}

export const PARTICLE_TYPES = Object.keys(SPAWN);
