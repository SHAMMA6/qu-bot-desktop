// Tiny JSON settings store in userData. Writes are debounced so dragging the
// mascot around does not hammer the disk.
//
// Two kinds of state live here. `settings` are things the user chose. `bond` is
// what the mascot has accumulated about the two of you — meters, counters and
// dates. They share a file but are sanitized separately, because a corrupt
// counter should not be able to reset someone's colour scheme and vice versa.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  name: 'QU Bot',
  coat: 'chalk',
  customCoat: '#885CF5',
  shape: 'blob',
  size: 128,
  opacity: 1,
  gravity: false,        // off = it flies; on = the old grounded desk pet
  roam: true,
  followCursor: true,    // drift around whatever you are pointing at
  watchActivity: true,   // notice which app is in front (see awareness.cjs)
  rideWindows: true,     // perch on the title bar and ride it when it moves
  chatter: true,
  sleepWhenIdle: true,
  nudges: true,
  gazeFollowsCursor: true,
  alwaysOnTop: true,
  soundEnabled: true,
  volume: 0.5,
  launchOnLogin: false,
  greetOnLaunch: true,
  // What it wears: 'auto' follows the calendar, 'none' is bare, or name one
  // outright and it keeps it all year.
  accessory: 'auto',
  machineAware: true,    // react to battery, network and load
  focusReports: true,    // notice and mention long stretches in one app
  autoUpdate: true,
  // How tightly the body follows the cursor while held, 0..1. Low values feel
  // heavy and laggy; this defaults high because "responsive" reads as alive.
  grabResponse: 0.8,
  // Personality, all 0..1. These scale the weights the brain already uses, so
  // two people's bots genuinely behave differently.
  chatty: 0.5,
  clingy: 0.5,
  sassy: 0.5,
  // A spot the user picked. While they are heads-down working, the mascot parks
  // here instead of hovering around the cursor.
  home: null,            // { x, y } in absolute desktop coordinates
  homeWhenBusy: true,
  focusMode: false,      // go home, go quiet, stay put
  pomodoroWork: 25,
  pomodoroBreak: 5,
  position: null,
  displayId: null,
};

// Everything the mascot remembers about you between launches.
const BOND_DEFAULTS = {
  firstMet: null,        // ISO date string, set on first ever run
  lastSeen: null,
  days: 0,               // distinct calendar days seen
  sessions: 0,
  seconds: 0,            // total time together
  pokes: 0,
  pets: 0,
  tickles: 0,
  throws: 0,
  // The four slow meters. Persisting these is the whole point: a mascot that
  // forgets it likes you every time you reboot is not a companion.
  mood: 0.65,
  affection: 0.3,
  energy: 1,
  boredom: 0,
};

// Everything it can wear. 'auto' picks by date; 'none' is bare.
const ACCESSORIES = ['auto', 'none', 'santa', 'witch', 'party', 'shades'];

const num = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};

class Store {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'settings.json');
    this.data = { ...DEFAULTS };
    this.bond = { ...BOND_DEFAULTS };
    this.timers = [];
    this.shelf = [];
    this._timer = null;
    this.load();
  }

  load() {
    let parsed = null;
    try {
      parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      // No file yet, or it is unreadable — defaults are fine.
    }
    if (parsed) {
      // Only accept keys we know about, so a stale file cannot inject junk.
      for (const k of Object.keys(DEFAULTS)) {
        if (parsed[k] !== undefined) this.data[k] = parsed[k];
      }
      if (parsed.bond && typeof parsed.bond === 'object') {
        for (const k of Object.keys(BOND_DEFAULTS)) {
          if (parsed.bond[k] !== undefined) this.bond[k] = parsed.bond[k];
        }
      }
      // Migration: the old boolean became a choice. Someone who had switched
      // seasonal hats off meant "none", not "back to automatic".
      if (parsed.accessory === undefined && parsed.seasonal === false) this.data.accessory = 'none';
      if (Array.isArray(parsed.timers)) this.timers = parsed.timers;
      if (Array.isArray(parsed.shelf)) this.shelf = parsed.shelf;
    }
    this.sanitize();
    this.sanitizeBond();
  }

  sanitize() {
    const d = this.data;
    d.size = num(d.size, 64, 260, DEFAULTS.size);
    d.opacity = num(d.opacity, 0.25, 1, DEFAULTS.opacity);
    d.volume = num(d.volume, 0, 1, DEFAULTS.volume);
    d.grabResponse = num(d.grabResponse, 0, 1, DEFAULTS.grabResponse);
    d.chatty = num(d.chatty, 0, 1, DEFAULTS.chatty);
    d.clingy = num(d.clingy, 0, 1, DEFAULTS.clingy);
    d.sassy = num(d.sassy, 0, 1, DEFAULTS.sassy);
    d.pomodoroWork = Math.round(num(d.pomodoroWork, 5, 120, DEFAULTS.pomodoroWork));
    if (!ACCESSORIES.includes(d.accessory)) d.accessory = DEFAULTS.accessory;
    d.pomodoroBreak = Math.round(num(d.pomodoroBreak, 1, 60, DEFAULTS.pomodoroBreak));

    if (typeof d.customCoat !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(d.customCoat)) {
      d.customCoat = DEFAULTS.customCoat;
    }
    // A name is shown in speech bubbles and menus, so cap it and strip control
    // characters rather than trusting whatever ends up in the file.
    d.name = [...String(d.name ?? DEFAULTS.name)]
      .filter((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
      .join('')
      .trim()
      .slice(0, 24) || DEFAULTS.name;

    if (d.home && typeof d.home === 'object' && Number.isFinite(Number(d.home.x))
        && Number.isFinite(Number(d.home.y))) {
      d.home = { x: Math.round(Number(d.home.x)), y: Math.round(Number(d.home.y)) };
    } else {
      d.home = null;
    }

    for (const k of ['gravity', 'roam', 'chatter', 'sleepWhenIdle', 'nudges',
      'gazeFollowsCursor', 'alwaysOnTop', 'soundEnabled', 'launchOnLogin', 'greetOnLaunch',
      'followCursor', 'watchActivity', 'rideWindows', 'machineAware',
      'focusReports', 'autoUpdate', 'homeWhenBusy', 'focusMode']) {
      d[k] = !!d[k];
    }
  }

  sanitizeBond() {
    const b = this.bond;
    for (const k of ['mood', 'affection', 'energy', 'boredom']) {
      b[k] = num(b[k], 0, 1, BOND_DEFAULTS[k]);
    }
    for (const k of ['days', 'sessions', 'seconds', 'pokes', 'pets', 'tickles', 'throws']) {
      b[k] = Math.max(0, Math.round(num(b[k], 0, Number.MAX_SAFE_INTEGER, 0)));
    }
    for (const k of ['firstMet', 'lastSeen']) {
      if (typeof b[k] !== 'string' || Number.isNaN(Date.parse(b[k]))) b[k] = null;
    }
  }

  get all() { return { ...this.data }; }

  get(key) { return this.data[key]; }

  set(patch) {
    Object.assign(this.data, patch);
    this.sanitize();
    this.save();
    return this.all;
  }

  reset() {
    // Deliberately keeps `bond` and `position`. Restoring defaults is about
    // appearance and behaviour; it should not wipe a relationship built over
    // weeks, which the user would have no way to get back.
    const position = this.data.position;
    const home = this.data.home;
    this.data = { ...DEFAULTS, position, home };
    this.save();
    return this.all;
  }

  // ---- bond ---------------------------------------------------------------

  // Called once per launch. Rolls the day counter over and returns a small
  // summary of what changed, which is what the greeting is built from.
  startSession(now = new Date()) {
    const b = this.bond;
    const today = now.toISOString().slice(0, 10);
    const first = !b.firstMet;
    if (first) { b.firstMet = now.toISOString(); b.days = 1; }
    const last = b.lastSeen ? new Date(b.lastSeen) : null;
    const lastDay = last ? last.toISOString().slice(0, 10) : null;
    if (!first && lastDay !== today) b.days += 1;
    const awayMs = last ? now - last : 0;
    b.sessions += 1;
    b.lastSeen = now.toISOString();
    this.save();
    return {
      first,
      newDay: lastDay !== today,
      awayHours: last ? awayMs / 3600000 : 0,
      ...this.bondSummary(now),
    };
  }

  bondSummary(now = new Date()) {
    const b = this.bond;
    const since = b.firstMet ? Math.floor((now - new Date(b.firstMet)) / 86400000) + 1 : 1;
    const interactions = b.pokes + b.pets + b.tickles + b.throws;
    // Bond level 0..4, from time known, time together and how much you actually
    // handle it. Deliberately slow: level 4 is weeks of real use, so the lines
    // it unlocks stay rare enough to land.
    const score = Math.min(1, since / 45) * 0.3
      + Math.min(1, b.seconds / (40 * 3600)) * 0.3
      + Math.min(1, interactions / 600) * 0.2
      + b.affection * 0.2;
    return {
      ...b,
      daysKnown: since,
      interactions,
      level: Math.max(0, Math.min(4, Math.floor(score * 5))),
    };
  }

  // The renderer owns the meters while running and pushes them back here.
  updateBond(patch) {
    if (!patch || typeof patch !== 'object') return;
    for (const k of Object.keys(BOND_DEFAULTS)) {
      if (patch[k] !== undefined) this.bond[k] = patch[k];
    }
    this.sanitizeBond();
    this.save();
  }

  bumpBond(key, by = 1) {
    if (!(key in BOND_DEFAULTS)) return;
    this.bond[key] = (this.bond[key] || 0) + by;
    this.sanitizeBond();
    this.save();
  }

  resetBond() {
    this.bond = { ...BOND_DEFAULTS, firstMet: new Date().toISOString() };
    this.save();
    return this.bondSummary();
  }

  // ---- lists --------------------------------------------------------------

  setTimers(list) {
    this.timers = Array.isArray(list) ? list : [];
    this.save();
  }

  setShelf(list) {
    this.shelf = Array.isArray(list) ? list : [];
    this.save();
  }

  // ---- persistence --------------------------------------------------------

  serialize() {
    return JSON.stringify({
      ...this.data,
      bond: this.bond,
      timers: this.timers,
      shelf: this.shelf,
    }, null, 2);
  }

  save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 400);
  }

  flush() {
    clearTimeout(this._timer);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, this.serialize());
    } catch (err) {
      // On shutdown there is nothing useful to do about this.
      if (!app.isQuitting) console.error('[qubot] could not save settings:', err.message);
    }
  }
}

module.exports = { Store, DEFAULTS, BOND_DEFAULTS, ACCESSORIES };
