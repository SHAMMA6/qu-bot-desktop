// Coat colours. The eye colour is derived from the coat's luminance so a custom
// colour always keeps the eyes readable.
//
// A coat can also be a *gradient* — three stops and an angle, painted across the
// silhouette. That makes the eye colour a harder question than it looks: the
// eyes sit on one part of the body, but which part is a function of the shape,
// the expression and where it happens to be looking, so there is no single
// background colour to contrast against. The rule here is to pick whichever ink
// reads best against the *worst* stop, which is the only choice that cannot be
// ambushed by the bot glancing somewhere new.

export const COATS = [
  { key: 'chalk', label: 'Chalk', coat: '#F7F7F5' },
  { key: 'midnight', label: 'Midnight', coat: '#17171B' },
  { key: 'indigo', label: 'Indigo', coat: '#6464EF' },
  { key: 'red', label: 'Red', coat: '#EA4045' },
  { key: 'orange', label: 'Orange', coat: '#ED712E' },
  { key: 'amber', label: 'Amber', coat: '#F19D38' },
  { key: 'green', label: 'Green', coat: '#5BC67A' },
  { key: 'teal', label: 'Teal', coat: '#54B9A6' },
  { key: 'blue', label: 'Blue', coat: '#3C82F6' },
  { key: 'violet', label: 'Violet', coat: '#885CF5' },
  { key: 'magenta', label: 'Magenta', coat: '#EB4699' },
];

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function luminance(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

const DARK_INK = '#0E0E12';
const LIGHT_INK = '#FFFFFF';

export const contrast = (a, b) => {
  const l1 = Math.max(luminance(a), luminance(b));
  const l2 = Math.min(luminance(a), luminance(b));
  return (l1 + 0.05) / (l2 + 0.05);
};

// Saturated coats keep light eyes — that is the look the mark is built around —
// but only while that still clears the 3:1 bar for large non-text shapes. Past
// this luminance a light eye starts to disappear into the body, so it flips.
const LIGHT_EYE_CEILING = 0.28;

export function inkFor(coat) {
  return luminance(coat) > LIGHT_EYE_CEILING ? DARK_INK : LIGHT_INK;
}

// Ready-made gradients, so a good-looking one is a single click and building
// your own is the fallback rather than the only option. Three stops each,
// because two is a fade and four is a swatch book.
export const GRADIENTS = [
  { key: 'sunset', colors: ['#EA4045', '#ED712E', '#F19D38'] },
  { key: 'ocean', colors: ['#3C82F6', '#4AA3CE', '#54B9A6'] },
  { key: 'grape', colors: ['#3C82F6', '#885CF5', '#EB4699'] },
  { key: 'aurora', colors: ['#5BC67A', '#54B9A6', '#3C82F6'] },
  { key: 'candy', colors: ['#EB4699', '#B15AF0', '#885CF5'] },
  // Ember is the one preset that runs dark-to-bright, so it is also the one
  // where the eye colour has to survive both ends. Its top stop is deliberately
  // a shade below the standalone Orange coat: at #ED712E the white eyes drop to
  // 2.99:1 against the brightest part of the body, and the check below fails it.
  { key: 'ember', colors: ['#8A1F2B', '#B92B2E', '#DB5A22'] },
  { key: 'lagoon', colors: ['#54B9A6', '#3FA5B8', '#3C82F6'] },
  { key: 'orchid', colors: ['#885CF5', '#C74DC6', '#EB4699'] },
];

export const GRADIENT_STOPS = 3;
export const DEFAULT_GRADIENT = { colors: [...GRADIENTS[2].colors], angle: 135 };

const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

// Whichever ink is legible against the *worst* stop. Returns the ink and that
// worst ratio, so a caller can warn about a gradient no ink can survive —
// white-to-black being the obvious one.
export function inkForGradient(colors) {
  const worst = (ink) => Math.min(...colors.map((c) => contrast(c, ink)));
  const light = worst(LIGHT_INK);
  const dark = worst(DARK_INK);
  return light >= dark
    ? { ink: LIGHT_INK, ratio: light }
    : { ink: DARK_INK, ratio: dark };
}

// Normalise whatever is in the settings file into exactly three usable stops.
export function normalizeGradient(g) {
  const src = Array.isArray(g?.colors) ? g.colors.filter(isHex) : [];
  const colors = [];
  for (let i = 0; i < GRADIENT_STOPS; i++) {
    colors.push(src[i] || src[src.length - 1] || DEFAULT_GRADIENT.colors[i]);
  }
  const angle = Number.isFinite(Number(g?.angle)) ? ((Number(g.angle) % 360) + 360) % 360 : 135;
  return { colors, angle };
}

// One place decides what the body is painted with. `gradient` is null for a flat
// coat, so every renderer can branch on that single field rather than each
// working out for itself whether the settings add up to a gradient.
export function resolveCoat(key, custom, gradient) {
  if (key === 'gradient') {
    const g = normalizeGradient(gradient);
    const { ink } = inkForGradient(g.colors);
    // `coat` stays a single colour even for a gradient: particles, the glow and
    // the CSS variable all need one, and the middle stop is the one that reads
    // as "what colour is it, roughly".
    return { coat: g.colors[1], ink, gradient: g };
  }
  if (key === 'custom' && custom) return { coat: custom, ink: inkFor(custom), gradient: null };
  const found = COATS.find((c) => c.key === key) || COATS[0];
  return { coat: found.coat, ink: inkFor(found.coat), gradient: null };
}

// The gradient's unit-vector endpoints, for SVG's objectBoundingBox space.
// 0deg runs left to right and it turns clockwise from there, matching the way
// the angle reads in the settings window.
export function gradientVector(angle = 135) {
  const r = (angle * Math.PI) / 180;
  const x = Math.cos(r) / 2;
  const y = Math.sin(r) / 2;
  return { x1: 0.5 - x, y1: 0.5 - y, x2: 0.5 + x, y2: 0.5 + y };
}

// `#RRGGBB` -> `rgba(r, g, b, a)`, for the glow, which has to fade out.
export function rgba(hex, alpha) {
  const h = String(hex).replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
