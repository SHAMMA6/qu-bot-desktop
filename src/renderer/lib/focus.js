// How long you have actually been working in one place, and the patterns worth
// remarking on.
//
// The distinction that matters here is *active* time. Wall-clock time in a
// window is nearly useless — leaving the editor open while you make coffee is
// not ninety minutes of work. So the clock only advances while the OS reports
// recent input, which is the same signal the attention system already uses.

const MINUTE = 60;

// Milestones worth mentioning, in minutes of unbroken work. Deliberately sparse
// and widely spaced: a companion that pipes up every ten minutes is a timer.
const MILESTONES = [30, 60, 90, 120, 180, 240];

export class Focus {
  constructor() {
    this.kind = null;          // coarse app kind, e.g. 'editor'
    this.label = null;         // 'your editor'
    this.seconds = 0;          // active seconds in the current app
    this.idleFor = 0;
    this.announced = 0;        // highest milestone already mentioned

    // Alt-tab thrash detection: bouncing between the same two things usually
    // means you have lost something, not that you are being productive.
    this.recent = [];          // recent app kinds, newest last
    this.thrashCooldown = 0;

    this.sessionSeconds = 0;
    this.notedLateNight = false;
    this.perApp = new Map();   // kind -> active seconds this session
  }

  // The foreground app changed. Returns nothing; events come out of update().
  noteApp(kind, label) {
    if (!kind || kind === this.kind) return;
    this._bank();
    this.kind = kind;
    this.label = label || kind;
    this.seconds = 0;
    this.announced = 0;
    this.recent.push({ kind, at: this.sessionSeconds });
    if (this.recent.length > 12) this.recent.shift();
  }

  _bank() {
    if (!this.kind) return;
    this.perApp.set(this.kind, (this.perApp.get(this.kind) || 0) + this.seconds);
  }

  noteIdle(seconds) {
    this.idleFor = seconds;
  }

  update(dt, { chatty = true } = {}) {
    const events = [];
    this.sessionSeconds += dt;
    if (this.thrashCooldown > 0) this.thrashCooldown -= dt;

    // Only count time the user is actually present for.
    const active = this.idleFor < 45;
    if (active && this.kind) this.seconds += dt;

    // A long unbroken stretch in one app.
    if (chatty && this.kind) {
      const mins = Math.floor(this.seconds / MINUTE);
      for (const m of MILESTONES) {
        if (mins >= m && this.announced < m) {
          this.announced = m;
          events.push({ type: 'focusLong', minutes: m, app: this.label, kind: this.kind });
          break;
        }
      }
    }

    // Thrash: at least six switches inside 90 seconds covering only two apps.
    if (chatty && this.thrashCooldown <= 0 && this.recent.length >= 6) {
      const window = this.recent.filter((r) => this.sessionSeconds - r.at < 90);
      if (window.length >= 6) {
        const distinct = new Set(window.map((r) => r.kind));
        if (distinct.size === 2) {
          this.thrashCooldown = 10 * MINUTE;
          this.recent.length = 0;
          events.push({ type: 'thrash', apps: [...distinct] });
        }
      }
    }

    // The small hours, mentioned at most once per run.
    if (chatty && !this.notedLateNight && active) {
      const h = new Date().getHours();
      if (h >= 2 && h < 5) {
        this.notedLateNight = true;
        events.push({ type: 'lateNight', hour: h });
      }
    }

    return events;
  }

  // Answer to "how long have I been at this?".
  report() {
    const minutes = Math.round(this.seconds / MINUTE);
    return { minutes, app: this.label || 'this', kind: this.kind };
  }

  // Where this session actually went, longest first. Non-destructive: the
  // in-progress app is folded into a copy, so asking does not reset the clock
  // that the milestone events are counting on.
  breakdown() {
    const totals = new Map(this.perApp);
    if (this.kind) totals.set(this.kind, (totals.get(this.kind) || 0) + this.seconds);
    return [...totals.entries()]
      .map(([kind, seconds]) => ({ kind, minutes: Math.round(seconds / MINUTE) }))
      .filter((r) => r.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
  }
}
