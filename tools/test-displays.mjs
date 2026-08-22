// Headless simulation of the physics across multi-monitor layouts. These are the
// cases you cannot eyeball without physically owning four monitor arrangements,
// and the ones most likely to strand the mascot somewhere invisible.
//
//   npm test

import { Physics, MODE } from '../src/renderer/lib/physics.js';

let failures = 0;
const results = [];

function check(ok, msg) {
  if (!ok) { failures++; results.push('  FAIL: ' + msg); }
}

// Work areas, in absolute desktop coordinates.
const LAYOUTS = {
  // The author's real setup: 1920x1080 @100% beside a 1707x1068 @150% panel that
  // sits 90px higher, with taskbars of different heights.
  mixedDpiOffset: [
    { id: 1, x: 0, y: 0, w: 1920, h: 1032 },
    { id: 2, x: 1920, y: -90, w: 1707, h: 1020 },
  ],
  sideBySideEqual: [
    { id: 1, x: 0, y: 0, w: 1920, h: 1040 },
    { id: 2, x: 1920, y: 0, w: 1920, h: 1040 },
  ],
  secondOnLeft: [
    { id: 1, x: 0, y: 0, w: 1920, h: 1040 },
    { id: 2, x: -2560, y: -200, w: 2560, h: 1400 },
  ],
  stacked: [
    { id: 1, x: 0, y: 0, w: 1920, h: 1040 },
    { id: 2, x: 0, y: -1080, w: 1920, h: 1080 },
  ],
  three: [
    { id: 1, x: 0, y: 0, w: 1920, h: 1040 },
    { id: 2, x: 1920, y: -90, w: 1707, h: 1020 },
    { id: 3, x: -1280, y: 100, w: 1280, h: 984 },
  ],
  single: [{ id: 1, x: 0, y: 0, w: 1920, h: 1040 }],
};

const RADIUS = 64;

// Gravity is off by default now (the mascot flies), so the grounded cases have
// to ask for it explicitly.
function makePhysics(layout, { gravity = true } = {}) {
  const p = new Physics({ radius: RADIUS });
  p.radius = RADIUS;
  p.gravityEnabled = gravity;
  p.setDisplays(LAYOUTS[layout]);
  return p;
}

// Run the sim until it comes to rest, or give up.
function settle(p, maxSeconds = 30) {
  const dt = 1 / 60;
  const seen = [];
  for (let t = 0; t < maxSeconds * 60; t++) {
    for (const ev of p.update(dt)) seen.push(ev.type);
    if (p.mode === MODE.RESTING) return { rested: true, seconds: t / 60, events: seen };
  }
  return { rested: false, seconds: maxSeconds, events: seen };
}

const bodyInside = (p, d) =>
  p.x - RADIUS >= d.x - 0.5 && p.x + RADIUS <= d.x + d.w + 0.5 &&
  p.y - RADIUS >= d.y - 0.5 && p.y + RADIUS <= d.y + d.h + 0.5;

const onSomeScreen = (p) => p.displays.some((d) => bodyInside(p, d));

// ---------------------------------------------------------------- tests

// Whether a display is the bottom of its own column. If something sits directly
// below it the desktop is continuous there, so gravity will carry the mascot on
// through — it can visit that screen but not come to rest on it.
function restable(layout, d) {
  return !layout.some((o) => o !== d
    && o.x < d.x + d.w && o.x + o.w > d.x
    && o.y + o.h > d.y + d.h);
}

function testCanReachEveryScreen() {
  for (const name of Object.keys(LAYOUTS)) {
    const layout = LAYOUTS[name];
    if (layout.length < 2) continue;
    for (const target of layout) {
      const p = makePhysics(name);
      const start = layout[0];
      p.place(start.x + start.w / 2, start.y + start.h - RADIUS);
      if (target === p.groundFor()) continue;

      p.travelTo(target);
      let visited = false;
      const dt = 1 / 60;
      for (let t = 0; t < 40 * 60 && p.mode !== MODE.RESTING; t++) {
        p.update(dt);
        if (p.hostFor().id === target.id) visited = true;
      }
      check(p.mode === MODE.RESTING, `${name}: travel to display ${target.id} never came to rest`);
      check(visited, `${name}: travel aimed at display ${target.id} never actually got there`);
      check(onSomeScreen(p),
        `${name}: after travelling to ${target.id} the body ended off-screen (x=${p.x.toFixed(0)}, y=${p.y.toFixed(0)})`);
      if (restable(layout, target)) {
        check(p.groundFor().id === target.id,
          `${name}: travel aimed at display ${target.id} but settled on ${p.groundFor().id}`);
      }
    }
  }
  results.push('  every display is reachable by travelTo, on all layouts');
}

function testThrowCrossesTheBezel() {
  const p = makePhysics('mixedDpiOffset');
  p.place(960, 1032 - RADIUS);
  p.mode = MODE.FLYING;
  p.vx = 2400;
  p.vy = -300;
  const r = settle(p);
  check(r.rested, 'a hard rightward throw never settled');
  check(p.x > 1920, `a hard rightward throw stayed on the first display (x=${p.x.toFixed(0)})`);
  check(p.groundFor().id === 2, 'a hard rightward throw did not end up on display 2');
  results.push(`  a hard throw crosses the bezel and settles at x=${p.x.toFixed(0)} on display ${p.groundFor().id}`);

  // ...and back again.
  const q = makePhysics('mixedDpiOffset');
  q.place(2700, 930 - RADIUS);
  q.mode = MODE.FLYING;
  q.vx = -2400;
  q.vy = -300;
  settle(q);
  check(q.x < 1920, `a hard leftward throw did not return to display 1 (x=${q.x.toFixed(0)})`);
  results.push(`  and back the other way, settling at x=${q.x.toFixed(0)} on display ${q.groundFor().id}`);
}

function testRestsOnTheRightFloor() {
  const p = makePhysics('mixedDpiOffset');
  // Display 2's work area ends at y=930; display 1's at y=1032. Dropping onto
  // each must use that display's own floor, not a shared one.
  p.place(2700, 0);
  settle(p);
  check(Math.abs(p.y - (930 - RADIUS)) < 1,
    `on the higher display it rested at y=${p.y.toFixed(1)}, expected ${930 - RADIUS}`);

  const q = makePhysics('mixedDpiOffset');
  q.place(960, 0);
  settle(q);
  check(Math.abs(q.y - (1032 - RADIUS)) < 1,
    `on the lower display it rested at y=${q.y.toFixed(1)}, expected ${1032 - RADIUS}`);
  results.push('  rests on each display\'s own work-area floor, not a shared one');
}

function testNeverRestsStraddlingABezel() {
  const p = makePhysics('mixedDpiOffset');
  // Park it exactly on the seam, then let it settle.
  for (const x of [1920, 1900, 1940, 1856, 1984]) {
    p.place(x, 900);
    p.mode = MODE.FLYING;
    p.vx = 0; p.vy = 0;
    settle(p);
    check(onSomeScreen(p),
      `settled straddling the bezel from x=${x} (ended x=${p.x.toFixed(0)}, y=${p.y.toFixed(0)})`);
  }
  results.push('  never comes to rest straddling a bezel');
}

function testNeverLeavesTheDesktop() {
  // Fire it in every direction, hard, from every display, and confirm it always
  // ends somewhere a human can see.
  for (const name of Object.keys(LAYOUTS)) {
    const p = makePhysics(name);
    for (const d of LAYOUTS[name]) {
      for (const [vx, vy] of [[3200, -3200], [-3200, -3200], [3200, 3200], [-3200, 3200], [0, -3200]]) {
        p.place(d.x + d.w / 2, d.y + d.h - RADIUS);
        p.mode = MODE.FLYING;
        p.vx = vx; p.vy = vy;
        const r = settle(p, 40);
        check(r.rested, `${name}: throw (${vx},${vy}) from display ${d.id} never settled`);
        check(onSomeScreen(p),
          `${name}: throw (${vx},${vy}) from display ${d.id} ended off-screen at (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
      }
    }
  }
  results.push('  hard throws in every direction always end fully on a screen');
}

function testWalkingStaysOnOneScreen() {
  const p = makePhysics('mixedDpiOffset');
  p.place(1800, 1032 - RADIUS);
  p.startWalk(1);
  const dt = 1 / 60;
  let turns = 0;
  for (let i = 0; i < 60 * 60; i++) {
    for (const ev of p.update(dt)) if (ev.type === 'turn') turns++;
    check(p.x >= -0.5 && p.x <= 1920.5, `walking left display 1 (x=${p.x.toFixed(0)})`);
    check(bodyInside(p, LAYOUTS.mixedDpiOffset[0]), `walking put the body off display 1 (x=${p.x.toFixed(0)})`);
  }
  check(turns > 0, 'walking never reached an edge in a full minute');
  results.push(`  walking stays on its own display and turns at the edges (${turns} turns/min)`);
}

function testDraggingStaysOnTheDesktop() {
  const p = makePhysics('mixedDpiOffset');
  p.place(960, 900);
  p.grab(960, 900);
  const dt = 1 / 60;
  // Drag far past the top-right corner of the whole desktop.
  for (let i = 0; i < 240; i++) {
    p.dragTo(9999, -9999, i * dt);
    p.update(dt);
  }
  check(p.x <= 3627 - RADIUS + 0.5 && p.y >= -90 + RADIUS - 0.5,
    `dragging escaped the desktop at (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
  results.push('  dragging is clamped to the desktop bounds');
}

function testMonitorUnplugged() {
  const p = makePhysics('mixedDpiOffset');
  p.place(2700, 866);              // sitting on display 2
  check(p.groundFor().id === 2, 'setup: expected to start on display 2');
  // Display 2 goes away.
  p.setDisplays([LAYOUTS.mixedDpiOffset[0]]);
  p.settleOnScreen();
  check(bodyInside(p, LAYOUTS.mixedDpiOffset[0]),
    `after unplugging its monitor the body is off-screen at (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
  results.push(`  survives its monitor being unplugged (recovered to x=${p.x.toFixed(0)})`);
}

function testResolutionChange() {
  const p = makePhysics('sideBySideEqual');
  p.place(3500, 1040 - RADIUS);
  // Second monitor drops to a much smaller mode.
  p.setDisplays([
    { id: 1, x: 0, y: 0, w: 1920, h: 1040 },
    { id: 2, x: 1920, y: 0, w: 1280, h: 680 },
  ]);
  p.settleOnScreen();
  check(onSomeScreen(p), `after a resolution change the body is off-screen at (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
  results.push('  survives a resolution change under it');
}

function testHostTracksTheBody() {
  const p = makePhysics('mixedDpiOffset');
  p.place(960, 900);
  check(p.hostFor().id === 1, 'host should be display 1 at x=960');
  p.place(2700, 500);
  check(p.hostFor().id === 2, 'host should be display 2 at x=2700');
  // In the dead zone below display 2 (it is shorter than display 1), the host
  // must still resolve to a real display rather than nothing.
  p.place(2700, 1010);
  check(p.hostFor() && p.hostFor().id === 2, 'host should fall back to display 2 below its work area');
  results.push('  host display tracks the body, including in the gap below a shorter monitor');
}

function testSingleMonitorUnaffected() {
  const p = makePhysics('single');
  p.place(960, 0);
  settle(p);
  check(Math.abs(p.y - (1040 - RADIUS)) < 1, 'single monitor: wrong resting height');
  check(p.neighbour(1) === null && p.neighbour(-1) === null, 'single monitor: invented a neighbour');
  check(p.otherDisplay() === null, 'single monitor: invented another display');
  results.push('  single-monitor behaviour is unchanged');
}

// ---------------------------------------------------------------- flight

function flyUntilStill(p, maxSeconds = 20) {
  const dt = 1 / 60;
  for (let t = 0; t < maxSeconds * 60; t++) {
    p.update(dt);
    if (p.arrived && Math.hypot(p.vx, p.vy) < 12) return t / 60;
  }
  return null;
}

function testFlightReachesItsTarget() {
  for (const name of Object.keys(LAYOUTS)) {
    const p = makePhysics(name, { gravity: false });
    const from = LAYOUTS[name][0];
    p.place(from.x + from.w / 2, from.y + from.h / 2);
    for (const d of LAYOUTS[name]) {
      const tx = d.x + d.w * 0.3;
      const ty = d.y + d.h * 0.4;
      p.hoverTo(tx, ty);
      const took = flyUntilStill(p);
      check(took !== null, `${name}: flight to display ${d.id} never settled`);
      check(Math.hypot(p.x - tx, p.y - ty) < 20,
        `${name}: flight stopped ${Math.hypot(p.x - tx, p.y - ty).toFixed(0)}px short of its target`);
      check(onSomeScreen(p), `${name}: flight ended off-screen`);
    }
  }
  results.push('  flight reaches its target on every display, on all layouts');
}

function testFlightStaysOnTheDesktop() {
  const p = makePhysics('mixedDpiOffset', { gravity: false });
  p.place(960, 500);
  // Aim far outside the desktop in every direction.
  for (const [tx, ty] of [[-9999, -9999], [9999, -9999], [-9999, 9999], [9999, 9999], [0, 99999]]) {
    p.hoverTo(tx, ty);
    for (let i = 0; i < 60 * 8; i++) {
      p.update(1 / 60);
      check(p.x >= -0.5 - RADIUS + 64 && p.x <= 3627 + 0.5,
        `flight escaped horizontally to x=${p.x.toFixed(0)}`);
    }
    check(p.x >= 0 + RADIUS - 0.5 && p.x <= 3627 - RADIUS + 0.5
      && p.y >= -90 + RADIUS - 0.5 && p.y <= 1080 - RADIUS + 0.5,
      `flight toward (${tx},${ty}) left the desktop at (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
  }
  results.push('  flight is clamped to the desktop however far off-screen it is aimed');
}

function testThrowRecoversIntoFlight() {
  const p = makePhysics('mixedDpiOffset', { gravity: false });
  p.place(960, 500);
  p.mode = MODE.FLYING;
  p.vx = 3000; p.vy = -1200;
  let recovered = false;
  for (let i = 0; i < 60 * 20; i++) {
    for (const ev of p.update(1 / 60)) if (ev.type === 'recover') recovered = true;
    if (p.mode === MODE.FLOATING) break;
  }
  check(recovered, 'a throw while flying never recovered into powered flight');
  check(p.mode === MODE.FLOATING, `after a throw the mode is ${p.mode}, expected floating`);
  check(onSomeScreen(p), `after a throw it recovered off-screen at (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
  results.push('  a hard throw bleeds off into powered flight rather than a dead stop');
}

function testNoWalkingInFlight() {
  const p = makePhysics('mixedDpiOffset', { gravity: false });
  p.place(960, 500);
  check(p.startWalk(1) === false, 'walking was allowed while flying');
  check(p.mode !== MODE.WALKING, 'flight fell into walking mode');
  const g = makePhysics('mixedDpiOffset', { gravity: true });
  g.place(960, 900);
  check(g.startWalk(1) === true, 'walking was refused on the ground');
  results.push('  walking is only possible with a floor under it');
}

function testAirborneReadout() {
  const f = makePhysics('single', { gravity: false });
  f.place(960, 500);
  check(f.airborne === 1, 'a flying body should read as fully airborne');
  const g = makePhysics('single', { gravity: true });
  g.place(960, 1040 - RADIUS);
  g.stop();
  check(g.airborne === 0, 'a resting body should read as grounded');
  results.push('  the airborne readout that drives the shadow is correct in both modes');
}

// ---------------------------------------------------------------- run
console.log('multi-display physics');
testHostTracksTheBody();
testRestsOnTheRightFloor();
testThrowCrossesTheBezel();
testCanReachEveryScreen();
testNeverRestsStraddlingABezel();
testNeverLeavesTheDesktop();
testWalkingStaysOnOneScreen();
testDraggingStaysOnTheDesktop();
testMonitorUnplugged();
testResolutionChange();
testSingleMonitorUnaffected();
testFlightReachesItsTarget();
testFlightStaysOnTheDesktop();
testThrowRecoversIntoFlight();
testNoWalkingInFlight();
testAirborneReadout();

for (const line of results) console.log(line);
console.log(failures ? `\n${failures} FAILURES` : '\nall multi-display checks passed');
process.exit(failures ? 1 : 0);
