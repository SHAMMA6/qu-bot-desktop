// Things you can do to the mascot that are not clicks.
//
// A click is a message: it either happened or it did not. Everything in here is
// a *pattern* in the cursor feed instead — holding it and going nowhere, winding
// the pointer around it, shaking it, loitering beside it, staring at it. None of
// them need explaining and none of them appear in a menu, which is the point:
// you find them by fiddling, the way you find out what a cat will put up with.
//
// Kept separate from mascot.js because every rule here is a threshold that had
// to be tuned against a real hand, and thresholds are exactly what wants a test.
// This module decides only *that* something happened; what the bot does about it
// is the renderer's business.

import { TAU } from './geom.js';

// How far the cursor must travel between samples to count as deliberate motion
// rather than the tremor of a hand resting on a mouse.
const TWITCH = 2;
const SHAKE_STEP = 6;

export class Gestures {
  constructor() {
    this.t = 0;
    this.last = { x: 0, y: 0, has: false };

    // Held and going nowhere.
    this.holdStill = 0;
    this.hugging = false;

    // Shaken: fast direction reversals while held.
    this.shakeReversals = 0;
    this.shakeWindow = 0;
    this.lastDragDir = 0;
    this.shookAt = -99;

    // Wound around: signed angle swept about the body.
    this.orbit = 0;
    this.lastOrbitA = null;
    this.orbitWindow = 0;
    this.orbitedAt = -99;

    // Loitering nearby without touching.
    this.hoverNearFor = 0;
    this.hoverNearAt = -99;

    // Eye contact.
    this.stareFor = 0;
    this.staring = false;
    this.stareLimit = 7;

    // Clicks, which are a click, but the *rate* of them is a pattern.
    this.pokeStreak = 0;
    this.pokeWindow = 0;
  }

  // How hard the last poke landed, 0..3. Escalation lives here rather than at
  // the call site so the whole ladder is one thing you can read and test:
  // a first poke is a surprise, a fourth is an intrusion, a tenth is a bit.
  poke(mood = 0.6) {
    this.pokeStreak += 1;
    this.pokeWindow = 3.2;
    if (this.pokeStreak > 9) return 3;
    if (this.pokeStreak > 5) return 2;
    if (mood < 0.3 || this.pokeStreak > 3) return 1;
    return 0;
  }

  // Called when the body is picked up and put down, so a drag never carries
  // state into the next one.
  grabbed() {
    this.holdStill = 0;
    this.shakeReversals = 0;
    this.lastDragDir = 0;
  }

  released() {
    const wasHugging = this.hugging;
    this.hugging = false;
    this.holdStill = 0;
    this.shakeReversals = 0;
    this.lastDragDir = 0;
    return wasHugging;
  }

  // ctx: { cursor:{x,y,has}, body:{x,y}, radius, dragging, onBody, asleep, speed, quiet }
  // `speed` is the smoothed cursor speed in px/s; `quiet` suppresses the
  // gestures that start a conversation, without stopping the ones that are a
  // direct answer to being handled.
  update(dt, ctx) {
    const events = [];
    this.t += dt;

    if (this.shakeWindow > 0) { this.shakeWindow -= dt; if (this.shakeWindow <= 0) this.shakeReversals = 0; }
    if (this.orbitWindow > 0) { this.orbitWindow -= dt; if (this.orbitWindow <= 0) this.orbit = 0; }
    if (this.pokeWindow > 0) { this.pokeWindow -= dt; if (this.pokeWindow <= 0) this.pokeStreak = 0; }

    const { cursor, body, radius, dragging, onBody, asleep } = ctx;
    if (!cursor || !cursor.has) { this.last.has = false; return events; }

    const dx = this.last.has ? cursor.x - this.last.x : 0;
    const dy = this.last.has ? cursor.y - this.last.y : 0;
    const step = Math.hypot(dx, dy);
    const first = !this.last.has;
    this.last.x = cursor.x;
    this.last.y = cursor.y;
    this.last.has = true;
    if (first) return events;

    if (dragging) {
      // ---- held ------------------------------------------------------------
      this.holdStill = step > TWITCH ? 0 : this.holdStill + dt;
      if (!this.hugging && this.holdStill > 0.9) {
        this.hugging = true;
        events.push({ type: 'hug' });
      }

      // ---- shaken ----------------------------------------------------------
      // The speed gate is what separates being shaken from being carried
      // somewhere by a route that happens to double back.
      const dir = Math.sign(dx);
      if (step > SHAKE_STEP && dir !== 0) {
        if (this.lastDragDir !== 0 && dir !== this.lastDragDir) {
          this.shakeReversals += 1;
          this.shakeWindow = 0.9;
          if (this.shakeReversals >= 4 && this.t - this.shookAt > 4) {
            this.shakeReversals = 0;
            this.shookAt = this.t;
            this.hugging = false;
            events.push({ type: 'shaken' });
          }
        }
        this.lastDragDir = dir;
      }
      // Nothing else applies while it is in your hand.
      this.lastOrbitA = null;
      this.orbit = 0;
      this.hoverNearFor = 0;
      this.stareFor = 0;
      this.staring = false;
      return events;
    }

    const dist = Math.hypot(cursor.x - body.x, cursor.y - body.y);

    // ---- wound around ------------------------------------------------------
    // Accumulated as *signed* angle, so back-and-forth cancels out and only a
    // real orbit adds up. Winding a finger around something is already what
    // "make it dizzy" looks like, so nobody needs to be told this one exists.
    const inReach = dist < radius * 3.8 && !onBody;
    if (inReach) {
      const a = Math.atan2(cursor.y - body.y, cursor.x - body.x);
      if (this.lastOrbitA !== null) {
        let d = a - this.lastOrbitA;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        // Ignore the jitter of a resting hand, and the jump of a cursor that
        // crossed over the body rather than travelling around it.
        if (Math.abs(d) > 0.02 && Math.abs(d) < 1.2) {
          if (this.orbit !== 0 && Math.sign(d) !== Math.sign(this.orbit)) this.orbit = 0;
          this.orbit += d;
          this.orbitWindow = 1.4;
          if (Math.abs(this.orbit) > TAU * 2.2 && this.t - this.orbitedAt > 8) {
            this.orbit = 0;
            this.orbitedAt = this.t;
            events.push({ type: 'orbited' });
          }
        }
      }
      this.lastOrbitA = a;
    } else {
      this.lastOrbitA = null;
      this.orbit = 0;
    }

    if (asleep) { this.hoverNearFor = 0; this.stareFor = 0; this.staring = false; return events; }

    // ---- loitering beside it ----------------------------------------------
    // Somebody hovering at your shoulder is a thing you notice, and noticing it
    // is most of what makes the bot feel like it is in the room.
    const beside = !onBody && dist > radius * 1.05 && dist < radius * 3 && (ctx.speed ?? 0) < 260;
    if (beside && !ctx.quiet) {
      this.hoverNearFor += dt;
      if (this.hoverNearFor > 1.6 && this.t - this.hoverNearAt > 25) {
        this.hoverNearFor = 0;
        this.hoverNearAt = this.t;
        events.push({ type: 'hoverNear' });
      }
    } else {
      this.hoverNearFor = 0;
    }

    // ---- eye contact -------------------------------------------------------
    // Both of you holding still, cursor parked on the body. It stares back and
    // it always loses — a bot that never blinks first would be no fun to play.
    const eligible = onBody && (ctx.speed ?? 0) < 40 && !ctx.quiet;
    if (!eligible) {
      this.staring = false;
      this.stareFor = 0;
    } else {
      this.stareFor += dt;
      if (!this.staring && this.stareFor > 2.4) {
        this.staring = true;
        events.push({ type: 'stare' });
      } else if (this.staring && this.stareFor > this.stareLimit) {
        this.staring = false;
        // Negative, so walking away and coming back does not restart the
        // contest instantly. It needs a moment before it will play again.
        this.stareFor = -6;
        events.push({ type: 'stareLost' });
      }
    }

    return events;
  }
}
