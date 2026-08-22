// Tiny JSON settings store in userData. Writes are debounced so dragging the
// mascot around does not hammer the disk.

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  coat: 'chalk',
  customCoat: '#885CF5',
  shape: 'blob',
  size: 128,
  opacity: 1,
  gravity: false,        // off = it flies; on = the old grounded desk pet
  roam: true,
  followCursor: true,    // drift around whatever you are pointing at
  watchActivity: true,   // notice which app is in front (see awareness.cjs)
  chatter: true,
  sleepWhenIdle: true,
  nudges: true,
  gazeFollowsCursor: true,
  alwaysOnTop: true,
  soundEnabled: false,
  launchOnLogin: false,
  greetOnLaunch: true,
  position: null,
  displayId: null,
};

class Store {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'settings.json');
    this.data = { ...DEFAULTS };
    this._timer = null;
    this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      // Only accept keys we know about, so a stale file cannot inject junk.
      for (const k of Object.keys(DEFAULTS)) {
        if (parsed[k] !== undefined) this.data[k] = parsed[k];
      }
    } catch {
      // No file yet, or it is unreadable — defaults are fine.
    }
    this.sanitize();
  }

  sanitize() {
    const d = this.data;
    d.size = Math.max(64, Math.min(260, Number(d.size) || 128));
    d.opacity = Math.max(0.25, Math.min(1, Number(d.opacity) || 1));
    if (typeof d.customCoat !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(d.customCoat)) d.customCoat = DEFAULTS.customCoat;
    for (const k of ['gravity', 'roam', 'chatter', 'sleepWhenIdle', 'nudges',
      'gazeFollowsCursor', 'alwaysOnTop', 'soundEnabled', 'launchOnLogin', 'greetOnLaunch',
      'followCursor', 'watchActivity']) {
      d[k] = !!d[k];
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
    const position = this.data.position;
    this.data = { ...DEFAULTS, position };
    this.save();
    return this.all;
  }

  save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
      } catch (err) {
        console.error('[qubot] could not save settings:', err.message);
      }
    }, 400);
  }

  flush() {
    clearTimeout(this._timer);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch { /* shutting down; nothing useful to do */ }
  }
}

module.exports = { Store, DEFAULTS };
