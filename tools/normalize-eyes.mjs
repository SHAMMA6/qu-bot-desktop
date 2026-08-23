// Centre every expression's eye pair on the head.
//
//   node tools/normalize-eyes.mjs [--check]
//
// The expression rings were traced rather than constructed, so each of the 25
// carried its own untracked offset: the pair centre wandered from 43 units left
// of the head's axis to 76 right, and the neutral face sat 15 units right. That
// is the whole gaze range (`15 * gazeGain`) spent before the bot has looked at
// anything, so it read as permanently glancing right and had nowhere left to go
// when the cursor actually was on the right.
//
// Position is not what an expression is for. `face.x/face.y` place the pair per
// body shape, `gaze` aims it, `lidBias` droops it — the ring geometry only has
// to carry the *shape* of the eyes. So each pair is translated as a rigid unit
// onto one anchor, which leaves every expression's internal geometry (per-eye
// tilt, height difference, separation — all the things that actually read as an
// expression) exactly as drawn.
//
// Idempotent: a centred file normalises to itself, so this is safe to re-run
// after any future regeneration, and `--check` reports without writing.

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'src/shared/mascot-data.js';
const MARKER = 'export default ';

// Where the pair is centred. X is the head's own axis. Y is the neutral face's
// existing eye line, so idle — the face on screen most of the time — keeps the
// height it was drawn at and only ever moved sideways.
const ANCHOR_Y = 115.45;

const round = (n) => Math.round(n * 100) / 100;

function pairCentre(expr) {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const ring of expr) for (const [px, py] of ring) { x += px; y += py; n++; }
  return [x / n, y / n];
}

const src = readFileSync(FILE, 'utf8');
const at = src.indexOf(MARKER);
if (at < 0) throw new Error(`${FILE}: no "${MARKER}" found`);
const header = src.slice(0, at);
const data = JSON.parse(src.slice(at + MARKER.length).replace(/;\s*$/, ''));

const anchorX = data.HEAD_C;
const moves = [];

for (const expr of data.expressions) {
  const [cx, cy] = pairCentre(expr);
  const dx = anchorX - cx;
  const dy = ANCHOR_Y - cy;
  moves.push([dx, dy]);
  for (const ring of expr) {
    for (const p of ring) {
      p[0] = round(p[0] + dx);
      p[1] = round(p[1] + dy);
    }
  }
}

const worst = moves.reduce((a, [dx, dy]) => Math.max(a, Math.hypot(dx, dy)), 0);
const meanX = moves.reduce((a, [dx]) => a + dx, 0) / moves.length;

console.log(`expressions: ${data.expressions.length}`);
console.log(`largest correction: ${worst.toFixed(2)} units`);
console.log(`mean horizontal correction: ${meanX.toFixed(2)} units`);
moves.forEach(([dx, dy], i) => {
  if (Math.hypot(dx, dy) > 0.02) console.log(`  ${String(i).padStart(2)}  dx ${dx.toFixed(2).padStart(7)}  dy ${dy.toFixed(2).padStart(7)}`);
});

if (process.argv.includes('--check')) {
  console.log(worst < 0.05 ? '\nalready centred' : '\nNOT centred — run without --check to fix');
  process.exit(worst < 0.05 ? 0 : 1);
}

writeFileSync(FILE, `${header}${MARKER}${JSON.stringify(data)};\n`, 'utf8');
console.log(`\nwrote ${FILE}`);
