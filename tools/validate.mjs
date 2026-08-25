// Data integrity checks for the character definition. Catches the failure modes
// that are invisible until you happen to trigger the right emotion: an expression
// index out of range, an effect name with no emitter, a coat whose eyes vanish
// into it, a dialogue bucket that was renamed but still referenced.
//
//   npm test

import { readFileSync } from 'fs';
import { EMOTIONS, EMOTION_KEYS, EMOTION_GROUPS } from '../src/renderer/lib/emotions.js';
import DATA from '../src/shared/mascot-data.js';
import {
  COATS, GRADIENTS, GRADIENT_STOPS, resolveCoat, contrast,
  inkForGradient, normalizeGradient, gradientVector, rgba,
} from '../src/shared/themes.js';
import { LINES, PACKS, SIDE } from '../src/renderer/lib/dialogue.js';
import { STRINGS } from '../src/shared/i18n.js';
import { ACCESSORY_KEYS } from '../src/renderer/lib/mark.js';
import { MOVES, MOVE_KEYS, MOVES_BY_TAG, EMOTION_MOVES, Choreo } from '../src/renderer/lib/moves.js';
import { Sound } from '../src/renderer/lib/sound.js';

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

// --- moves
//
// A gesture fails silently in every way that matters: a bad `fx` name emits
// nothing, a bad `sound` name is inaudible, and a pose function that returns
// NaN for one frame teleports the body somewhere it can never come back from.
// None of that throws, so none of it is visible until someone happens to
// trigger the one gesture that is broken.
console.log(`moves: ${MOVE_KEYS.length}, tags: ${Object.keys(MOVES_BY_TAG).length}`);
const soundCues = Sound.prototype;

for (const [k, m] of Object.entries(MOVES)) {
  check(m.dur > 0 && m.dur < 12, `move ${k}: implausible duration ${m.dur}`);
  check(typeof m.pose === 'function' || typeof m.path === 'function',
    `move ${k}: has neither a pose nor a path, so it does nothing`);
  check(Array.isArray(m.tags) && m.tags.length > 0, `move ${k}: no tags, so nothing can ever pick it`);
  check(!m.fx || spawnNames.includes(m.fx), `move ${k}: unknown fx "${m.fx}"`);
  check(!m.sound || typeof soundCues[m.sound] === 'function', `move ${k}: no sound cue named "${m.sound}"`);
}

// Run every gesture start to finish and watch for a non-finite frame. Cheap,
// and it is the only check that would catch a divide-by-zero at u === 1.
for (const k of MOVE_KEYS) {
  const c = new Choreo();
  c.play(k);
  let bad = null;
  for (let i = 0; i < 2000 && c.active; i++) {
    const o = c.update(1 / 60);
    for (const f of ['x', 'y', 'rot', 'sx', 'sy', 'lid']) {
      if (!Number.isFinite(o[f])) bad ||= `${f}=${o[f]}`;
    }
    if (c.path && !(Number.isFinite(c.path.x) && Number.isFinite(c.path.y))) bad ||= 'path';
  }
  check(!bad, `move ${k}: produced a non-finite frame (${bad})`);
}

for (const [emotion, pool] of Object.entries(EMOTION_MOVES)) {
  check(!!EMOTIONS[emotion], `EMOTION_MOVES references missing emotion "${emotion}"`);
  for (const m of pool) check(!!MOVES[m], `EMOTION_MOVES[${emotion}] references missing move "${m}"`);
}

// --- every move and tag named in code actually exists
//
// `play('backflp')` is a no-op, not an error, so a typo costs you a gesture
// with no way to notice. Argument text is read by walking the parentheses
// rather than by regex, because half these calls have a pick() or a ternary
// inside them and a non-greedy match stops at the wrong bracket.
function callArgs(src, fnName) {
  const out = [];
  const needle = fnName + '(';
  let i = src.indexOf(needle);
  while (i !== -1) {
    let depth = 0;
    let j = i + needle.length - 1;
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')') { depth--; if (depth === 0) break; }
    }
    out.push(src.slice(i + needle.length, j));
    i = src.indexOf(needle, j);
  }
  return out;
}

const quoted = (s) => [...s.matchAll(/'([\w-]+)'/g)].map((m) => m[1]);

for (const f of ['src/renderer/mascot.js', 'src/renderer/lib/behavior.js']) {
  const src = readFileSync(f, 'utf8');
  // play('name') / choreo.play('name')
  for (const args of callArgs(src, 'play')) {
    // Only the first argument names the move; the rest is an options object,
    // whose keys are not quoted, so quoted strings past a comma are still moves
    // (a ternary) unless they sit inside braces.
    const head = args.split(/,\s*\{/)[0];
    for (const name of quoted(head)) {
      check(!!MOVES[name], `${f}: play('${name}') — no such move`);
    }
  }
  for (const args of callArgs(src, 'playTagged')) {
    for (const tag of quoted(args.split(/,\s*\{/)[0])) {
      check(!!MOVES_BY_TAG[tag], `${f}: playTagged('${tag}') — no move carries that tag`);
    }
  }
  // Intents: { type: 'move', key: ... } and { type: 'moveTag', tag: ... }
  for (const m of src.matchAll(/type: 'move', key: ([^}]+)\}/g)) {
    for (const name of quoted(m[1])) check(!!MOVES[name], `${f}: move intent '${name}' — no such move`);
  }
  for (const m of src.matchAll(/type: 'moveTag', tag: ([^}]+)\}/g)) {
    for (const tag of quoted(m[1])) {
      check(!!MOVES_BY_TAG[tag], `${f}: moveTag '${tag}' — no move carries that tag`);
    }
  }
}

// --- side words resolve to real buckets
for (const [kind, bucket] of Object.entries(SIDE)) {
  check(Array.isArray(LINES[bucket]) && LINES[bucket].length > 0,
    `side word "${kind}" points at bucket "${bucket}", which is missing or empty`);
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

// --- gradients: readable against EVERY stop, not merely on average
//
// The eyes sit on one part of the body, but which part moves with the shape,
// the expression and where it is looking — so a gradient that is only legible
// at its midpoint is a gradient whose eyes vanish whenever it glances left.
for (const g of GRADIENTS) {
  check(g.colors.length === GRADIENT_STOPS, `gradient ${g.key}: ${g.colors.length} stops, expected ${GRADIENT_STOPS}`);
  for (const c of g.colors) check(/^#[0-9a-fA-F]{6}$/.test(c), `gradient ${g.key}: bad colour "${c}"`);
  const { ink, ratio } = inkForGradient(g.colors);
  check(ratio >= 3, `gradient ${g.key}: eyes only reach ${ratio.toFixed(2)}:1 against its worst stop`);
  const resolved = resolveCoat('gradient', null, g);
  check(resolved.gradient && resolved.ink === ink,
    `gradient ${g.key}: resolveCoat disagrees with inkForGradient`);
  check(STRINGS.en[`gradient.${g.key}`], `no English label for gradient "${g.key}"`);
}

// A settings file can carry a half-written gradient — an old build, a hand edit,
// a colour picker that was mid-drag when the app quit. None of that may reach
// the renderer as `undefined`, which paints the body with nothing at all.
for (const junk of [null, undefined, {}, { colors: [] }, { colors: ['#ff0000'] },
  { colors: ['nope', 12, null], angle: 'sideways' }, { colors: ['#ff0000', '#00ff00'], angle: -900 }]) {
  const g = normalizeGradient(junk);
  check(g.colors.length === GRADIENT_STOPS && g.colors.every((c) => /^#[0-9a-fA-F]{6}$/.test(c)),
    `normalizeGradient(${JSON.stringify(junk)}) produced ${JSON.stringify(g.colors)}`);
  check(Number.isFinite(g.angle) && g.angle >= 0 && g.angle < 360,
    `normalizeGradient(${JSON.stringify(junk)}) produced angle ${g.angle}`);
}

// The angle has to actually turn the gradient, and stay inside the bounding box.
for (const angle of [0, 45, 90, 135, 180, 270, 359]) {
  const v = gradientVector(angle);
  for (const [k, n] of Object.entries(v)) {
    check(Number.isFinite(n) && n >= -0.001 && n <= 1.001, `gradientVector(${angle}).${k} = ${n}`);
  }
}
const flat = gradientVector(0);
const turned = gradientVector(90);
check(Math.abs(flat.x1 - turned.x1) > 0.4, 'gradientVector: 0deg and 90deg point the same way');

check(rgba('#3C82F6', 0.5) === 'rgba(60, 130, 246, 0.5)', `rgba() produced ${rgba('#3C82F6', 0.5)}`);

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
