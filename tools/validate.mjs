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
