// Coat colours. The eye colour is derived from the coat's luminance so a custom
// colour always keeps the eyes readable.

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

export function resolveCoat(key, custom) {
  if (key === 'custom' && custom) return { coat: custom, ink: inkFor(custom) };
  const found = COATS.find((c) => c.key === key) || COATS[0];
  return { coat: found.coat, ink: inkFor(found.coat) };
}

export const DEFAULTS = {
  coat: 'chalk',
  customCoat: '#885CF5',
  shape: 'blob',
  size: 128,
  opacity: 1,
  gravity: false,
  roam: true,
  followCursor: true,
  watchActivity: true,
  chatter: true,
  sleepWhenIdle: true,
  nudges: true,
  gazeFollowsCursor: true,
  clickThrough: true,
  alwaysOnTop: true,
  soundEnabled: false,
  launchOnLogin: false,
  position: null,          // {x, y} of the mascot centre, or null for "bottom right"
  display: null,           // remembered display id
  greetOnLaunch: true,
  doubleClickAction: 'talk',
};
