// Screen-space physics, in absolute desktop coordinates (DIP) so the mascot can
// travel across the whole multi-monitor desktop. Everything is CSS px per second.
//
// Multi-display containment works like this: the mascot may travel anywhere
// within the horizontal union of all displays, but the floor and ceiling come
// from whichever display is *beneath it right now*. So it rests on the bottom of
// the screen it happens to be over, and steps up or falls when it crosses onto a
// neighbour whose work area sits higher or lower.

import { clamp, rand, approach } from './geom.js';

export const MODE = {
  RESTING: 'resting',    // parked on a surface, no motion
  HELD: 'held',          // following the cursor mid-drag
  FLYING: 'flying',      // ballistic after a throw, or falling
  WALKING: 'walking',    // strolling along a surface
  FLOATING: 'floating',  // airborne under its own power, steering to a target
};

export class Physics {
  constructor(opts = {}) {
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.mode = MODE.RESTING;
    this.radius = opts.radius ?? 60;

    this.gravity = 1750;
    this.airDrag = 0.12;
    this.restitution = 0.52;      // energy kept on a wall/floor bounce
    this.friction = 900;          // ground deceleration
    this.walkSpeed = 74;
    this.walkDir = 1;

    // One entry per display: its work area, in absolute desktop coordinates.
    this.displays = [{ x: 0, y: 0, w: 1920, h: 1080, id: 0 }];
    this.union = { x1: 0, y1: 0, x2: 1920, y2: 1080 };

    // Gravity off means the mascot flies: instead of falling and resting on a
    // surface it hovers, steering toward whatever target the attention system
    // hands it. This is the default posture.
    this.gravityEnabled = false;
    this.crossScreens = true;     // may leave the display it is currently on
    this.grounded = false;

    // Flight tuning.
    this.hoverTarget = { x: 0, y: 0 };
    this.cruise = 640;            // top steering speed, px/s
    this.steer = 3.4;             // how hard it corrects course
    this.arriveWithin = 14;       // considered "there" inside this radius
    this.arrived = true;
    // 0..1: how hard powered flight should chase a target that is itself
    // moving. Drifting to a spot that will still be there in a second wants a
    // loose, weighty loop; riding the title bar of a window the user is
    // dragging wants a tight one, or the body is left behind.
    this.trackTight = 0;

    // Held-state spring. Very stiff on purpose. A soft spring here does not read
    // as weight, it reads as lag: while the cursor moves, a spring tracking a
    // ramp settles a constant distance behind it, proportional to 2*zeta/sqrt(k).
    // At the old stiffness of 26 that was most of a body-width at ordinary drag
    // speeds, which is exactly the "heavy", unresponsive feeling. Weight belongs
    // in the squash, stretch and tumble — never in the position of the thing the
    // user is directly holding. `grabResponse` (0..1) maps onto this.
    this.holdTarget = { x: 0, y: 0 };
    this.holdStiffness = 7400;
    this.holdDampingRatio = 0.92;

    // Recent cursor samples, used to compute throw velocity on release.
    this.dragSamples = [];
  }

  setDisplays(list) {
    if (!Array.isArray(list) || !list.length) return;
    this.displays = list.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h, id: d.id }));
    this.union = this.displays.reduce((a, d) => ({
      x1: Math.min(a.x1, d.x), y1: Math.min(a.y1, d.y),
      x2: Math.max(a.x2, d.x + d.w), y2: Math.max(a.y2, d.y + d.h),
    }), { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
  }

  // The display acting as ground for a point. Horizontal overlap dominates:
  // what is "underneath" the mascot is decided by where it is across, not down.
  groundFor(x = this.x, y = this.y) {
    let best = this.displays[0];
    let bestScore = Infinity;
    for (const d of this.displays) {
      const dx = x < d.x ? d.x - x : x > d.x + d.w ? x - (d.x + d.w) : 0;
      const dy = y < d.y ? d.y - y : y > d.y + d.h ? y - (d.y + d.h) : 0;
      const score = dx * 4 + dy;
      if (score < bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  // The display the mascot is considered to be *on* — this is what the overlay
  // window follows, so it is decided by the body's centre.
  hostFor(x = this.x, y = this.y) {
    for (const d of this.displays) {
      if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
    }
    return this.groundFor(x, y);
  }

  // Every display covering this x, i.e. the vertical stack the body can move
  // through. With monitors arranged one above another the desktop is continuous
  // top to bottom, so the floor is the bottom of the *lowest* screen in the
  // column and the ceiling the top of the highest — not the edges of whichever
  // single screen the body happens to be in, which would trap it.
  columnAt(x = this.x) {
    const col = this.displays.filter((d) => x >= d.x && x <= d.x + d.w);
    return col.length ? col : [this.groundFor(x, this.y)];
  }

  get ground() { return this.groundFor(); }

  get floor() {
    let bottom = -Infinity;
    for (const d of this.columnAt()) bottom = Math.max(bottom, d.y + d.h);
    return bottom - this.radius;
  }

  get ceiling() {
    let top = Infinity;
    for (const d of this.columnAt()) top = Math.min(top, d.y);
    return top + this.radius;
  }

  // Travel limits: the whole desktop when crossing is allowed, otherwise just
  // the display the mascot is standing on.
  get left() {
    const g = this.ground;
    return (this.crossScreens ? this.union.x1 : g.x) + this.radius;
  }

  get right() {
    const g = this.ground;
    return (this.crossScreens ? this.union.x2 : g.x + g.w) - this.radius;
  }

  place(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.hoverTarget.x = x; this.hoverTarget.y = y;
  }

  // Point the flight system at a spot on the desktop.
  hoverTo(x, y) {
    this.hoverTarget.x = x;
    this.hoverTarget.y = y;
    this.arrived = false;
    if (this.mode === MODE.RESTING || this.mode === MODE.WALKING) this.mode = MODE.FLOATING;
  }

  get hoverDistance() {
    return Math.hypot(this.hoverTarget.x - this.x, this.hoverTarget.y - this.y);
  }

  // Where a free-flying body is allowed to be: anywhere on the desktop, kept
  // whole inside the union so it never drifts off the edge of the world.
  clampToDesktop() {
    this.x = clamp(this.x, this.union.x1 + this.radius, this.union.x2 - this.radius);
    this.y = clamp(this.y, this.union.y1 + this.radius, this.union.y2 - this.radius);
  }

  // Pull the whole body inside one display. Used whenever it comes to rest, so
  // it never parks half-clipped across a bezel.
  settleOnScreen() {
    const g = this.groundFor();
    this.x = clamp(this.x, g.x + this.radius, g.x + g.w - this.radius);
    this.y = clamp(this.y, g.y + this.radius, g.y + g.h - this.radius);
  }

  grab(px, py) {
    this.mode = MODE.HELD;
    this.holdTarget.x = px;
    this.holdTarget.y = py;
    this.dragSamples.length = 0;
    this.grounded = false;
  }

  dragTo(px, py, t) {
    this.holdTarget.x = px;
    this.holdTarget.y = py;
    this.dragSamples.push({ x: px, y: py, t });
    // Keep ~120ms of history; that window makes flick-throws feel right.
    while (this.dragSamples.length > 2 && t - this.dragSamples[0].t > 0.12) this.dragSamples.shift();
  }

  release() {
    const s = this.dragSamples;
    if (s.length >= 2) {
      const a = s[0], b = s[s.length - 1];
      const dt = Math.max(b.t - a.t, 1 / 120);
      this.vx = clamp((b.x - a.x) / dt, -3200, 3200);
      this.vy = clamp((b.y - a.y) / dt, -3200, 3200);
    } else {
      this.vx = 0; this.vy = 0;
    }
    this.dragSamples.length = 0;
    this.mode = MODE.FLYING;
    return Math.hypot(this.vx, this.vy);
  }

  startWalk(dir) {
    if (!this.gravityEnabled) return false;
    this.mode = MODE.WALKING;
    this.walkDir = dir || (Math.random() < 0.5 ? -1 : 1);
    return true;
  }

  stop() {
    this.mode = this.gravityEnabled ? MODE.RESTING : MODE.FLOATING;
    this.vx = 0; this.vy = 0;
    this.hoverTarget.x = this.x;
    this.hoverTarget.y = this.y;
    this.arrived = true;
  }

  // Nearest display in a horizontal direction. Compared by centre rather than by
  // touching edges, so it still works when work areas do not line up exactly
  // (a side-docked taskbar, or monitors of different heights).
  neighbour(dir) {
    const g = this.groundFor();
    const gc = g.x + g.w / 2;
    let best = null;
    let bestDist = Infinity;
    for (const d of this.displays) {
      if (d === g) continue;
      const dc = d.x + d.w / 2;
      if (Math.sign(dc - gc) !== Math.sign(dir)) continue;
      const dist = Math.abs(dc - gc);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    return best;
  }

  // Any display other than the one it is standing on — the fallback for stacked
  // monitors, where neither is to the left or right of the other.
  otherDisplay() {
    const g = this.groundFor();
    return this.displays.find((d) => d !== g) || null;
  }

  update(dt) {
    const events = [];

    if (this.mode === MODE.HELD) {
      // Damped spring toward the cursor, substepped. A stiff spring integrated
      // in one frame-sized step goes unstable as soon as the frame rate dips,
      // and multiplying velocity by a constant per frame (the obvious version)
      // makes the feel depend on the refresh rate — a 144Hz screen would damp
      // nearly twice as hard as a 60Hz one.
      const k = this.holdStiffness;
      const c = 2 * Math.sqrt(k) * this.holdDampingRatio;
      let left = dt;
      while (left > 1e-6) {
        // Substep size is set by the stiffest spring the slider allows:
        // stability needs h < 2/sqrt(k), and this leaves a wide margin.
        const h = Math.min(left, 1 / 480);
        this.vx += ((this.holdTarget.x - this.x) * k - this.vx * c) * h;
        this.vy += ((this.holdTarget.y - this.y) * k - this.vy * c) * h;
        this.x += this.vx * h;
        this.y += this.vy * h;
        left -= h;
      }
      // A drag may go anywhere on the desktop, but not off it entirely.
      this.x = clamp(this.x, this.union.x1 + this.radius, this.union.x2 - this.radius);
      this.y = clamp(this.y, this.union.y1 + this.radius, this.union.y2 - this.radius);
      return events;
    }

    if (this.mode === MODE.WALKING) {
      // Walking stays on one screen: crossing a bezel at strolling pace would
      // leave the mascot clipped by the window edge for over a second.
      const g = this.groundFor();
      this.vx = this.walkDir * this.walkSpeed;
      this.x += this.vx * dt;
      if (this.gravityEnabled) this.y = approach(this.y, this.floor, 8, dt);

      const lo = g.x + this.radius;
      const hi = g.x + g.w - this.radius;
      if (this.x <= lo) { this.x = lo; this.walkDir = 1; events.push({ type: 'turn', at: 'left' }); }
      if (this.x >= hi) { this.x = hi; this.walkDir = -1; events.push({ type: 'turn', at: 'right' }); }
      return events;
    }

    if (this.mode === MODE.FLOATING) {
      const dx = this.hoverTarget.x - this.x;
      const dy = this.hoverTarget.y - this.y;
      const dist = Math.hypot(dx, dy);

      // Ease into arrival: cruise when far, slow down as it closes in, so it
      // settles onto a spot instead of jittering around it.
      const tight = 1 + this.trackTight * 3.4;
      let wantVx = 0;
      let wantVy = 0;
      if (dist > 0.5) {
        const speed = Math.min(this.cruise * tight, dist * 2.4 * tight);
        wantVx = (dx / dist) * speed;
        wantVy = (dy / dist) * speed;
      }
      // Steering lags the desired velocity by ~1/steer seconds, which is what
      // gives flight its weight — but that same lag overshoots on arrival, so
      // tighten the loop once it is closing in.
      const closing = dist < this.radius * 2.5 ? 3.2 : 1;
      this.vx = approach(this.vx, wantVx, this.steer * closing * tight, dt);
      this.vy = approach(this.vy, wantVy, this.steer * closing * tight, dt);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.clampToDesktop();

      // "Arrived" means parked, not merely passing through.
      const speed = Math.hypot(this.vx, this.vy);
      if (!this.arrived && dist <= this.arriveWithin && speed < 60) {
        this.arrived = true;
        events.push({ type: 'arrived' });
      } else if (this.arrived && dist > this.arriveWithin * 3) {
        this.arrived = false;
      }
      if (this.gravityEnabled) this.mode = MODE.FLYING;
      return events;
    }

    if (this.mode === MODE.RESTING) {
      if (!this.gravityEnabled) { this.mode = MODE.FLOATING; return events; }
      if (this.y < this.floor - 0.5) this.mode = MODE.FLYING;
      // A display can be unplugged or rearranged out from under it.
      else if (this.y > this.floor + 0.5) { this.settleOnScreen(); events.push({ type: 'settle' }); }
      return events;
    }

    // ---- FLYING ----
    if (this.gravityEnabled) this.vy += this.gravity * dt;
    const drag = Math.exp(-this.airDrag * dt);
    this.vx *= drag;
    this.vy *= drag;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const left = this.left;
    const right = this.right;
    if (this.x <= left) {
      this.x = left;
      if (this.vx < 0) {
        const s = Math.abs(this.vx);
        this.vx = -this.vx * this.restitution;
        if (s > 120) events.push({ type: 'bounce', speed: s, surface: 'left' });
      }
    }
    if (this.x >= right) {
      this.x = right;
      if (this.vx > 0) {
        const s = Math.abs(this.vx);
        this.vx = -this.vx * this.restitution;
        if (s > 120) events.push({ type: 'bounce', speed: s, surface: 'right' });
      }
    }

    const ceiling = this.ceiling;
    if (this.y <= ceiling) {
      this.y = ceiling;
      if (this.vy < 0) {
        const s = Math.abs(this.vy);
        this.vy = -this.vy * this.restitution;
        if (s > 120) events.push({ type: 'bounce', speed: s, surface: 'top' });
      }
    }

    if (this.gravityEnabled) {
      const floor = this.floor;
      if (this.y >= floor) {
        this.y = floor;
        const impact = Math.abs(this.vy);
        if (impact > 60) {
          this.vy = -impact * this.restitution;
          events.push({ type: 'land', speed: impact });
        } else {
          this.vy = 0;
        }
        const f = this.friction * dt;
        this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
        if (Math.abs(this.vx) < 4 && Math.abs(this.vy) < 4) {
          this.vx = 0; this.vy = 0;
          this.mode = MODE.RESTING;
          this.settleOnScreen();
          events.push({ type: 'settle' });
        }
      }
    } else {
      // In flight, a throw bleeds off into powered hovering rather than a stop.
      const f = 300 * dt;
      const sp = Math.hypot(this.vx, this.vy);
      if (sp <= this.cruise * 0.55) {
        this.mode = MODE.FLOATING;
        this.arrived = false;
        events.push({ type: 'recover' });
      } else {
        this.vx -= (this.vx / sp) * f;
        this.vy -= (this.vy / sp) * f;
      }
      this.clampToDesktop();
    }

    return events;
  }

  // Squash-and-stretch derived from velocity: stretches along the direction of
  // travel, and the renderer adds an extra squash pulse on impact.
  get velocityStretch() {
    const sp = Math.hypot(this.vx, this.vy);
    if (sp < 40 || this.mode === MODE.RESTING) return { amount: 0, angle: 0 };
    // Powered flight is smooth, so it deforms far less than a hurled body does.
    const scale = this.mode === MODE.FLOATING ? 9000 : 2600;
    return { amount: clamp(sp / scale, 0, 0.26), angle: Math.atan2(this.vy, this.vx) };
  }

  // How airborne it is, 0..1 — drives the shadow and the flight pose.
  get airborne() {
    if (!this.gravityEnabled) return 1;
    if (this.mode === MODE.RESTING || this.mode === MODE.WALKING) return 0;
    return clamp((this.floor - this.y) / 220, 0, 1);
  }

  nudge(vx, vy) {
    this.vx += vx; this.vy += vy;
    if (this.mode === MODE.RESTING || this.mode === MODE.WALKING) this.mode = MODE.FLYING;
  }

  // A short hop, used by idle behaviour.
  hop(power = 1) {
    this.vy = -620 * power;
    this.vx += rand(-90, 90);
    this.mode = MODE.FLYING;
  }

  // Launch toward another display on a ballistic arc that actually lands there.
  // Fast on purpose: at this speed the moment the body is clipped by the screen
  // edge reads as passing behind the bezel rather than as a glitch.
  travelTo(display) {
    const tx = display.x + display.w / 2;
    const ty = display.y + display.h - this.radius;
    const dx = tx - this.x;
    const dy = ty - this.y;
    // Pick a flight time, then solve the launch velocity that hits the target.
    const flight = clamp(Math.abs(dx) / 1600, 0.4, 1.3);
    this.vx = clamp(dx / flight, -2600, 2600);
    this.vy = this.gravityEnabled
      ? clamp(dy / flight - 0.5 * this.gravity * flight, -2600, 2600)
      : clamp(dy / flight, -2600, 2600);
    this.mode = MODE.FLYING;
    return Math.sign(dx) || 1;
  }
}
