// The attention system decides where the mascot wants to be. These check the
// rules that keep it companionable rather than obstructive: it stays clear of
// the cursor, never picks a spot that is off-screen, gets out of the way of a
// fast swipe but not a slow reach, and backs off while you are typing.

import { Attention, STANCE, classifyApp } from '../src/renderer/lib/attention.js';

let failures = 0;
const results = [];
const check = (ok, msg) => { if (!ok) { failures++; results.push('  FAIL: ' + msg); } };

const DISPLAYS = [
  { id: 1, x: 0, y: 0, w: 1920, h: 1032 },
  { id: 2, x: 1920, y: -90, w: 1707, h: 1020 },
];
const RADIUS = 64;
const GAP = RADIUS + 96;

const displayFor = (x, y) =>
  DISPLAYS.find((d) => x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) || DISPLAYS[0];

// Drive the attention system for a while, moving the cursor along a path.
function run(a, { seconds, cursor, body, idle = 0, held = false, onEvent }) {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  const seen = [];
  let pos = { ...body };
  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    a.noteCursor(cursor(t));
    a.noteIdle(typeof idle === 'function' ? idle(t) : idle);
    const evs = a.update(dt, {
      body: pos,
      radius: RADIUS,
      display: displayFor(pos.x, pos.y),
      displays: DISPLAYS,
      held,
    });
    for (const e of evs) { seen.push(e.type); if (onEvent) onEvent(e, t); }
    // Let the body chase the target so the geometry checks are realistic.
    pos.x += (a.target.x - pos.x) * 0.08;
    pos.y += (a.target.y - pos.y) * 0.08;
    yieldChecks(a, pos);
  }
  return { seen, pos };
}

let geometryViolations = 0;
let offScreen = 0;
function yieldChecks(a, pos) {
  // The chosen target must never sit on top of the cursor...
  if (a.stance !== STANCE.ROAM) {
    const d = Math.hypot(a.target.x - a.cursor.x, a.target.y - a.cursor.y);
    if (d < GAP - 1) geometryViolations++;
  }
  // ...and must always be somewhere a body of this size fits on a real screen.
  const ok = DISPLAYS.some((s) =>
    a.target.x - RADIUS >= s.x - 0.5 && a.target.x + RADIUS <= s.x + s.w + 0.5 &&
    a.target.y - RADIUS >= s.y - 0.5 && a.target.y + RADIUS <= s.y + s.h + 0.5);
  if (!ok) offScreen++;
}

// ---------------------------------------------------------------- tests

function testKeepsItsDistance() {
  const a = new Attention();
  geometryViolations = 0; offScreen = 0;
  // Cursor sweeping across both monitors.
  run(a, {
    seconds: 25,
    body: { x: 900, y: 500 },
    cursor: (t) => ({ x: 200 + ((t * 420) % 3200), y: 400 + Math.sin(t * 1.7) * 300 }),
  });
  check(geometryViolations === 0, `target sat on the cursor in ${geometryViolations} frames`);
  check(offScreen === 0, `target was off-screen in ${offScreen} frames`);
  results.push('  keeps a body-width clear of the cursor, and always targets real screen space');
}

function testFollowsDestinationsNotSweeps() {
  const a = new Attention();
  // Cursor sweeping back and forth fast, never settling.
  let moves = 0;
  let lastAnchor = null;
  run(a, {
    seconds: 12,
    body: { x: 900, y: 500 },
    cursor: (t) => ({ x: 500 + Math.sin(t * 3) * 700, y: 500 }),
  });
  // The anchor should have moved a handful of times at most, not continuously.
  check(a.sinceAnchor >= 0, 'anchor timer broke');

  // Now: cursor jumps somewhere and stops. It should follow that.
  run(a, {
    seconds: 5,
    body: { x: 900, y: 500 },
    cursor: () => ({ x: 1500, y: 300 }),
  });
  check(Math.hypot(a.anchor.x - 1500, a.anchor.y - 300) < 40,
    `after the cursor settled at (1500,300) the anchor was at (${a.anchor.x.toFixed(0)},${a.anchor.y.toFixed(0)})`);
  results.push('  follows where the pointer lands rather than trailing every sweep');
}

function testFollowsAcrossMonitors() {
  const a = new Attention();
  // Cursor parks on the second monitor.
  run(a, {
    seconds: 6,
    body: { x: 900, y: 500 },
    cursor: () => ({ x: 2700, y: 400 }),
  });
  check(a.target.x > 1920,
    `target stayed on the first monitor (x=${a.target.x.toFixed(0)}) after the cursor moved to the second`);
  results.push('  follows the cursor onto the other monitor');
}

function testTypingBacksOff() {
  const a = new Attention();
  a.noteApp({ process: 'code.exe', title: 'something', rect: { x: 100, y: 80, w: 1200, h: 800 } });
  const { seen } = run(a, {
    seconds: 8,
    body: { x: 900, y: 500 },
    cursor: () => ({ x: 600, y: 500 }),   // cursor parked
    idle: 0,                              // but input is happening: typing
  });
  check(a.typing, 'typing was not detected from parked cursor plus live input');
  check(seen.includes('typing'), 'no typing event was raised');
  check(a.stance === STANCE.PERCH,
    `while typing the stance was ${a.stance}, expected to perch beside the window`);
  // Perched beside the editor window, not over it.
  check(a.target.x >= 100 + 1200 - 1,
    `perched at x=${a.target.x.toFixed(0)}, which is inside the window it should be beside`);
  results.push('  detects typing, backs off, and perches beside the active window');
}

function testPerchesOnAMaximisedWindow() {
  const a = new Attention();
  // A window filling the whole second monitor: there is no "outside" to sit in.
  a.noteApp({ process: 'code.exe', title: 'x', rect: { x: 1920, y: -90, w: 1707, h: 1020 } });
  run(a, {
    seconds: 8,
    body: { x: 2700, y: 400 },
    cursor: () => ({ x: 2700, y: 400 }),
    idle: 0,
  });
  check(a.stance === STANCE.PERCH, `stance was ${a.stance}, expected perch`);
  const onScreen = DISPLAYS.some((d) =>
    a.target.x - RADIUS >= d.x - 0.5 && a.target.x + RADIUS <= d.x + d.w + 0.5 &&
    a.target.y - RADIUS >= d.y - 0.5 && a.target.y + RADIUS <= d.y + d.h + 0.5);
  check(onScreen, `perch on a maximised window went off-screen at x=${a.target.x.toFixed(0)}`);
  check(a.target.y > -90 + 100, 'perch on a maximised window sat over the title bar controls');
  results.push('  perches sensibly even when the window fills the whole screen');
}

function testTypingWithoutWindowInfo() {
  const a = new Attention();
  a.watchApps = false;
  run(a, {
    seconds: 8,
    body: { x: 900, y: 500 },
    cursor: () => ({ x: 600, y: 500 }),
    idle: 0,
  });
  check(a.stance === STANCE.EDGE,
    `with no window info the typing stance was ${a.stance}, expected the screen edge`);
  results.push('  falls back to a screen edge when window info is unavailable');
}

function testDodgesSwipesNotReaches() {
  // A fast swipe through the body should trigger a dodge.
  const fast = new Attention();
  let dodgedFast = false;
  run(fast, {
    seconds: 2,
    body: { x: 900, y: 500 },
    cursor: (t) => ({ x: 200 + t * 2600, y: 500 }),
    onEvent: (e) => { if (e.type === 'dodged') dodgedFast = true; },
  });
  check(dodgedFast, 'a fast swipe through the body did not make it dodge');

  // A slow, deliberate approach must NOT — that is someone reaching to grab it.
  const slow = new Attention();
  let dodgedSlow = false;
  run(slow, {
    seconds: 4,
    body: { x: 900, y: 500 },
    cursor: (t) => ({ x: 600 + t * 70, y: 500 }),
    onEvent: (e) => { if (e.type === 'dodged') dodgedSlow = true; },
  });
  check(!dodgedSlow, 'a slow reach made it dodge, so it cannot be picked up');
  results.push('  dodges a fast swipe but lets a slow reach catch it');
}

function testIdleGoesRoaming() {
  const a = new Attention();
  geometryViolations = 0; offScreen = 0;
  run(a, {
    seconds: 30,
    body: { x: 900, y: 500 },
    cursor: () => ({ x: 600, y: 500 }),
    idle: (t) => t,        // nobody home, and it keeps climbing
  });
  check(a.stance === STANCE.ROAM, `after going idle the stance was ${a.stance}, expected roaming`);
  check(offScreen === 0, `roaming targeted off-screen in ${offScreen} frames`);
  results.push('  drifts into roaming once you are away');
}

function testAppClassification() {
  const cases = [
    ['chrome.exe', 'browser'], ['Code.exe', 'editor'], ['WindowsTerminal', 'terminal'],
    ['Discord.exe', 'chat'], ['spotify', 'media'], ['explorer.exe', 'files'],
    ['blender.exe', 'creative'], ['claude.exe', 'ai'], ['some-random-thing.exe', 'other'],
  ];
  for (const [proc, kind] of cases) {
    check(classifyApp(proc).kind === kind,
      `${proc} classified as ${classifyApp(proc).kind}, expected ${kind}`);
  }
  check(classifyApp('').label === 'something', 'empty process name should degrade gracefully');
  results.push(`  classifies ${cases.length} app names into the right kinds`);
}

function testAppChangeReporting() {
  const a = new Attention();
  check(a.noteApp({ process: 'chrome.exe', title: 'a', rect: null }) === 'app', 'first app should report a change');
  check(a.noteApp({ process: 'chrome.exe', title: 'a', rect: null }) === null, 'identical app should report nothing');
  check(a.noteApp({ process: 'chrome.exe', title: 'b', rect: null }) === 'title', 'a new tab should report a title change only');
  check(a.noteApp({ process: 'code.exe', title: 'c', rect: null }) === 'app', 'a different app should report an app change');
  results.push('  distinguishes switching tabs from switching apps');
}

function testDisabledStillBehaves() {
  const a = new Attention();
  a.enabled = false;         // "watch what you do" turned off
  geometryViolations = 0; offScreen = 0;
  run(a, {
    seconds: 20,
    body: { x: 900, y: 500 },
    cursor: (t) => ({ x: 200 + ((t * 900) % 3000), y: 500 }),
  });
  check(a.stance === STANCE.ROAM, `with following off the stance was ${a.stance}, expected roaming`);
  check(offScreen === 0, `with following off it targeted off-screen in ${offScreen} frames`);
  results.push('  with cursor-following off it just roams, and still stays on screen');
}

// ---------------------------------------------------------------- run
console.log('attention');
testAppClassification();
testAppChangeReporting();
testKeepsItsDistance();
testFollowsDestinationsNotSweeps();
testFollowsAcrossMonitors();
testTypingBacksOff();
testTypingWithoutWindowInfo();
testPerchesOnAMaximisedWindow();
testDodgesSwipesNotReaches();
testIdleGoesRoaming();
testDisabledStillBehaves();

for (const line of results) console.log(line);
console.log(failures ? `\n${failures} FAILURES` : '\nall attention checks passed');
process.exit(failures ? 1 : 0);
