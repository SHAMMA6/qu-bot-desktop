// The gestures nobody is told about: hugging, shaking, winding the cursor
// around it, loitering beside it, staring at it.
//
// Every rule in gestures.js is a threshold that was tuned against a real hand,
// and a threshold is the thing most likely to drift under a refactor and then
// only be noticed as "it does not do that any more". These drive the module with
// synthetic cursor paths and check both halves of each rule: that the gesture
// fires when it should, and — the half that actually matters — that ordinary
// mouse use never trips it.
//
//   node tools/test-gestures.mjs

import { Gestures } from '../src/renderer/lib/gestures.js';
import { Choreo, MOVES } from '../src/renderer/lib/moves.js';

let failures = 0;
const results = [];
const check = (ok, msg) => { if (!ok) { failures++; results.push('  FAIL: ' + msg); } };

const BODY = { x: 800, y: 500 };
const RADIUS = 64;
const FPS = 1 / 60;

// Drive the module along a path. `path(i)` returns the cursor position for
// frame i; anything in `ctx` overrides the defaults.
function run(g, frames, path, ctx = {}) {
  const seen = [];
  for (let i = 0; i < frames; i++) {
    const cursor = { ...path(i), has: true };
    for (const ev of g.update(FPS, {
      cursor, body: BODY, radius: RADIUS, dragging: false,
      onBody: Math.hypot(cursor.x - BODY.x, cursor.y - BODY.y) <= RADIUS * 1.04,
      asleep: false, speed: 0, ...ctx,
    })) seen.push(ev.type);
  }
  return seen;
}

// ---------------------------------------------------------------- the hug
function testHoldingStillIsAHug() {
  const g = new Gestures();
  g.grabbed();
  const seen = run(g, 90, () => ({ x: 900, y: 400 }), { dragging: true });
  check(seen.filter((e) => e === 'hug').length === 1,
    `holding it still for 1.5s should be exactly one hug, got ${seen.filter((e) => e === 'hug').length}`);
  results.push('  picking it up and going nowhere reads as a hug, once');
}

function testCarryingItIsNotAHug() {
  const g = new Gestures();
  g.grabbed();
  // Moved steadily across the screen: this is relocation, not affection.
  const seen = run(g, 120, (i) => ({ x: 400 + i * 6, y: 400 }), { dragging: true });
  check(!seen.includes('hug'), 'carrying it somewhere was mistaken for a hug');
  results.push('  carrying it across the desktop is not a hug');
}

function testReleaseReportsTheHugOnce() {
  const g = new Gestures();
  g.grabbed();
  run(g, 90, () => ({ x: 900, y: 400 }), { dragging: true });
  check(g.released() === true, 'letting go after a hug did not report it');
  check(g.released() === false, 'letting go reported the same hug twice');
  results.push('  letting go reports the hug exactly once');
}

// ---------------------------------------------------------------- shaking
function testShakingIsDetected() {
  const g = new Gestures();
  g.grabbed();
  // ~4Hz, 40px each way: what a hand actually does when it shakes something.
  const seen = run(g, 120, (i) => ({ x: 800 + Math.sin(i * 0.42) * 40, y: 400 }), { dragging: true });
  check(seen.includes('shaken'), 'shaking it side to side was not noticed');
  results.push('  shaking it while held is noticed');
}

function testAWanderingCarryIsNotShaking() {
  const g = new Gestures();
  g.grabbed();
  // A slow, meandering carry: it does double back, but never quickly.
  const seen = run(g, 300, (i) => ({ x: 800 + Math.sin(i * 0.02) * 300, y: 400 }), { dragging: true });
  check(!seen.includes('shaken'), 'a slow meandering drag was mistaken for shaking');
  results.push('  a slow meandering drag is not shaking');
}

function testShakingDoesNotRepeatEveryFrame() {
  const g = new Gestures();
  g.grabbed();
  const seen = run(g, 600, (i) => ({ x: 800 + Math.sin(i * 0.42) * 40, y: 400 }), { dragging: true });
  const n = seen.filter((e) => e === 'shaken').length;
  check(n >= 1 && n <= 3, `10s of continuous shaking fired ${n} times; expected a handful, not a stream`);
  results.push(`  sustained shaking stays rate-limited (${n} in 10s)`);
}

// ---------------------------------------------------------------- circling
function testCirclingMakesItDizzy() {
  const g = new Gestures();
  // Three full laps at 1.8 radii out.
  const seen = run(g, 240, (i) => {
    const a = (i / 80) * Math.PI * 2;
    return { x: BODY.x + Math.cos(a) * RADIUS * 1.8, y: BODY.y + Math.sin(a) * RADIUS * 1.8 };
  });
  check(seen.includes('orbited'), 'circling the cursor around it three times did nothing');
  results.push('  winding the cursor around it registers as an orbit');
}

function testBackAndForthIsNotCircling() {
  const g = new Gestures();
  // Sweeping past it, over and over. Plenty of angular movement, no net winding.
  const seen = run(g, 600, (i) => ({
    x: BODY.x + Math.sin(i * 0.06) * RADIUS * 2, y: BODY.y - RADIUS * 1.6,
  }));
  check(!seen.includes('orbited'), 'sweeping back and forth past it was counted as circling');
  results.push('  sweeping back and forth past it is not circling');
}

function testCirclingFarAwayIsIgnored() {
  const g = new Gestures();
  const seen = run(g, 400, (i) => {
    const a = (i / 80) * Math.PI * 2;
    return { x: BODY.x + Math.cos(a) * RADIUS * 9, y: BODY.y + Math.sin(a) * RADIUS * 9 };
  });
  check(!seen.includes('orbited'), 'circling on the far side of the screen still made it dizzy');
  results.push('  circling far away from it is ignored');
}

// ---------------------------------------------------------------- loitering
function testLoiteringNearbyIsNoticed() {
  const g = new Gestures();
  const seen = run(g, 150, () => ({ x: BODY.x + RADIUS * 2, y: BODY.y }));
  check(seen.includes('hoverNear'), 'the cursor parked beside it went unnoticed');
  results.push('  the cursor loitering beside it is noticed');
}

function testLoiteringIsRateLimited() {
  const g = new Gestures();
  const seen = run(g, 1200, () => ({ x: BODY.x + RADIUS * 2, y: BODY.y }));
  const n = seen.filter((e) => e === 'hoverNear').length;
  check(n === 1, `20s of a parked cursor produced ${n} reactions; it must not nag`);
  results.push('  a cursor left beside it does not nag (1 reaction in 20s)');
}

function testFocusModeSuppressesTheSocialOnes() {
  const g = new Gestures();
  const seen = run(g, 900, () => ({ x: BODY.x + RADIUS * 2, y: BODY.y }), { quiet: true });
  check(seen.length === 0, `focus mode still produced ${seen.join(', ')}`);
  results.push('  focus mode suppresses the gestures that start a conversation');
}

// ---------------------------------------------------------------- staring
function testStaringContestIsWinnable() {
  const g = new Gestures();
  const seen = run(g, 720, () => ({ x: BODY.x, y: BODY.y }), { onBody: true });
  check(seen.includes('stare'), 'holding the cursor on it never started a staring contest');
  check(seen.includes('stareLost'), 'the bot never blinked, so the contest cannot be won');
  check(seen.indexOf('stare') < seen.indexOf('stareLost'), 'it blinked before the contest started');
  results.push('  a staring contest starts, and it always blinks first');
}

function testMovingBreaksTheStare() {
  const g = new Gestures();
  const seen = run(g, 720, (i) => ({ x: BODY.x + (i % 2) * 3, y: BODY.y }), { onBody: true, speed: 400 });
  check(!seen.includes('stare'), 'a moving cursor still started a staring contest');
  results.push('  a moving cursor does not start a staring contest');
}

// ---------------------------------------------------------------- poking
function testPokingEscalates() {
  const g = new Gestures();
  const rungs = [];
  for (let i = 0; i < 12; i++) rungs.push(g.poke(0.7));
  check(rungs[0] === 0, `the first poke landed at rung ${rungs[0]}, expected 0`);
  check(rungs[4] === 1, `the fifth poke landed at rung ${rungs[4]}, expected 1`);
  check(rungs[7] === 2, `the eighth poke landed at rung ${rungs[7]}, expected 2`);
  check(rungs[11] === 3, `the twelfth poke landed at rung ${rungs[11]}, expected 3`);
  check(rungs.every((r, i) => i === 0 || r >= rungs[i - 1]), `escalation went backwards: ${rungs}`);
  results.push(`  poking escalates 0 -> 3 and never backwards (${rungs.join('')})`);
}

function testPokeStreakCoolsOff() {
  const g = new Gestures();
  for (let i = 0; i < 8; i++) g.poke(0.7);
  // Four seconds of nothing.
  run(g, 240, () => ({ x: 0, y: 0 }));
  check(g.poke(0.7) === 0, 'the poke streak did not cool off after four quiet seconds');
  results.push('  the poke streak cools off after a few quiet seconds');
}

function testAGrumpyBotIsQuickerToBeAnnoyed() {
  const happy = new Gestures();
  const grumpy = new Gestures();
  check(happy.poke(0.9) === 0, 'a cheerful bot was annoyed by the first poke');
  check(grumpy.poke(0.1) === 1, 'a bot in a bad mood shrugged off the first poke');
  results.push('  mood decides whether the first poke is welcome');
}

// ---------------------------------------------------------------- gestures
// How far the body transform moves between two frames, as one number. Rotation
// is compared as a shortest turn — passing through 359 -> 1 degrees moved two
// degrees, not 358 — and scale is weighted up because a 5% squash is far more
// visible than five units of travel.
function delta(a, b) {
  let dr = b.rot - a.rot;
  dr -= Math.round(dr / 360) * 360;
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + Math.abs(dr) * 0.35
    + (Math.abs(b.sx - a.sx) + Math.abs(b.sy - a.sy)) * 60 + Math.abs(b.lid - a.lid) * 40;
}

// Look for a *discontinuity*, not for speed. A barrel roll legitimately moves a
// long way every frame, and a hiccup is supposed to be a jerk; calling either a
// snap would only mean no gesture is allowed to be quick.
//
// What separates the two is how they behave when sampled more finely. Smooth
// motion, however fast, moves proportionally less per step as the step shrinks;
// a step function jumps the same distance no matter how closely you look. So
// these run at 480Hz, where anything still moving several units in one step is
// a genuine tear rather than an animator in a hurry.
const FINE = 1 / 480;

function worstDiscontinuity(key) {
  const c = new Choreo();
  c.play(key);
  let prev = null;
  let worst = 0;
  let at = 0;
  for (let i = 0; i < 24000; i++) {
    const o = c.update(FINE);
    if (prev) {
      const d = delta(prev, o);
      if (d > worst) { worst = d; at = i * FINE; }
    }
    prev = { ...o };
    if (!c.active && !c.release) break;
  }
  return { worst, at };
}

function testNoGestureSnaps() {
  // A gesture is allowed to end mid-pose — slumped, tilted, still squashed. It
  // is not allowed to teleport on one frame, which is what six of them did
  // before this check existed, and what all of them did on release.
  const bad = [];
  for (const [key, m] of Object.entries(MOVES)) {
    // A glitch is *defined* by discontinuity. Exempting it by name here is the
    // honest version of the rule, rather than quietly loosening it for all.
    if (m.tags.includes('glitch')) continue;
    const { worst, at } = worstDiscontinuity(key);
    if (worst > 4) bad.push(`${key} (${worst.toFixed(1)} at ${at.toFixed(2)}s)`);
  }
  check(bad.length === 0, `these gestures jump discontinuously: ${bad.join(', ')}`);
  results.push(`  no gesture snaps, mid-move or on release (${Object.keys(MOVES).length} checked)`);
}

function testTheSnapDetectorActuallyDetectsSnaps() {
  // The first version of this test compared the runner's output after the move
  // had already been zeroed, so it passed for every possible input. A check
  // that cannot fail is worse than no check, so this one proves itself against
  // a gesture built to be broken.
  MOVES.__probe = {
    dur: 1, tags: ['test'],
    pose: (u) => ({ y: u < 0.5 ? 0 : -30, rot: 0 }),
  };
  const { worst } = worstDiscontinuity('__probe');
  delete MOVES.__probe;
  check(worst > 4, `a deliberate 30-unit step scored only ${worst.toFixed(1)} — the detector is blind`);
  results.push('  the snap detector catches a deliberately broken gesture');
}

function testEveryMoveFinallyReachesRest() {
  const bad = [];
  for (const key of Object.keys(MOVES)) {
    const c = new Choreo();
    c.play(key);
    for (let i = 0; i < 3000 && (c.active || c.release); i++) c.update(FPS);
    const o = c.update(FPS);
    const off = Math.abs(o.x) + Math.abs(o.y) + Math.abs(o.rot)
      + Math.abs(o.sx - 1) + Math.abs(o.sy - 1) + Math.abs(o.lid);
    if (off > 1e-6 || c.active || c.release) bad.push(key);
  }
  check(bad.length === 0, `these gestures never let the body go: ${bad.join(', ')}`);
  results.push('  every gesture eventually hands the body back');
}

function testTheBodyIsNeverLeftMirrored() {
  // Scale passing through zero is a mirror flip. coinFlip does it deliberately,
  // mid-move; nothing may finish that way.
  const bad = [];
  for (const [key, m] of Object.entries(MOVES)) {
    if (!m.pose) continue;
    const p = m.pose(1, m.dur) || {};
    if ((p.sx ?? 1) <= 0 || (p.sy ?? 1) <= 0) bad.push(key);
  }
  check(bad.length === 0, `these gestures end with the body inside out: ${bad.join(', ')}`);
  results.push('  no gesture leaves the body mirrored');
}

function testAChainPlaysEveryBeat() {
  const c = new Choreo();
  const started = [];
  c.onStart = (k) => started.push(k);
  c.chain(['nod', 'wiggle', 'bow']);
  for (let i = 0; i < 1200 && (c.active || started.length < 3); i++) c.update(FPS);
  check(started.join(',') === 'nod,wiggle,bow', `a chain played ${started.join(',') || 'nothing'}`);
  results.push('  a chained combo plays every beat, in order');
}

function testDisablingGesturesStopsThem() {
  const c = new Choreo();
  c.enabled = false;
  check(c.play('backflip') === false, 'a disabled Choreo still accepted a move');
  check(!c.active, 'a disabled Choreo is somehow mid-gesture');
  results.push('  turning gestures off really stops them');
}

console.log('gestures');
testHoldingStillIsAHug();
testCarryingItIsNotAHug();
testReleaseReportsTheHugOnce();
testShakingIsDetected();
testAWanderingCarryIsNotShaking();
testShakingDoesNotRepeatEveryFrame();
testCirclingMakesItDizzy();
testBackAndForthIsNotCircling();
testCirclingFarAwayIsIgnored();
testLoiteringNearbyIsNoticed();
testLoiteringIsRateLimited();
testFocusModeSuppressesTheSocialOnes();
testStaringContestIsWinnable();
testMovingBreaksTheStare();
testPokingEscalates();
testPokeStreakCoolsOff();
testAGrumpyBotIsQuickerToBeAnnoyed();
testNoGestureSnaps();
testTheSnapDetectorActuallyDetectsSnaps();
testEveryMoveFinallyReachesRest();
testTheBodyIsNeverLeftMirrored();
testAChainPlaysEveryBeat();
testDisablingGesturesStopsThem();

console.log(results.join('\n'));
console.log(failures ? `\n${failures} FAILURES` : '\nall gesture checks passed');
process.exit(failures ? 1 : 0);
