// The mascot's autonomy. It keeps a few slow-moving meters and, when nothing
// else is going on, picks something to do. Everything it decides is emitted as an
// intent; the renderer decides how to perform it.

import { rand, pick, clamp, chance } from './geom.js';
import { say, greeting } from './dialogue.js';

const MINUTE = 60;

export class Brain {
  constructor(emit) {
    this.emit = emit;

    // Slow meters, all 0..1.
    this.energy = 1;        // drains while awake, refills asleep
    this.mood = 0.65;       // nudged by how it is treated
    this.boredom = 0;       // rises when ignored
    this.affection = 0.3;   // rises with petting, decays slowly

    this.sinceInteraction = 0;
    this.sinceAction = 0;
    this.nextActionIn = rand(6, 14);
    this.asleep = false;
    this.userAway = false;
    this.awaySeconds = 0;

    this.lastHourChimed = new Date().getHours();
    this.sessionSeconds = 0;
    this.lastBreakNudge = 0;

    this.enabled = { roam: true, chatter: true, sleep: true, nudges: true };
    this.suppressed = false;   // true while the user is actively handling it
  }

  interacted(weight = 1) {
    this.sinceInteraction = 0;
    this.boredom = clamp(this.boredom - 0.35 * weight, 0, 1);
    if (this.asleep) this.wake();
  }

  pleased(amount = 0.12) {
    this.mood = clamp(this.mood + amount, 0, 1);
    this.affection = clamp(this.affection + amount * 0.8, 0, 1);
  }

  displeased(amount = 0.12) {
    this.mood = clamp(this.mood - amount, 0, 1);
  }

  sleep() {
    if (this.asleep) return;
    this.asleep = true;
    this.emit({ type: 'emotion', key: 'sleeping', sticky: true });
  }

  wake(withLine = true) {
    if (!this.asleep) return;
    this.asleep = false;
    this.energy = clamp(this.energy + 0.45, 0, 1);
    this.emit({ type: 'emotion', key: 'surprised' });
    if (withLine && this.enabled.chatter) this.emit({ type: 'say', text: say('wake'), delay: 0.35 });
  }

  setUserAway(away) {
    if (away === this.userAway) return;
    this.userAway = away;
    if (away) {
      this.awaySeconds = 0;
    } else {
      const gone = this.awaySeconds;
      this.awaySeconds = 0;
      if (this.asleep) this.wake(false);
      if (gone > 4 * MINUTE) {
        this.emit({ type: 'emotion', key: gone > 25 * MINUTE ? 'excited' : 'happy' });
        if (this.enabled.chatter) this.emit({ type: 'say', text: say('returned'), delay: 0.4 });
      }
    }
  }

  greet() {
    this.emit({ type: 'emotion', key: 'happy' });
    if (this.enabled.chatter) this.emit({ type: 'say', text: greeting(), delay: 0.5 });
  }

  update(dt, ctx) {
    this.sessionSeconds += dt;
    this.sinceInteraction += dt;
    this.sinceAction += dt;
    if (this.userAway) this.awaySeconds += dt;

    // Meters.
    const drain = this.asleep ? -0.055 : 0.0055;      // ~3min to refill, ~3h to drain
    this.energy = clamp(this.energy - drain * dt, 0, 1);
    this.affection = clamp(this.affection - 0.004 * dt, 0, 1);
    this.mood = clamp(this.mood + (0.6 - this.mood) * 0.01 * dt, 0, 1);
    if (!this.asleep && this.sinceInteraction > 20) this.boredom = clamp(this.boredom + 0.012 * dt, 0, 1);

    if (this.suppressed || ctx.busy) { this.sinceAction = 0; return; }

    // Hourly chime.
    const hour = new Date().getHours();
    if (hour !== this.lastHourChimed) {
      this.lastHourChimed = hour;
      if (this.enabled.nudges && !this.asleep && !this.userAway && chance(0.5)) {
        this.emit({ type: 'emotion', key: 'alert' });
        this.emit({ type: 'say', text: say('hourChime'), delay: 0.3 });
        this.sinceAction = 0;
        return;
      }
    }

    // Break nudge after a long unbroken stretch.
    if (this.enabled.nudges && !this.userAway && !this.asleep &&
        this.sessionSeconds - this.lastBreakNudge > 50 * MINUTE) {
      this.lastBreakNudge = this.sessionSeconds;
      this.emit({ type: 'emotion', key: 'pleading' });
      this.emit({ type: 'say', text: say('breakNudge'), delay: 0.3 });
      this.sinceAction = 0;
      return;
    }

    // Drift toward sleep when tired, ignored, or the user has wandered off.
    if (this.enabled.sleep && !this.asleep) {
      const tired = this.energy < 0.12;
      const abandoned = this.userAway && this.awaySeconds > 3 * MINUTE;
      if (tired || abandoned) {
        if (ctx.emotionKey !== 'sleepy') {
          this.emit({ type: 'emotion', key: 'sleepy', sticky: true });
          if (this.enabled.chatter && tired) this.emit({ type: 'say', text: say('sleepy') });
          this.sinceAction = 0;
        } else if (this.sinceAction > 6) {
          this.sleep();
          this.sinceAction = 0;
        }
        return;
      }
    }

    if (this.asleep) return;

    if (this.sinceAction < this.nextActionIn) return;
    this.sinceAction = 0;
    this.nextActionIn = rand(7, 20) * (1 - this.boredom * 0.4);

    this.act(ctx);
  }

  // Weighted pick over the things it could do right now.
  act(ctx) {
    const opts = [];
    const w = (weight, fn) => { if (weight > 0) opts.push({ weight, fn }); };

    w(3, () => this.emit({ type: 'emotion', key: pick(['lookLeft', 'lookRight', 'lookUp', 'lookDown']) }));
    w(2, () => this.emit({ type: 'emotion', key: 'curious' }));
    w(1.4 + this.boredom * 3, () => {
      this.emit({ type: 'emotion', key: 'bored' });
      if (this.enabled.chatter && chance(0.6)) this.emit({ type: 'say', text: say('bored'), delay: 0.5 });
    });
    w(this.enabled.chatter ? 2.2 : 0, () => {
      this.emit({ type: 'emotion', key: pick(['neutral', 'thinking', 'content']) });
      this.emit({ type: 'say', text: say('idleMusing'), delay: 0.3 });
    });
    w(this.mood * 2.4, () => this.emit({ type: 'emotion', key: pick(['happy', 'content', 'wink']) }));
    w(this.affection * 2, () => {
      this.emit({ type: 'emotion', key: 'love' });
    });
    w((1 - this.mood) * 1.6, () => this.emit({ type: 'emotion', key: pick(['annoyed', 'sad', 'skeptical']) }));
    // Walking and hopping need a floor. In flight the attention system is
    // already moving the body around, so the brain contributes flourishes
    // instead of navigation.
    const grounded = ctx.canMove && !ctx.flying;
    w(this.enabled.roam && grounded ? 2.6 : 0, () => this.emit({ type: 'walk', duration: rand(2.5, 6) }));
    w(this.enabled.roam && grounded ? 1.8 : 0, () => this.emit({ type: 'hop', power: rand(0.55, 1) }));
    w(ctx.flying ? 1.5 : 0, () => this.emit({ type: 'flourish' }));
    w(ctx.flying && ctx.stance === 'shoulder' ? 1.2 : 0, () => {
      this.emit({ type: 'emotion', key: pick(['listening', 'curious', 'content']) });
      if (this.enabled.chatter && chance(0.4)) this.emit({ type: 'say', text: say('watching'), delay: 0.3 });
    });
    // Visiting the other monitor is rare on purpose — it is a big move, and the
    // user should not have to hunt for where the mascot went.
    w(this.enabled.roam && ctx.canMove && ctx.screens > 1 ? 0.7 : 0, () => this.emit({ type: 'travel' }));
    w(1.2, () => this.emit({ type: 'emotion', key: 'peek' }));
    w(this.energy < 0.35 ? 2.5 : 0, () => this.emit({ type: 'emotion', key: 'sleepy' }));

    const total = opts.reduce((s, o) => s + o.weight, 0);
    let r = Math.random() * total;
    for (const o of opts) { r -= o.weight; if (r <= 0) return o.fn(); }
    opts[0]?.fn();
  }

  get status() {
    return {
      energy: this.energy, mood: this.mood, boredom: this.boredom,
      affection: this.affection, asleep: this.asleep, userAway: this.userAway,
    };
  }
}
