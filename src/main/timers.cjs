// Timers, alarms and the pomodoro cycle.
//
// These live in the main process rather than the renderer because they have to
// survive the overlay window being hidden, moved between monitors or reloaded —
// and because a timer that silently stops counting is worse than no timer.
//
// State is persisted, so a 45-minute timer survives a restart. An alarm that is
// only slightly overdue still fires (you want to know); one that is badly
// overdue is dropped, because being told at 9am about a timer set at midnight
// is noise, not a reminder.

const GRACE_MS = 5 * 60 * 1000;   // fire if overdue by less than this
const MAX_TIMERS = 12;

let seq = 0;
const nextId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

class Timers {
  constructor(store, onFire) {
    this.store = store;
    this.onFire = onFire;
    this.list = [];
    this.tick = null;
    this.pomodoro = null;      // { phase: 'work'|'break', id }
    this._restore();
  }

  _restore() {
    const now = Date.now();
    const saved = Array.isArray(this.store.timers) ? this.store.timers : [];
    const kept = [];
    for (const t of saved) {
      if (!t || typeof t.fireAt !== 'number') continue;
      // Badly overdue alarms are dropped rather than fired on launch.
      if (t.fireAt < now - GRACE_MS) continue;
      kept.push({
        id: typeof t.id === 'string' ? t.id : nextId(),
        label: String(t.label || 'timer').slice(0, 60),
        fireAt: t.fireAt,
        minutes: Number(t.minutes) || 0,
        kind: t.kind === 'pomodoro-work' || t.kind === 'pomodoro-break' ? t.kind : 'timer',
      });
    }
    this.list = kept.slice(0, MAX_TIMERS);
    // A pomodoro mid-cycle when the app closed carries on where it left off.
    const p = this.list.find((t) => t.kind.startsWith('pomodoro'));
    if (p) this.pomodoro = { phase: p.kind === 'pomodoro-work' ? 'work' : 'break', id: p.id };
    this._persist();
  }

  _persist() {
    this.store.setTimers(this.list);
  }

  start() {
    this.stop();
    this.tick = setInterval(() => this._check(), 1000);
  }

  stop() {
    clearInterval(this.tick);
    this.tick = null;
  }

  _check() {
    const now = Date.now();
    const due = this.list.filter((t) => t.fireAt <= now);
    if (!due.length) return;
    this.list = this.list.filter((t) => t.fireAt > now);
    for (const t of due) this._fire(t);
    this._persist();
  }

  _fire(t) {
    if (t.kind === 'pomodoro-work') {
      // A work block ended: straight into a break.
      const mins = this.store.get('pomodoroBreak');
      const next = this._schedule(mins, 'break', 'pomodoro-break');
      this.pomodoro = { phase: 'break', id: next.id };
      this.onFire({ kind: 'pomodoro-break', minutes: mins, label: 'break' });
      return;
    }
    if (t.kind === 'pomodoro-break') {
      const mins = this.store.get('pomodoroWork');
      const next = this._schedule(mins, 'focus', 'pomodoro-work');
      this.pomodoro = { phase: 'work', id: next.id };
      this.onFire({ kind: 'pomodoro-work', minutes: mins, label: 'focus' });
      return;
    }
    this.onFire({ kind: 'timer', minutes: t.minutes, label: t.label });
  }

  _schedule(minutes, label, kind) {
    const entry = {
      id: nextId(),
      label: String(label || 'timer').slice(0, 60),
      minutes: Math.max(1, Math.round(minutes)),
      fireAt: Date.now() + Math.max(1, Math.round(minutes)) * 60000,
      kind: kind || 'timer',
    };
    this.list.push(entry);
    this._persist();
    return entry;
  }

  // ---- public ------------------------------------------------------------

  add(minutes, label) {
    const mins = Math.max(1, Math.min(24 * 60, Math.round(Number(minutes) || 0)));
    if (!mins) return null;
    if (this.list.filter((t) => t.kind === 'timer').length >= MAX_TIMERS) return null;
    return this._schedule(mins, label || `${mins} minute timer`, 'timer');
  }

  cancel(id) {
    const before = this.list.length;
    this.list = this.list.filter((t) => t.id !== id);
    if (this.pomodoro && this.pomodoro.id === id) this.pomodoro = null;
    if (this.list.length !== before) { this._persist(); return true; }
    return false;
  }

  clear() {
    this.list = [];
    this.pomodoro = null;
    this._persist();
  }

  startPomodoro() {
    this.list = this.list.filter((t) => !t.kind.startsWith('pomodoro'));
    const mins = this.store.get('pomodoroWork');
    const entry = this._schedule(mins, 'focus', 'pomodoro-work');
    this.pomodoro = { phase: 'work', id: entry.id };
    return { minutes: mins };
  }

  stopPomodoro() {
    this.list = this.list.filter((t) => !t.kind.startsWith('pomodoro'));
    this.pomodoro = null;
    this._persist();
  }

  // What the UI shows: remaining seconds, soonest first.
  snapshot() {
    const now = Date.now();
    return {
      pomodoro: this.pomodoro ? this.pomodoro.phase : null,
      timers: this.list
        .map((t) => ({
          id: t.id,
          label: t.label,
          kind: t.kind,
          remaining: Math.max(0, Math.round((t.fireAt - now) / 1000)),
        }))
        .sort((a, b) => a.remaining - b.remaining),
    };
  }
}

module.exports = { Timers };
