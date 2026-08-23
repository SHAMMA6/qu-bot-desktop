// What the mascot is paying attention to, and therefore where it wants to be.
//
// It reads three streams: the cursor (60Hz), how long the machine has been
// without input, and — if activity watching is on — which window is in front and
// where that window sits. From those it picks a *stance*: a rule for choosing a
// hover target, plus the events worth reacting to.
//
// The guiding rule is "attentive, not in the way". It hovers off to one side of
// whatever you are doing, repositions only when you have clearly moved on, and
// gets out of the path of a fast-moving cursor.

import { clamp, approach, rand, chance, makeNoise, TAU } from './geom.js';

// Windows title-bar geometry, in DIP. The minimise / maximise / close cluster is
// three 46pt buttons; the bar itself is 32pt on both Windows 10 and 11.
const CONTROLS_W = 138;
const TITLE_BAR_H = 32;

export const STANCE = {
  SHOULDER: 'shoulder',  // just off the cursor, watching what you point at
  PERCH: 'perch',        // parked at the corner of the window you are working in
  RIDE: 'ride',          // sitting on the title bar, moving with the window
  HOME: 'home',          // parked on the spot the user chose
  ROAM: 'roam',          // drifting around the active screen
  EDGE: 'edge',          // tucked against a screen edge, out of the way
  DODGE: 'dodge',        // actively getting out of the cursor's path
};

// Foreground process name -> a coarse kind. Deliberately coarse: the mascot
// reacts to "you're writing code" rather than to your actual file names.
const APP_KINDS = [
  [/^(chrome|msedge|firefox|brave|opera|arc|vivaldi|zen)$/i, 'browser', 'the browser'],
  [/^(code|devenv|idea\w*|pycharm|webstorm|rider|clion|goland|sublime_text|notepad\+\+|cursor|zed|rustrover)$/i, 'editor', 'your editor'],
  [/^(windowsterminal|cmd|powershell|pwsh|wt|conhost|alacritty|wezterm|kitty)$/i, 'terminal', 'a terminal'],
  [/^(discord|slack|teams|telegram|whatsapp|signal|zoom|skype)$/i, 'chat', 'a chat window'],
  [/^(spotify|vlc|mpc-hc64|potplayer|foobar2000|musicbee)$/i, 'media', 'something playing'],
  [/^(steam|steamwebhelper|epicgameslauncher|riotclientux|battle\.net)$/i, 'games', 'games'],
  [/^(winword|excel|powerpnt|onenote|acrobat|acrord32|notion|obsidian)$/i, 'docs', 'documents'],
  [/^(explorer)$/i, 'files', 'file explorer'],
  [/^(photoshop|illustrator|figma|blender|premiere|afterfx|krita|gimp|inkscape)$/i, 'creative', 'something creative'],
  [/^(claude|chatgpt|copilot|ollama|lmstudio|perplexity|msty)$/i, 'ai', 'another ai'],
];

export function classifyApp(process = '') {
  const bare = String(process).replace(/\.exe$/i, '');
  for (const [re, kind, label] of APP_KINDS) if (re.test(bare)) return { kind, label };
  return { kind: 'other', label: bare || 'something' };
}

export class Attention {
  constructor() {
    this.t = 0;

    this.cursor = { x: 0, y: 0, has: false };
    this.last = { x: 0, y: 0 };
    this.speed = 0;              // smoothed, px/s
    this.vel = { x: 0, y: 0 };   // smoothed cursor velocity, px/s
    this.stillFor = 0;           // seconds since the cursor last moved
    this.movingFor = 0;

    this.idleSeconds = 0;        // seconds since ANY input, from the OS
    this.typing = false;
    this.typingFor = 0;

    this.app = null;             // { process, kind, label, title, rect }
    this.sinceAppChange = 999;

    this.stance = STANCE.SHOULDER;
    this.sinceStance = 0;
    this.target = { x: 0, y: 0 };
    this.anchor = { x: 0, y: 0, set: false };
    this.side = 1;
    this.roamUntil = 0;
    this.dodgeFor = 0;
    this.sinceAnchor = 0;

    this.drift = { a: makeNoise(41), b: makeNoise(97) };
    this.enabled = true;         // follow the cursor at all
    this.watchApps = true;

    // Riding: sit on the window's title bar and go where it goes.
    this.rideWindows = true;
    this.lastRectKey = '';
    this.rectMovedAt = -999;
    this.tracking = false;       // the thing we are following is moving right now

    // A spot the user picked, in absolute desktop coordinates. While they are
    // heads-down this is where it waits, instead of hovering near the cursor.
    this.home = null;            // { x, y } or null
    this.homeWhenBusy = true;
    this.focusMode = false;      // go home, stay there, stop performing
  }

  // ---- inputs -------------------------------------------------------------

  noteCursor(pt) {
    // Seed the history on the very first sample. Without this the first frame
    // measures the jump from (0,0) as thousands of px/s and the mascot reacts to
    // a swipe that never happened.
    if (!this.cursor.has) {
      this.last.x = pt.x;
      this.last.y = pt.y;
    }
    this.cursor.x = pt.x;
    this.cursor.y = pt.y;
    this.cursor.has = true;
  }

  noteIdle(seconds) {
    this.idleSeconds = seconds;
  }

  noteApp(info) {
    if (!info) return null;
    const changed = !this.app || this.app.process !== info.process || this.app.title !== info.title;
    const kindChanged = !this.app || this.app.process !== info.process;
    const { kind, label } = classifyApp(info.process);
    this.app = { ...info, kind, label };
    if (changed) this.sinceAppChange = 0;
    return kindChanged ? 'app' : changed ? 'title' : null;
  }

  // ---- per-frame ----------------------------------------------------------

  update(dt, ctx) {
    this.t += dt;
    this.sinceStance += dt;
    this.sinceAppChange += dt;
    this.sinceAnchor += dt;

    const events = [];

    // Cursor kinematics.
    const dx = this.cursor.x - this.last.x;
    const dy = this.cursor.y - this.last.y;
    const moved = Math.hypot(dx, dy);
    const step = Math.max(dt, 1 / 240);
    const instant = moved / step;
    this.speed = approach(this.speed, instant, 12, dt);
    this.vel.x = approach(this.vel.x, dx / step, 12, dt);
    this.vel.y = approach(this.vel.y, dy / step, 12, dt);
    this.last.x = this.cursor.x;
    this.last.y = this.cursor.y;

    if (moved > 1.5) {
      if (this.stillFor > 1.2) events.push({ type: 'stirred' });
      this.stillFor = 0;
      this.movingFor += dt;
      if (instant > 2600 && this.movingFor > 0.08) events.push({ type: 'flick' });
    } else {
      this.stillFor += dt;
      this.movingFor = 0;
    }

    // Typing: the OS says input is happening, but the cursor is parked. That is
    // the keyboard. Worth knowing, because it means "leave me alone" rather than
    // "come and look at this".
    const wasTyping = this.typing;
    this.typing = this.idleSeconds < 2 && this.stillFor > 1.4;
    if (this.typing) this.typingFor += dt; else this.typingFor = 0;
    if (this.typing && !wasTyping) events.push({ type: 'typing' });
    if (!this.typing && wasTyping && this.typingFor > 3) events.push({ type: 'stoppedTyping' });

    // Notice when the window we might be riding actually moves, so the flight
    // loop can tighten up for exactly as long as it is being dragged.
    const rect = this.app && this.app.rect;
    if (rect) {
      const key = `${rect.x},${rect.y},${rect.w},${rect.h}`;
      if (key !== this.lastRectKey) {
        this.lastRectKey = key;
        this.rectMovedAt = this.t;
      }
    }

    this.chooseStance(ctx);
    this.chooseTarget(dt, ctx, events);

    this.tracking = this.stance === STANCE.RIDE && (this.t - this.rectMovedAt) < 1.1;

    return events;
  }

  chooseStance(ctx) {
    // Focus mode is a deliberate choice by the user: park on the home spot and
    // stop competing for attention until they turn it off.
    if (this.focusMode && this.home) return this.setStance(STANCE.HOME, 0);

    // Getting out of the way beats everything else.
    if (this.dodgeFor > 0) return;

    // A home spot is the more specific instruction — "park exactly here while I
    // work" — so it outranks riding, in every branch below.
    const homeFirst = !!(this.home && this.homeWhenBusy);
    const hasWindow = !!(this.watchApps && this.app && this.app.rect);
    const canRide = this.rideWindows && hasWindow && !homeFirst;

    // The window is being dragged or resized *right now*. Going along with that
    // is the entire point of riding, so it outranks anything the cursor is
    // doing: dragging a window IS mouse movement, and reading that as "the user
    // is pointing at something" is what shook the mascot off the title bar at
    // exactly the moment it was supposed to hold on.
    if (canRide && (this.t - this.rectMovedAt) < 1.1) return this.setStance(STANCE.RIDE, 0);

    // Following the cursor is switched off, so there is no pointer to hover
    // near. The window in front is then the best thing to attend to — without
    // this, turning off "follow the cursor" silently turned off riding too.
    if (!this.enabled) {
      if (canRide) return this.setStance(STANCE.RIDE, 3);
      return this.setStance(homeFirst ? STANCE.HOME : STANCE.ROAM, 4);
    }

    const away = this.idleSeconds > 45;
    if (away) return this.setStance(STANCE.ROAM, 6);

    // Settled: either the keyboard is doing the work, or the pointer has simply
    // been parked long enough to stop being what the user is attending to. In
    // order of preference: the spot the user chose, riding the window they are
    // working in, beside it, or a screen edge when there is nothing to go on.
    //
    // 1.8s is chosen to land before the shoulder fallback below can re-fire (it
    // holds for 2s at a time). Any later and the two take turns, and the mascot
    // spends its time flying between the cursor and the title bar.
    const settled = (this.typing && this.typingFor > 1.2) || (canRide && this.stillFor > 1.8);
    if (settled) {
      if (homeFirst) return this.setStance(STANCE.HOME, 3);
      if (!hasWindow) return this.setStance(STANCE.EDGE, 3);
      return this.setStance(this.rideWindows ? STANCE.RIDE : STANCE.PERCH, 3);
    }

    if (this.stillFor > 12) return this.setStance(STANCE.ROAM, 5);
    if (this.stillFor < 2.5 || this.speed > 60) return this.setStance(STANCE.SHOULDER, 2);
  }

  setStance(next, minSeconds) {
    if (next === this.stance) return;
    if (this.sinceStance < minSeconds) return;
    this.stance = next;
    this.sinceStance = 0;
    this.anchor.set = false;
  }

  chooseTarget(dt, ctx, events) {
    const { body, radius, display, displays } = ctx;
    const gap = radius + 96;

    // --- dodge: a fast cursor heading at it means move, now.
    if (this.dodgeFor > 0) this.dodgeFor -= dt;
    if (this.enabled && this.cursor.has && !ctx.held) {
      const bx = body.x - this.cursor.x;
      const by = body.y - this.cursor.y;
      const toBody = Math.hypot(bx, by);
      // Closing speed: how fast the cursor is moving *at* the body, rather than
      // how fast it is moving in general. A fast cursor heading elsewhere is not
      // a swipe, and a slow, deliberate approach is someone reaching out to pick
      // it up — which has to be allowed to succeed.
      const closing = toBody < 1 ? this.speed
        : (bx * this.vel.x + by * this.vel.y) / toBody;
      if (toBody < radius + 70 && closing > 1000 && this.dodgeFor <= 0) {
        this.dodgeFor = 0.9;
        this.stance = STANCE.DODGE;
        this.sinceStance = 0;
        events.push({ type: 'dodged' });
      }
    }

    let tx = this.target.x;
    let ty = this.target.y;

    switch (this.stance) {
      case STANCE.DODGE: {
        const ax = body.x - this.cursor.x;
        const ay = body.y - this.cursor.y;
        const d = Math.hypot(ax, ay) || 1;
        tx = this.cursor.x + (ax / d) * (gap * 2.1);
        ty = this.cursor.y + (ay / d) * (gap * 1.6) - 40;
        if (this.dodgeFor <= 0) { this.stance = STANCE.SHOULDER; this.anchor.set = false; }
        break;
      }

      case STANCE.HOME: {
        if (!this.home) { this.stance = STANCE.EDGE; break; }
        tx = this.home.x;
        ty = this.home.y;
        break;
      }

      // Docked into the window's own title bar, sitting immediately left of the
      // minimise / maximise / close cluster — so it reads as one more tab on
      // that window, and travels with it when you drag the window around.
      //
      // The title bar is the one strip of a window that is never content, which
      // is why it is the only place a mascot can sit without being in the way.
      case STANCE.RIDE: {
        const r = this.app && this.app.rect;
        if (!r) { this.stance = STANCE.EDGE; break; }

        // The button cluster is about 138 DIP across on Windows 10 and 11
        // (three 46pt buttons); the extra few pixels keep the body from ever
        // touching Close, which would be an unpleasant thing to get wrong.
        const docked = r.x + r.w - CONTROLS_W - radius - 8;
        // A window too narrow for that gets the far left of its own bar rather
        // than a spot outside itself.
        tx = Math.max(r.x + radius * 0.6, docked);
        // Centred on the bar: half the body rides above the window edge, which
        // is what makes it read as attached to the window rather than floating
        // over its content.
        ty = r.y + TITLE_BAR_H * 0.5;
        break;
      }

      case STANCE.PERCH: {
        const r = this.app && this.app.rect;
        if (!r) { this.stance = STANCE.EDGE; break; }
        const fits = (x) => displays.some((d) =>
          x - radius >= d.x - 0.5 && x + radius <= d.x + d.w + 0.5);

        // Best: just outside the window's top-right corner — perched on the thing
        // you are working in without covering any of it. Then outside the left
        // edge. A maximized window has no outside, so fall back to riding its
        // right edge, low enough to clear the title bar and window controls.
        const outsideRight = r.x + r.w + radius * 0.15;
        const outsideLeft = r.x - radius * 0.15;
        if (fits(outsideRight)) {
          tx = outsideRight;
          ty = r.y + radius * 0.7;
        } else if (fits(outsideLeft)) {
          tx = outsideLeft;
          ty = r.y + radius * 0.7;
        } else {
          tx = r.x + r.w - radius * 0.75;
          ty = r.y + r.h * 0.34;
        }
        break;
      }

      case STANCE.EDGE: {
        const d = display;
        tx = d.x + d.w - radius - 24;
        ty = d.y + d.h * 0.34;
        break;
      }

      case STANCE.ROAM: {
        if (this.t > this.roamUntil) {
          this.roamUntil = this.t + rand(7, 15);
          const d = display;
          this.anchor.x = d.x + rand(radius + 40, d.w - radius - 40);
          this.anchor.y = d.y + rand(radius + 40, d.h * 0.75);
          this.anchor.set = true;
        }
        tx = this.anchor.x;
        ty = this.anchor.y;
        break;
      }

      case STANCE.SHOULDER:
      default: {
        // Re-anchor only once the cursor has clearly moved on AND come to rest.
        // Following the pointer's every sweep would make it a balloon on a
        // string; following where the pointer *lands* makes it a companion that
        // notices you moved to something else.
        const drifted = !this.anchor.set
          || Math.hypot(this.cursor.x - this.anchor.x, this.cursor.y - this.anchor.y) > 300;
        const settled = this.speed < 250 || this.sinceAnchor > 2.5;
        if (drifted && settled) {
          this.sinceAnchor = 0;
          this.anchor.x = this.cursor.x;
          this.anchor.y = this.cursor.y;
          this.anchor.set = true;
          // Prefer the side of the cursor with more room on this screen.
          const d = display;
          const spaceRight = d.x + d.w - this.cursor.x;
          const spaceLeft = this.cursor.x - d.x;
          this.side = spaceRight > spaceLeft ? 1 : -1;
          if (chance(0.25)) this.side *= -1;
        }
        if (!this.anchor.set) { this.anchor.x = this.cursor.x; this.anchor.y = this.cursor.y; this.anchor.set = true; }
        tx = this.anchor.x + this.side * gap;
        ty = this.anchor.y - gap * 0.5;
        break;
      }
    }

    // A slow figure-eight drift so it never hangs perfectly still in the air.
    // Riding is the exception: a body wobbling around on a title bar reads as
    // broken rather than alive, so it sits nearly still there.
    const amp = this.stance === STANCE.RIDE ? 2.5
      : this.stance === STANCE.HOME ? 9
      : this.stance === STANCE.SHOULDER ? 16 : 22;
    tx += this.drift.a(this.t * 0.22) * amp;
    ty += this.drift.b(this.t * 0.17) * amp * 0.7;

    // Two constraints now have to hold at once: stay clear of the cursor, and
    // keep the whole body on a real screen. Applying them in sequence does not
    // work — near an edge, clamping onto the screen pushes the target straight
    // back onto the cursor. So push away first, then, if the screen clamp undid
    // it, search around the cursor for the clearest spot that does fit.
    const onScreen = (x, y) => {
      const home = nearestDisplay(displays, x, y);
      return {
        x: clamp(x, home.x + radius, home.x + home.w - radius),
        y: clamp(y, home.y + radius, home.y + home.h - radius),
      };
    };

    // Riding is exempt from keeping clear of the cursor. The pointer has to be
    // on the title bar to drag the window, so a body that backs away from the
    // cursor there is a body that lets go of every window the moment it moves.
    const keepClear = this.enabled && this.cursor.has
      && this.stance !== STANCE.ROAM && this.stance !== STANCE.RIDE;
    if (keepClear) {
      const ax = tx - this.cursor.x;
      const ay = ty - this.cursor.y;
      const d = Math.hypot(ax, ay);
      if (d < gap) {
        const k = d < 1 ? gap : gap / d;
        tx = this.cursor.x + (d < 1 ? this.side : ax * k / gap) * gap;
        ty = this.cursor.y + (d < 1 ? -0.5 : ay * k / gap) * gap;
      }
    }

    let spot = onScreen(tx, ty);

    if (keepClear && Math.hypot(spot.x - this.cursor.x, spot.y - this.cursor.y) < gap - 1) {
      // Ring search: whichever direction gives the most clearance once the
      // result is pinned to the screen wins.
      const base = Math.atan2(ty - this.cursor.y, tx - this.cursor.x);
      let best = spot;
      let bestClear = Math.hypot(spot.x - this.cursor.x, spot.y - this.cursor.y);
      for (let i = 1; i <= 12; i++) {
        const a = base + (i / 12) * TAU;
        const p = onScreen(this.cursor.x + Math.cos(a) * gap * 1.06,
          this.cursor.y + Math.sin(a) * gap * 1.06);
        const clear = Math.hypot(p.x - this.cursor.x, p.y - this.cursor.y);
        if (clear > bestClear) { bestClear = clear; best = p; }
        if (bestClear >= gap) break;
      }
      spot = best;
    }

    this.target.x = spot.x;
    this.target.y = spot.y;
  }

  get summary() {
    return {
      stance: this.stance,
      typing: this.typing,
      speed: Math.round(this.speed),
      stillFor: +this.stillFor.toFixed(1),
      app: this.app ? this.app.label : null,
      kind: this.app ? this.app.kind : null,
    };
  }
}

function nearestDisplay(displays, x, y) {
  let best = displays[0];
  let bestScore = Infinity;
  for (const d of displays) {
    const dx = x < d.x ? d.x - x : x > d.x + d.w ? x - (d.x + d.w) : 0;
    const dy = y < d.y ? d.y - y : y > d.y + d.h ? y - (d.y + d.h) : 0;
    const score = dx * dx + dy * dy;
    if (score < bestScore) { bestScore = score; best = d; }
  }
  return best;
}
