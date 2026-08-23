// The parts that make it a companion rather than a decoration: how it feels in
// the hand, how it counts the time you spend working, and whether its timers
// actually go off.
//
// These are all pure logic, so they run headlessly. `timers.cjs` is CommonJS and
// takes a store, which is faked here rather than dragged in from Electron.

import { Physics, MODE } from '../src/renderer/lib/physics.js';
import { Focus } from '../src/renderer/lib/focus.js';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { Timers } = require('../src/main/timers.cjs');
const { updateCapability } = require('../src/main/updater.cjs');

let failures = 0;
const results = [];
const check = (ok, msg) => { if (!ok) { failures++; results.push('  FAIL: ' + msg); } };

// ---------------------------------------------------------------- grab feel
// Drive a held body toward a fixed target and report how far behind it ends up.
function dragLag({ fps, seconds = 0.15, distance = 300 }) {
  const p = new Physics();
  p.setDisplays([{ x: 0, y: 0, w: 3000, h: 2000, id: 1 }]);
  p.place(500, 500);
  p.grab(500, 500);
  p.holdTarget.x = 500 + distance;
  p.holdTarget.y = 500;
  const dt = 1 / fps;
  for (let i = 0; i < Math.round(seconds * fps); i++) p.update(dt);
  return Math.abs(p.holdTarget.x - p.x);
}

function testGrabIsResponsive() {
  // Within 150ms of a 300px jump the body should have essentially caught up.
  // The old spring (stiffness 26, damped per frame) left ~90px of lag here,
  // which is what reads as "heavy" when you pick it up.
  const lag = dragLag({ fps: 60 });
  check(lag < 8, `after 150ms the body was still ${lag.toFixed(0)}px behind the cursor`);
  results.push(`  catches up to the cursor within 150ms (${lag.toFixed(1)}px behind)`);
}

function testGrabFeelsTheSameAtAnyRefreshRate() {
  // Damping applied per frame rather than per second makes a 144Hz screen feel
  // completely different from a 60Hz one. It must not.
  const a = dragLag({ fps: 60 });
  const b = dragLag({ fps: 144 });
  const c = dragLag({ fps: 30 });
  const spread = Math.max(a, b, c) - Math.min(a, b, c);
  check(spread < 8,
    `grab lag varied by ${spread.toFixed(1)}px across 30/60/144Hz (${a.toFixed(1)}/${b.toFixed(1)}/${c.toFixed(1)})`);
  results.push('  feels the same at 30, 60 and 144Hz');
}

function testGrabStaysStableWhenFramesStall() {
  // A stiff spring integrated in one big step diverges. dt is clamped to 0.1s
  // upstream, so that is the worst case it has to survive.
  const p = new Physics();
  p.setDisplays([{ x: 0, y: 0, w: 3000, h: 2000, id: 1 }]);
  p.place(500, 500);
  p.grab(500, 500);
  p.holdTarget.x = 1200;
  for (let i = 0; i < 40; i++) p.update(0.1);
  check(Number.isFinite(p.x) && Math.abs(p.x - 1200) < 5,
    `a stalling frame rate left the held body at x=${p.x.toFixed(0)}, expected ~1200`);
  results.push('  a stiff grab spring stays stable through 100ms frame stalls');
}

function testGrabWeightIsTunable() {
  const p = new Physics();
  p.setDisplays([{ x: 0, y: 0, w: 3000, h: 2000, id: 1 }]);
  const lagAt = (stiffness) => {
    p.holdStiffness = stiffness;
    p.place(500, 500);
    p.grab(500, 500);
    p.holdTarget.x = 800;
    for (let i = 0; i < 6; i++) p.update(1 / 60);
    return Math.abs(800 - p.x);
  };
  const heavy = lagAt(120);      // the low end of the grabResponse slider
  const snappy = lagAt(12120);   // the high end
  check(heavy > snappy * 2,
    `the grab weight slider barely changes anything (${heavy.toFixed(0)}px vs ${snappy.toFixed(0)}px)`);
  results.push('  the grab weight slider makes a real difference');
}

function testThrowVelocityComesFromTheCursor() {
  // Throw speed is sampled from cursor history, not from the body's spring, so
  // stiffening the spring must not change how hard a flick throws.
  const p = new Physics();
  p.setDisplays([{ x: 0, y: 0, w: 3000, h: 2000, id: 1 }]);
  p.place(500, 500);
  p.grab(500, 500);
  let t = 0;
  for (let i = 0; i < 8; i++) { t += 1 / 60; p.dragTo(500 + i * 40, 500, t); }
  const speed = p.release();
  check(p.mode === MODE.FLYING, 'releasing a drag should leave the body flying');
  check(speed > 1500 && speed < 3300, `a flick threw at ${speed.toFixed(0)}px/s, expected ~2400`);
  results.push(`  a flick still throws at cursor speed (${speed.toFixed(0)}px/s)`);
}

// ---------------------------------------------------------------- focus
function runFocus(f, { seconds, dt = 1, idle = 0 }) {
  const seen = [];
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    f.noteIdle(typeof idle === 'function' ? idle(i * dt) : idle);
    for (const e of f.update(dt, { chatty: true })) seen.push(e);
  }
  return seen;
}

function testCountsActiveTimeOnly() {
  const f = new Focus();
  f.noteApp('editor', 'your editor');
  runFocus(f, { seconds: 600 });                    // 10 minutes present
  runFocus(f, { seconds: 600, idle: 300 });         // 10 minutes away
  const r = f.report();
  check(r.minutes >= 9 && r.minutes <= 11,
    `counted ${r.minutes} minutes; leaving the window open while away should not count`);
  results.push(`  counts time you are actually there (${r.minutes} min, not 20)`);
}

function testAnnouncesLongStretchesOnce() {
  const f = new Focus();
  f.noteApp('editor', 'your editor');
  const seen = runFocus(f, { seconds: 70 * 60 });
  const long = seen.filter((e) => e.type === 'focusLong');
  check(long.length === 2, `expected the 30 and 60 minute marks, got ${long.length}`);
  check(long[0] && long[0].minutes === 30, 'the first milestone should be 30 minutes');
  check(long[1] && long[1].minutes === 60, 'the second milestone should be 60 minutes');
  results.push('  mentions 30 and 60 minute stretches, once each');
}

function testSwitchingAppsResetsTheClock() {
  const f = new Focus();
  f.noteApp('editor', 'your editor');
  runFocus(f, { seconds: 40 * 60 });
  f.noteApp('browser', 'the browser');
  runFocus(f, { seconds: 5 * 60 });
  check(f.report().minutes <= 6, `the clock did not reset on an app switch (${f.report().minutes} min)`);
  const banked = f.breakdown().find((r) => r.kind === 'editor');
  check(banked && banked.minutes >= 39, 'the time already spent in the editor was lost');
  // Asking twice must not double-count or reset anything.
  const first = f.breakdown();
  const second = f.breakdown();
  check(JSON.stringify(first) === JSON.stringify(second), 'asking for a breakdown changed the totals');
  results.push('  banks time per app, and reporting does not disturb the count');
}

function testNoticesAltTabThrash() {
  const f = new Focus();
  for (let i = 0; i < 4; i++) {
    f.noteApp('editor', 'your editor');
    runFocus(f, { seconds: 5 });
    f.noteApp('browser', 'the browser');
    runFocus(f, { seconds: 5 });
  }
  const seen = runFocus(f, { seconds: 2 });
  const all = [...seen];
  check(f.thrashCooldown > 0 || all.some((e) => e.type === 'thrash'),
    'bouncing between two apps eight times should be noticed');
  results.push('  notices you bouncing between the same two windows');
}

// ---------------------------------------------------------------- timers
function fakeStore(settings = {}) {
  return {
    timers: [],
    data: { pomodoroWork: 25, pomodoroBreak: 5, ...settings },
    get(k) { return this.data[k]; },
    setTimers(list) { this.timers = list; },
  };
}

function testTimersFireAndPersist() {
  const store = fakeStore();
  const fired = [];
  const t = new Timers(store, (f) => fired.push(f));
  const entry = t.add(1, 'tea');
  check(!!entry, 'adding a one minute timer should work');
  check(store.timers.length === 1, 'the timer was not persisted');

  // Wind the clock forward rather than waiting a minute.
  t.list[0].fireAt = Date.now() - 10;
  t._check();
  check(fired.length === 1 && fired[0].label === 'tea', 'the timer did not go off');
  check(t.list.length === 0, 'a fired timer should be removed');
  results.push('  timers persist, fire once, and clear themselves');
}

function testStaleTimersAreDropped() {
  const store = fakeStore();
  store.timers = [
    { id: 'a', label: 'overdue by hours', fireAt: Date.now() - 6 * 3600 * 1000, minutes: 5, kind: 'timer' },
    { id: 'b', label: 'just missed', fireAt: Date.now() - 30 * 1000, minutes: 5, kind: 'timer' },
  ];
  const t = new Timers(store, () => {});
  check(t.list.length === 1 && t.list[0].id === 'b',
    'an alarm from hours ago should be dropped, one from seconds ago should survive');
  results.push('  an alarm from hours ago is dropped rather than fired on launch');
}

function testPomodoroAlternates() {
  const store = fakeStore({ pomodoroWork: 25, pomodoroBreak: 5 });
  const fired = [];
  const t = new Timers(store, (f) => fired.push(f));
  const started = t.startPomodoro();
  check(started.minutes === 25, 'a pomodoro should start with a work block');
  check(t.pomodoro.phase === 'work', 'the first phase should be work');

  t.list[0].fireAt = Date.now() - 10;
  t._check();
  check(fired.length === 1 && fired[0].kind === 'pomodoro-break', 'work should roll into a break');
  check(t.pomodoro.phase === 'break', 'the phase should now be break');

  t.list[0].fireAt = Date.now() - 10;
  t._check();
  check(fired.length === 2 && fired[1].kind === 'pomodoro-work', 'a break should roll back into work');

  t.stopPomodoro();
  check(t.list.length === 0 && !t.pomodoro, 'stopping should clear the cycle');
  results.push('  the pomodoro alternates work and break, and stops cleanly');
}

function testTimerSnapshotCountsDown() {
  const store = fakeStore();
  const t = new Timers(store, () => {});
  t.add(10, 'a');
  t.add(2, 'b');
  const snap = t.snapshot();
  check(snap.timers.length === 2, 'both timers should be listed');
  check(snap.timers[0].label === 'b', 'the soonest timer should be listed first');
  check(snap.timers[0].remaining > 60 && snap.timers[0].remaining <= 120,
    `remaining was ${snap.timers[0].remaining}s, expected just under 120`);
  results.push('  the timer list counts down, soonest first');
}

// ---------------------------------------------------------------- updates
// Which builds can actually replace themselves. Getting this wrong is not a
// cosmetic bug: a build that silently cannot update looks exactly like one that
// is already up to date, so the user is never told to go and download it.
function testUpdateCapability() {
  const can = (o) => updateCapability(o).can;

  check(!can({ packaged: false, platform: 'win32' }), 'a development build has no feed to check');
  check(can({ packaged: true, platform: 'win32' }), 'the Windows installer should update itself');

  check(!can({ packaged: true, platform: 'win32', env: { PORTABLE_EXECUTABLE_DIR: 'C:/x' } }),
    'a portable exe has no install to replace, so it must not claim it can update');
  check(!can({ packaged: true, platform: 'win32', target: 'portable' }),
    'an explicit portable target must not claim it can update');

  // Squirrel.Mac verifies the signature before swapping the bundle, so an
  // unsigned build would download an update and then refuse to apply it.
  check(!can({ packaged: true, platform: 'darwin' }), 'unsigned macOS cannot self-update');
  check(can({ packaged: true, platform: 'darwin', env: { QUBOT_SIGNED: '1' } }),
    'a signed macOS build should update itself');

  check(can({ packaged: true, platform: 'linux', env: { APPIMAGE: '/tmp/QU.AppImage' } }),
    'an AppImage should update itself');
  check(!can({ packaged: true, platform: 'linux' }),
    'a linux build that is not running as an AppImage cannot update itself');

  // Every refusal has to carry a reason, because that reason is what the menu
  // and the settings window show the user instead of a dead "check" button.
  for (const o of [
    { packaged: false, platform: 'win32' },
    { packaged: true, platform: 'darwin' },
    { packaged: true, platform: 'linux' },
    { packaged: true, platform: 'freebsd' },
    { packaged: true, platform: 'win32', env: { PORTABLE_EXECUTABLE_DIR: 'C:/x' } },
  ]) {
    const r = updateCapability(o);
    check(!r.can && typeof r.reason === 'string' && r.reason.length > 8,
      `refusing to update on ${o.platform} gave no usable reason`);
  }
  results.push('  only builds that can really self-update say so, and the rest explain why');
}

// The release workflow must ship the update feed. Without latest*.yml in the
// release, every installed copy checks, finds nothing, and stays where it is —
// which is exactly what shipped in 1.1.0.
function testReleaseWorkflowShipsTheFeed() {
  const yml = fs.readFileSync('.github/workflows/release.yml', 'utf8');
  check(yml.includes('--publish always'),
    'the release build must let electron-builder publish, so hashes and artifacts stay consistent');
  for (const f of ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']) {
    check(yml.includes(f), `the release workflow never verifies ${f} reached the release`);
  }
  check(/--draft=false/.test(yml), 'the release is never taken out of draft');

  const build = fs.readFileSync('.github/workflows/build.yml', 'utf8');
  check(!build.includes('action-gh-release'),
    'CI must not also attach release assets — two publishers is how metadata drifts from binaries');
  check(build.includes('latest*.yml'), 'CI should prove the update feed is still being generated');
  results.push('  the release workflow ships and verifies the update feed');
}

// ---------------------------------------------------------------- run
console.log('companion');
testGrabIsResponsive();
testGrabFeelsTheSameAtAnyRefreshRate();
testGrabStaysStableWhenFramesStall();
testGrabWeightIsTunable();
testThrowVelocityComesFromTheCursor();
testCountsActiveTimeOnly();
testAnnouncesLongStretchesOnce();
testSwitchingAppsResetsTheClock();
testNoticesAltTabThrash();
testTimersFireAndPersist();
testStaleTimersAreDropped();
testPomodoroAlternates();
testTimerSnapshotCountsDown();
testUpdateCapability();
testReleaseWorkflowShipsTheFeed();

for (const line of results) console.log(line);
console.log(failures ? `\n${failures} FAILURES` : '\nall companion checks passed');
process.exit(failures ? 1 : 0);
