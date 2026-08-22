// Small geometry + easing toolkit shared by the renderer.

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const chance = (p) => Math.random() < p;

// Frame-rate independent approach: pull `cur` toward `target` by `rate` per second.
export const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

// ---- ring helpers (ports of the reference mark system) ----

// A "ring" is a closed loop of [x, y] points. Rendering it is just a polyline;
// the point count is identical across every expression, which is what makes
// point-for-point morphing between any two expressions possible.
export const ringPath = (ring) => 'M' + ring.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L') + 'Z';

export const centroid = (ring) => {
  let x = 0, y = 0;
  for (const [px, py] of ring) { x += px; y += py; }
  return [x / ring.length, y / ring.length];
};

export const lerpRing = (a, b, t) => a.map(([x, y], i) => [x + (b[i][0] - x) * t, y + (b[i][1] - y) * t]);

// Interpolate a whole expression (an array of eye rings).
export const lerpExpression = (a, b, t) => a.map((ring, i) => lerpRing(ring, b[i] || ring, t));

// Simplex-ish smooth noise, seeded, for organic idle drift. Cheap value noise
// with cubic smoothing — plenty for wobble and breathing.
export function makeNoise(seed = 1) {
  const p = new Float32Array(512);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < 512; i++) {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    p[i] = (s / 4294967295) * 2 - 1;
  }
  return (x) => {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    const a = p[i & 511], b = p[(i + 1) & 511];
    return a + (b - a) * u;
  };
}
