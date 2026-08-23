// Data integrity checks for the character definition. Catches the failure modes
// that are invisible until you happen to trigger the right emotion: an expression
// index out of range, an effect name with no emitter, a coat whose eyes vanish
// into it, a dialogue bucket that was renamed but still referenced.
//
//   npm test

import { readFileSync } from 'fs';
import { EMOTIONS, EMOTION_KEYS, EMOTION_GROUPS } from '../src/renderer/lib/emotions.js';
import DATA from '../src/shared/mascot-data.js';
import { COATS, resolveCoat, contrast } from '../src/shared/themes.js';
import { LINES, PACKS } from '../src/renderer/lib/dialogue.js';
import { STRINGS } from '../src/shared/i18n.js';
import { ACCESSORY_KEYS } from '../src/renderer/lib/mark.js';

let fail = 0;
const check = (ok, msg) => { if (!ok) { console.log('  FAIL:', msg); fail++; } };

// --- emotions
console.log(`emotions: ${EMOTION_KEYS.length}, expressions: ${DATA.expressions.length}, shapes: ${Object.keys(DATA.shapes).length}`);
const spawnNames = [...readFileSync('src/renderer/lib/particles.js', 'utf8')
  .matchAll(/^  (\w+): \(o\) => \(\{/gm)].map((m) => m[1]);
console.log(`particle emitters: ${spawnNames.length} -> ${spawnNames.join(', ')}`);

for (const [k, e] of Object.entries(EMOTIONS)) {
  check(Number.isInteger(e.expr) && e.expr >= 0 && e.expr < DATA.expressions.length, `${k}: bad expr ${e.expr}`);
  check(!e.fx || spawnNames.includes(e.fx), `${k}: unknown fx "${e.fx}"`);
  check(e.blink === null || (Array.isArray(e.blink) && e.blink[0] < e.blink[1]), `${k}: bad blink`);
  check(['follow', 'fixed', 'wander', 'away', 'down'].includes(e.gaze), `${k}: bad gaze "${e.gaze}"`);
  check((e.lidBias ?? 0) >= 0 && (e.lidBias ?? 0) <= 0.9, `${k}: lidBias out of range`);
  check(typeof e.label === 'string' && typeof e.emoji === 'string', `${k}: missing label/emoji`);
  check(e.settle > 0 && e.scale > 0 && e.eye > 0, `${k}: non-positive settle/scale/eye`);
}

// --- every expression ring is morph-compatible (identical point counts)
const counts = new Set(DATA.expressions.flatMap((e) => e.map((r) => r.length)));
check(counts.size === 1, `expression rings have differing point counts: ${[...counts]}`);
check(DATA.expressions.every((e) => e.length === 2), 'an expression does not have exactly 2 eyes');

// --- every expression's eye pair is centred on the head
//
// Position is not part of an expression: `face.x/face.y` place the pair, `gaze`
// aims it. A pair drawn off-axis spends the gaze range before the bot has
// looked at anything, which is what used to make it read as permanently
// glancing right. `tools/normalize-eyes.mjs` fixes a file that fails this.
for (let i = 0; i < DATA.expressions.length; i++) {
  let x = 0;
  let n = 0;
  for (const ring of DATA.expressions[i]) for (const p of ring) { x += p[0]; n++; }
  const off = x / n - DATA.HEAD_C;
  check(Math.abs(off) < 0.05,
    `expression ${i}: eye pair sits ${off.toFixed(2)} units off the head axis — run tools/normalize-eyes.mjs`);
}

// --- shapes
for (const [k, s] of Object.entries(DATA.shapes)) {
  check(typeof s.path === 'string' && s.path.length > 20, `${k}: bad path`);
  check(s.face && ['x', 'y', 'sx', 'sy', 'eye'].every((f) => typeof s.face[f] === 'number'), `${k}: bad face`);
  check(Array.isArray(s.spans) && s.spans.length > 8, `${k}: bad spans`);
  check(s.radius > 0, `${k}: bad radius`);
}

// --- menu groups
const grouped = new Set(EMOTION_GROUPS.flatMap((g) => g.keys));
for (const k of grouped) check(EMOTIONS[k], `menu references missing emotion "${k}"`);
const ungrouped = EMOTION_KEYS.filter((k) => !grouped.has(k));
check(ungrouped.join(',') === 'held,falling,squished,walking', `unexpected ungrouped: ${ungrouped}`);

// --- coats always yield readable eyes (WCAG-ish contrast on the body)
for (const c of [...COATS, { key: 'custom', label: 'custom', coat: '#F19D38' }]) {
  const { coat, ink } = resolveCoat(c.key, c.coat);
  const ratio = contrast(coat, ink);
  // 3:1 is the WCAG bar for large non-text graphics, which is what the eyes are.
  check(ratio >= 3, `coat ${c.key}: eye contrast only ${ratio.toFixed(2)}:1`);
}

// --- the preload bridges expose exactly what the renderers call
//
// Both sides are plain object literals, so a duplicated key is legal JavaScript
// that silently keeps only the last one. That is how every control in the
// settings window came to be wired to the update checker instead.
const BRIDGES = [
  ['src/main/preload.cjs', 'src/renderer/mascot.js'],
  ['src/main/preload-settings.cjs', 'src/renderer/settings.js'],
];
for (const [bridge, renderer] of BRIDGES) {
  const exposed = new Set();
  for (const m of readFileSync(bridge, 'utf8').matchAll(/^  (\w+):/gm)) {
    check(!exposed.has(m[1]), `${bridge}: duplicate key "${m[1]}" — the later one silently wins`);
    exposed.add(m[1]);
  }
  const called = new Set([...readFileSync(renderer, 'utf8')
    .matchAll(/\bapi\.(\w+)/g)].map((m) => m[1]));
  for (const c of called) {
    check(exposed.has(c), `${renderer}: api.${c} is not exposed by ${bridge}`);
  }
  console.log(`bridge ${bridge}: ${exposed.size} exposed, ${called.size} called`);
}

// --- every language pack covers English, with the same placeholders
//
// A translated line that drops {mins} renders a sentence with a hole in it, and
// a missing bucket silently falls back to English mid-conversation. Neither is
// visible until someone is actually reading the bot in that language.
const holes = (arr) => new Set((arr.join(' ').match(/\{\w+\}/g) || []));
for (const [lang, p] of Object.entries(PACKS)) {
  if (lang === 'en') continue;
  const missing = Object.keys(LINES).filter((k) => !p.lines[k]);
  check(missing.length === 0, `dialogue ${lang}: missing ${missing.length} bucket(s): ${missing.slice(0, 6).join(', ')}`);
  const extra = Object.keys(p.lines).filter((k) => !LINES[k]);
  check(extra.length === 0, `dialogue ${lang}: has bucket(s) English does not: ${extra.join(', ')}`);
  for (const [k, v] of Object.entries(p.lines)) {
    if (!LINES[k]) continue;
    check(Array.isArray(v) && v.length > 0, `dialogue ${lang}: bucket "${k}" is empty`);
    const want = holes(LINES[k]);
    const got = holes(v);
    for (const h of want) check(got.has(h), `dialogue ${lang}: bucket "${k}" never uses ${h}`);
    for (const h of got) check(want.has(h), `dialogue ${lang}: bucket "${k}" uses ${h}, which English does not`);
  }
  const lines = Object.values(p.lines).reduce((s, v) => s + v.length, 0);
  console.log(`dialogue ${lang}: ${Object.keys(p.lines).length} buckets, ${lines} lines`);
}

// --- every interface language covers English, with the same placeholders
for (const [lang, table] of Object.entries(STRINGS)) {
  if (lang === 'en') continue;
  const missing = Object.keys(STRINGS.en).filter((k) => !table[k]);
  check(missing.length === 0,
    `i18n ${lang}: missing ${missing.length} string(s): ${missing.slice(0, 6).join(', ')}`);
  const extra = Object.keys(table).filter((k) => !STRINGS.en[k]);
  check(extra.length === 0, `i18n ${lang}: has string(s) English does not: ${extra.join(', ')}`);
  for (const [k, v] of Object.entries(table)) {
    if (!STRINGS.en[k]) continue;
    const want = new Set(STRINGS.en[k].match(/\{\w+\}/g) || []);
    const got = new Set(v.match(/\{\w+\}/g) || []);
    for (const h of want) check(got.has(h), `i18n ${lang}: "${k}" never uses ${h}`);
    for (const h of got) check(want.has(h), `i18n ${lang}: "${k}" uses ${h}, which English does not`);
  }
  console.log(`i18n ${lang}: ${Object.keys(table).length} strings`);
}

// Every wearable, shape and coat needs a label in every language, or the picker
// shows a raw key.
for (const k of ACCESSORY_KEYS) check(STRINGS.en[`acc.${k}`], `no English label for wearable "${k}"`);
for (const k of EMOTION_KEYS) check(STRINGS.en[`emotion.${k}`], `no English label for emotion "${k}"`);
for (const k of Object.keys(DATA.shapes)) check(STRINGS.en[`shape.${k}`], `no English label for shape "${k}"`);
for (const c of COATS) check(STRINGS.en[`coat.${c.key}`], `no English label for coat "${c.key}"`);

// --- dialogue keys referenced by behaviour actually exist
const dialogue = readFileSync('src/renderer/lib/dialogue.js', 'utf8');
const defined = new Set([...dialogue.matchAll(/^  (\w+): \[/gm)].map((m) => m[1]));
const used = new Set();
for (const f of ['src/renderer/lib/behavior.js', 'src/renderer/mascot.js']) {
  for (const m of readFileSync(f, 'utf8').matchAll(/say\('(\w+)'\)/g)) used.add(m[1]);
  for (const m of readFileSync(f, 'utf8').matchAll(/say\(pick\(\[([^\]]+)\]\)\)/g)) {
    for (const q of m[1].matchAll(/'(\w+)'/g)) used.add(q[1]);
  }
}
for (const k of used) check(defined.has(k), `dialogue key "${k}" used but not defined`);
console.log(`dialogue buckets: ${defined.size}, referenced: ${used.size}`);

console.log(fail ? `\n${fail} FAILURES` : '\nall checks passed');
process.exit(fail ? 1 : 0);
