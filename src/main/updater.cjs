// Keeping the app up to date.
//
// Not every build CAN update itself, and pretending otherwise is worse than
// saying so: a silent no-op looks identical to "you are on the latest version".
//
//   NSIS installer (Windows)  yes
//   AppImage (Linux)          yes, but only when actually run as the AppImage
//   Portable .exe             no — there is no install to replace
//   macOS                     no unless signed; Squirrel.Mac refuses unsigned
//   Development               no feed to check against
//
// So capability is worked out first, reported honestly, and the updater is only
// wired up when there is something it can actually do.

const CHECK_EVERY = 6 * 60 * 60 * 1000;
const FIRST_CHECK_AFTER = 8000;

// Pure, so it can be tested without Electron. `env` and `platform` are injected
// for the same reason.
function updateCapability({ packaged, platform, env = {}, target = null }) {
  if (!packaged) {
    return { can: false, reason: 'this is a development build' };
  }
  // electron-builder sets this for portable builds. A portable exe is a single
  // self-extracting file with nothing installed to swap out.
  if (env.PORTABLE_EXECUTABLE_DIR || target === 'portable') {
    return { can: false, reason: 'portable builds cannot update themselves — download the new one' };
  }
  if (platform === 'darwin') {
    // Squirrel.Mac validates the signature before swapping the bundle, so an
    // unsigned build can download an update and then refuse to apply it.
    if (!env.EMOO_SIGNED) {
      return { can: false, reason: 'unsigned macOS builds cannot self-update — download the new one' };
    }
    return { can: true };
  }
  if (platform === 'linux') {
    if (!env.APPIMAGE) {
      return { can: false, reason: 'only the AppImage build can update itself' };
    }
    return { can: true };
  }
  if (platform === 'win32') return { can: true };
  return { can: false, reason: `no update channel for ${platform}` };
}

class Updater {
  constructor(store, onState) {
    this.store = store;
    this.onState = onState || (() => {});
    this.timer = null;
    this.impl = null;
    this.checking = false;

    const { app } = require('electron');
    this.capability = updateCapability({
      packaged: app.isPackaged,
      platform: process.platform,
      env: process.env,
    });

    this.state = this.capability.can
      ? { status: 'idle', version: null, percent: 0, reason: null }
      : { status: 'unsupported', version: null, percent: 0, reason: this.capability.reason };
  }

  get enabled() { return this.capability.can && !!this.store.get('autoUpdate'); }

  get ready() { return this.state.status === 'ready'; }

  _set(patch) {
    this.state = { ...this.state, ...patch };
    this.onState(this.state);
  }

  // Loaded lazily and guarded: a missing or broken updater must degrade to
  // "cannot update", never take the app down.
  _load() {
    if (this.impl) return this.impl;
    if (!this.capability.can) return null;
    let autoUpdater;
    try {
      ({ autoUpdater } = require('electron-updater'));
    } catch (err) {
      this._set({ status: 'unsupported', reason: 'the updater component is missing' });
      return null;
    }
    autoUpdater.autoDownload = false;        // decided per check, below
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = null;

    autoUpdater.on('update-available', (info) => {
      this._set({ status: 'available', version: info && info.version });
      if (this.store.get('autoUpdate')) {
        this._set({ status: 'downloading', percent: 0 });
        autoUpdater.downloadUpdate().catch((err) => this._fail(err));
      }
    });
    autoUpdater.on('update-not-available', () => {
      this._set({ status: 'none', version: null, percent: 0 });
    });
    autoUpdater.on('download-progress', (p) => {
      this._set({ status: 'downloading', percent: Math.round((p && p.percent) || 0) });
    });
    autoUpdater.on('update-downloaded', (info) => {
      this._set({ status: 'ready', version: (info && info.version) || null, percent: 100 });
    });
    autoUpdater.on('error', (err) => this._fail(err));

    this.impl = autoUpdater;
    return autoUpdater;
  }

  _fail(err) {
    const message = (err && err.message) || String(err || 'unknown error');
    // Being offline is not worth reporting as a failure; it is the normal state
    // of a laptop in a bag.
    const offline = /net::|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED/i.test(message);
    this._set({
      status: offline ? 'idle' : 'error',
      reason: offline ? null : message.split('\n')[0].slice(0, 160),
      percent: 0,
    });
  }

  start() {
    if (!this.capability.can) return;
    this.stop();
    setTimeout(() => this.check(false), FIRST_CHECK_AFTER);
    this.timer = setInterval(() => this.check(false), CHECK_EVERY);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  // `manual` is a check the user asked for: it runs even with automatic updates
  // switched off, and it reports "you are up to date" rather than staying quiet.
  async check(manual = false) {
    if (!this.capability.can) {
      this._set({ status: 'unsupported', reason: this.capability.reason });
      return this.state;
    }
    if (!manual && !this.store.get('autoUpdate')) return this.state;
    if (this.checking) return this.state;
    if (this.state.status === 'ready') return this.state;

    const impl = this._load();
    if (!impl) return this.state;

    this.checking = true;
    this._set({ status: 'checking' });
    try {
      await impl.checkForUpdates();
    } catch (err) {
      this._fail(err);
    } finally {
      this.checking = false;
    }
    return this.state;
  }

  install() {
    if (this.state.status !== 'ready' || !this.impl) return false;
    const { app } = require('electron');
    app.isQuitting = true;
    // Give the caller a tick to close menus before the app goes away.
    setTimeout(() => {
      try { this.impl.quitAndInstall(); } catch { /* nothing to install */ }
    }, 120);
    return true;
  }

}

module.exports = { Updater, updateCapability };
