// Main process: owns the overlay window, feeds it the cursor and screen geometry,
// and provides the tray, context menu and global shortcuts.

const path = require('path');
const os = require('os');
const fs = require('fs');
const {
  app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage,
  globalShortcut, powerMonitor, shell, nativeTheme,
} = require('electron');

const { Store } = require('./store.cjs');
const { loadCatalog, setMenuLanguage, buildContextMenu, buildTrayMenu } = require('./menus.cjs');
const { Awareness } = require('./awareness.cjs');
const { Timers } = require('./timers.cjs');
const { Updater } = require('./updater.cjs');

const isDev = process.argv.includes('--dev');

// Kept as com.qubot.desktop through the rename to EMoO BOT, deliberately. This
// one string is three separate identities at once: what Windows files the app's
// shortcuts and notifications under, the GUID electron-builder derives the NSIS
// upgrade path from, and the name of the value in the Run key. Change it and an
// installed copy gets a second app beside it instead of an updated one, and its
// old startup entry is orphaned rather than replaced.
const APP_ID = 'com.qubot.desktop';

// Dev aid: `--shot=out.png[,delayMs]` captures the overlay's own pixels (alpha
// preserved, desktop excluded) and exits. Used to eyeball the art without a
// human at the screen.
const shotArg = process.argv.find((a) => a.startsWith('--shot='));

let store;
let overlay = null;
let settingsWin = null;
let tray = null;
let cursorTimer = null;
let idleTimer = null;

let lastCursor = { x: -1, y: -1 };
let userAway = false;
let lastEmotion = 'idle';
let hostDisplayId = null;
let hidden = false;
let awareness = null;
let timers = null;
let machineTimer = null;
let updater = null;
let announcedUpdate = null;   // version we have already told the user about
let lastCpuSample = null;
let settleTimers = [];   // the "are you actually on screen yet" passes after a cold boot
let session = null;      // what startSession() told us about this launch
let i18n = null;         // the shared string table, loaded with the catalog
let lang = 'en';         // 'auto' resolved against the system locale

// One place decides what language everything is in: the setting, resolved
// against the OS locale, pushed to the menus and to both renderers. Without a
// single resolver the tray could be in Arabic while the settings window is not.
function applyLanguage() {
  if (!i18n) return lang;
  lang = i18n.resolveLanguage(store.get('language'), app.getLocale());
  setMenuLanguage(lang);
  return lang;
}

// ---------------------------------------------------------------- geometry
// The overlay covers exactly ONE display at a time and follows the mascot between
// them. It is tempting to span every display with a single window, but a window
// has one devicePixelRatio: on a desktop mixing 100% and 150% scaling, a spanning
// window renders correctly on one monitor and at the wrong size and sharpness on
// the other. Confining it to a single display keeps every screen pixel-correct.

function displayList() {
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    x: d.workArea.x, y: d.workArea.y, w: d.workArea.width, h: d.workArea.height,
    scale: d.scaleFactor,
  }));
}

function displayById(id) {
  return screen.getAllDisplays().find((d) => d.id === id) || null;
}

function displayAt(point) {
  return screen.getDisplayNearestPoint({ x: Math.round(point.x), y: Math.round(point.y) });
}

function defaultPosition() {
  const d = screen.getPrimaryDisplay().workArea;
  const size = store.get('size');
  return { x: d.x + d.width - size * 1.1, y: d.y + d.height - size * 0.8 };
}

// Move the overlay onto `display`, telling the renderer its new origin so it can
// keep converting absolute desktop coordinates to window-local ones.
function useDisplay(display, { force = false } = {}) {
  if (!display || !overlay || overlay.isDestroyed()) return;
  if (!force && hostDisplayId === display.id) return;
  const from = hostDisplayId;
  hostDisplayId = display.id;
  overlay.setBounds(display.bounds);
  // Re-assert: moving between monitors can drop always-on-top on Windows.
  overlay.setAlwaysOnTop(!!store.get('alwaysOnTop'), 'screen-saver');
  const b = overlay.getBounds();
  send('layout', { x: display.bounds.x, y: display.bounds.y, width: b.width, height: b.height });
  if (isDev) {
    console.log(`[emoo] overlay ${from} -> ${display.id}`,
      `origin=(${display.bounds.x},${display.bounds.y})`,
      `size=${b.width}x${b.height}`, `scale=${display.scaleFactor}`);
  }
}

function publishDisplays() {
  send('displays', displayList());
}

// ---------------------------------------------------------------- overlay window
function createOverlay() {
  const start = store.get('position') || defaultPosition();
  const host = displayAt(start);
  hostDisplayId = host.id;

  overlay = new BrowserWindow({
    ...host.bounds,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    thickFrame: false,
    roundedCorners: false,
    // Non-focusable keeps clicking the mascot from stealing focus from whatever
    // the user is actually working in.
    focusable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.setAlwaysOnTop(store.get('alwaysOnTop'), 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.loadFile(path.join(__dirname, '../renderer/mascot.html'));

  overlay.once('ready-to-show', () => { if (!hidden) overlay.show(); });
  overlay.on('closed', () => { overlay = null; });

  if (isDev && !shotArg) overlay.webContents.openDevTools({ mode: 'detach' });
  if (shotArg) scheduleShot();

  overlay.webContents.on('console-message', (_e, level, message, line, source) => {
    if (level >= 2) console.error(`[renderer] ${message} (${source}:${line})`);
  });
  overlay.webContents.on('render-process-gone', (_e, d) => console.error('[renderer gone]', d));
  overlay.webContents.on('did-fail-load', (_e, code, desc) => console.error('[load failed]', code, desc));
}

// ---------------------------------------------------------------- coming up with Windows
// Windows starts login items while the shell is still assembling itself. In that
// first stretch the desktop, the taskbar and the final display metrics all
// arrive AFTER we do, and a transparent, always-on-top, non-focusable overlay
// created into that gap can end up behind everything, sized to a work area that
// no longer exists, or simply never composited at all.
//
// The symptom was exact: after signing in, the app was plainly running — tray
// icon, menus, timers, all alive — with nothing on screen, and the only fix
// anyone found was quitting and starting it again. So the overlay no longer
// trusts the first frame. It re-asserts itself a handful of times over the first
// half minute, which costs nothing on a warm start and is the whole difference
// on a cold one.
const SETTLE_AT = [700, 2000, 5000, 10000, 20000, 35000];
// A launch at sign-in races the whole shell coming up, so it keeps looking for
// longer than a launch you asked for by hand.
const LOGIN_SETTLE_AT = [...SETTLE_AT, 60000, 90000];

function ensureVisible() {
  if (!overlay || overlay.isDestroyed() || hidden) return;
  const host = displayById(hostDisplayId)
    || displayAt(store.get('position') || defaultPosition());
  // The work area we were handed at login is often the pre-taskbar one. Re-take
  // it, and re-send the layout so the renderer clamps against the real screen.
  useDisplay(host, { force: true });
  // showInactive, not show: the mascot appearing must never pull focus off
  // whatever the user is signing in to. Unconditional, because the failure this
  // exists for is a window that believes it is visible and is not on screen.
  overlay.showInactive();
  overlay.setAlwaysOnTop(!!store.get('alwaysOnTop'), 'screen-saver');
  // Explicitly re-raise: at login the shell hands out z-order after we have
  // already claimed ours, which is how the overlay ended up behind the desktop.
  if (store.get('alwaysOnTop')) overlay.moveTop();
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  publishDisplays();
  send('command', 'reclamp', {});
}

function scheduleSettle(at = SETTLE_AT) {
  clearSettle();
  settleTimers = at.map((ms) => setTimeout(ensureVisible, ms));
}

function clearSettle() {
  for (const t of settleTimers) clearTimeout(t);
  settleTimers = [];
}

// Windows remembers the login entry — path, arguments and all — from whenever it
// was last written, so re-registering it on every launch is the only way a change
// here reaches copies that were installed before it. That matters: the old entry
// started the app with `--hidden`, which is the other half of why nothing showed
// up after signing in.
function applyLoginItem() {
  // Registering a dev run would put Electron itself in the user's startup list.
  if (!app.isPackaged || process.platform === 'linux') return;
  try {
    // A portable build runs from a temporary extraction directory that is
    // different every launch, so process.execPath — what Electron would record
    // by default — would be a dead path by the next boot. electron-builder
    // hands us the real .exe the user double-clicked; register that instead.
    const portable = process.env.PORTABLE_EXECUTABLE_FILE;
    app.setLoginItemSettings({
      openAtLogin: !!store.get('launchOnLogin'),
      // Pinned rather than left to default to the AppUserModelId, so this always
      // lands on the same Run value the old build wrote — replacing the stale
      // `--hidden` entry instead of leaving it behind to race this one.
      name: APP_ID,
      ...(portable ? { path: portable } : {}),
      // Deliberately no `--hidden`. "Starts with Windows" has to mean it is
      // there when the desktop is, not that it is running where you cannot see it.
      args: ['--login'],
    });
  } catch (err) {
    console.error('[emoo] could not write the login item:', err.message);
  }
}

// Something that launches itself should say so, once. Told silently, this is the
// kind of thing people meet for the first time in Task Manager.
function announceStartup() {
  if (!store.get('launchOnLogin') || store.get('startupNoticeShown')) return;
  // Late enough to land after the launch greeting rather than on top of it. The
  // flag is set when it is actually said, not when it is scheduled, so a quit in
  // between does not swallow the one time this is ever mentioned.
  setTimeout(() => {
    if (!overlay || overlay.isDestroyed() || hidden) return;
    store.set({ startupNoticeShown: true });
    command('say', { emotion: 'happy', text: i18n.t(lang, 'startup.notice') });
  }, 12000);
}

// The app used to be called QU Bot, and Electron derives userData from the
// product name — so the rename on its own would have quietly handed everyone a
// fresh profile: default settings, and a mascot that had forgotten them. Carry
// the old file across the first time the new name runs.
function migrateUserData() {
  const target = path.join(app.getPath('userData'), 'settings.json');
  const legacy = path.join(app.getPath('appData'), 'QU Bot', 'settings.json');
  try {
    if (fs.existsSync(target) || !fs.existsSync(legacy)) return;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(legacy, target);
    console.log('[emoo] brought your settings over from QU Bot');
  } catch (err) {
    console.error('[emoo] could not bring the old settings over:', err.message);
  }
}

function scheduleShot() {
  const [, spec] = shotArg.split('=');
  const [file, delay = '2500'] = spec.split(',');
  const inline = process.argv.find((a) => a.startsWith('--shot-do='));
  const fromFile = process.argv.find((a) => a.startsWith('--shot-do-file='));
  const script = fromFile
    ? require('fs').readFileSync(fromFile.slice('--shot-do-file='.length), 'utf8')
    : inline && decodeURIComponent(inline.slice('--shot-do='.length));
  overlay.webContents.once('did-finish-load', () => {
    if (script) {
      setTimeout(() => overlay.webContents.executeJavaScript(script)
        .catch((e) => console.error('[shot-do]', e.message)), Number(delay) * 0.5);
    }
    setTimeout(async () => {
      try {
        const rectArg = process.argv.find((a) => a.startsWith('--shot-rect='));
        const rect = rectArg
          ? (([x, y, width, height]) => ({ x, y, width, height }))(
              rectArg.slice('--shot-rect='.length).split(',').map(Number))
          : undefined;
        const img = await overlay.webContents.capturePage(rect);
        require('fs').writeFileSync(file, img.toPNG());
        console.log('shot written:', file, img.getSize());
      } catch (err) {
        console.error('shot failed:', err.message);
      }
      app.isQuitting = true;
      app.quit();
    }, Number(delay));
  });
}

// A monitor was added, removed or rearranged. Re-publish the layout and make
// sure the mascot is not stranded on a display that no longer exists.
function onDisplaysChanged() {
  if (!overlay || overlay.isDestroyed()) return;
  publishDisplays();
  const host = displayById(hostDisplayId) || displayAt(store.get('position') || defaultPosition());
  useDisplay(host, { force: true });
  send('command', 'reclamp', {});
}

const send = (channel, ...args) => {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send(channel, ...args);
};

// ---------------------------------------------------------------- polling
function startCursorFeed() {
  clearInterval(cursorTimer);
  // 60Hz is enough for the gaze to feel live and for hover to beat the click.
  cursorTimer = setInterval(() => {
    if (!overlay || overlay.isDestroyed() || hidden) return;
    const p = screen.getCursorScreenPoint();
    if (p.x === lastCursor.x && p.y === lastCursor.y) return;
    lastCursor = p;
    send('cursor', p);
  }, 16);
}

function startIdleFeed() {
  clearInterval(idleTimer);
  // Once a second: fine enough for the renderer to tell "typing" (input is
  // happening but the cursor is parked) from "gone".
  idleTimer = setInterval(() => {
    if (!overlay || overlay.isDestroyed()) return;
    const seconds = powerMonitor.getSystemIdleTime();
    send('idle', seconds);
    const away = seconds > 60;
    if (away !== userAway) userAway = away;
  }, 1000);
}

function startAwareness() {
  if (!awareness) {
    awareness = new Awareness((info) => send('activity', info));
  }
  if (store.get('watchActivity')) awareness.start(); else awareness.stop();
}

// System-wide CPU load, from the deltas between two samples of os.cpus(). The
// absolute totals are since boot and therefore useless on their own; only the
// change between samples says anything about right now.
function sampleCpu() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const k of Object.keys(cpu.times)) total += cpu.times[k];
    idle += cpu.times.idle;
  }
  const prev = lastCpuSample;
  lastCpuSample = { idle, total };
  if (!prev) return 0;
  const dTotal = total - prev.total;
  const dIdle = idle - prev.idle;
  if (dTotal <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - dIdle / dTotal));
}

function startMachineFeed() {
  clearInterval(machineTimer);
  sampleCpu();
  machineTimer = setInterval(() => {
    if (!overlay || overlay.isDestroyed() || !store.get('machineAware')) return;
    send('machine', { cpu: sampleCpu() });
  }, 5000);
}

// ---------------------------------------------------------------- timers
function startTimers() {
  timers = new Timers(store, (fired) => {
    // A timer going off is exactly the moment the mascot should be visible.
    if (hidden) toggleVisible(true);
    send('command', 'timer', fired);
    refreshTray();
  });
  timers.start();
}

function addTimer(minutes, label) {
  if (!timers) return null;
  const entry = timers.add(minutes, label);
  if (entry) {
    command('timerSet', { minutes: entry.minutes, label: entry.label });
    refreshTray();
  }
  return entry;
}

function startOrStopPomodoro() {
  if (!timers) return;
  if (timers.pomodoro) {
    timers.stopPomodoro();
    command('say', { emotion: 'content', text: null });
  } else {
    const { minutes } = timers.startPomodoro();
    if (hidden) toggleVisible(true);
    command('timer', { kind: 'pomodoro-work', minutes, label: 'focus' });
  }
  refreshTray();
}

// ---------------------------------------------------------------- the shelf
function shelfAction(action, file) {
  const list = store.shelf || [];
  if (action === 'open' && file) { shell.openPath(file).catch(() => {}); return; }
  if (action === 'reveal' && file) { shell.showItemInFolder(file); return; }
  if (action === 'drop' && file) {
    store.setShelf(list.filter((f) => f !== file));
  } else if (action === 'clear') {
    store.setShelf([]);
  } else {
    return;
  }
  send('command', 'shelf', { files: store.shelf });
  refreshTray();
}

// ---------------------------------------------------------------- updates
function startUpdater() {
  updater = new Updater(store, (state) => {
    // Tell the mascot only about the moment that matters. Checking, downloading
    // and "already up to date" are menu detail, not things to interrupt with.
    if (state.status === 'ready' && state.version !== announcedUpdate) {
      announcedUpdate = state.version;
      if (hidden) toggleVisible(true);
      command('say', {
        emotion: 'excited',
        text: `version ${state.version} is ready. restart me when you like.`,
      });
    }
    refreshTray();
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send('update:state', state);
    }
  });
  updater.start();
}

// A check the user asked for reports back either way, including "up to date".
async function checkForUpdatesNow() {
  if (!updater) return;
  const state = await updater.check(true);
  if (state.status === 'unsupported') {
    command('say', { emotion: 'skeptical', text: state.reason });
  } else if (state.status === 'none') {
    command('say', { emotion: 'content', text: 'we are on the latest version.' });
  } else if (state.status === 'error') {
    command('say', { emotion: 'confused', text: 'could not reach the update server.' });
  }
  refreshTray();
}

// ---------------------------------------------------------------- tray
function trayImage() {
  const dark = nativeTheme.shouldUseDarkColors;
  // Windows tray sits on a dark taskbar by default; pick the contrasting art.
  const file = dark ? 'tray-light.png' : 'tray-dark.png';
  const img = nativeImage.createFromPath(path.join(__dirname, '../../assets', file));
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

function createTray() {
  tray = new Tray(trayImage());
  tray.setToolTip('EMoO BOT');
  refreshTray();
  tray.on('click', () => command('greet'));
  tray.on('double-click', () => openSettings());
  nativeTheme.on('updated', () => tray && tray.setImage(trayImage()));
}

function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu({
    settings: store.all, hidden, emotion: lastEmotion,
    timers: timers ? timers.snapshot() : { pomodoro: null, timers: [] },
    shelf: store.shelf,
    onCommand: command,
    onSetting: (patch) => updateSettings(patch),
    onToggleVisible: toggleVisible,
    onSettings: openSettings,
    onTimer: addTimer,
    onCancelTimer: (id) => { timers?.cancel(id); refreshTray(); },
    onPomodoro: startOrStopPomodoro,
    onShelf: shelfAction,
    update: updater ? updater.state : null,
    onInstallUpdate: () => updater?.install(),
    onCheckUpdate: checkForUpdatesNow,
    onQuit: () => { app.isQuitting = true; app.quit(); },
  }));
}

// ---------------------------------------------------------------- settings window
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  // Open on whichever screen the cursor is on, not always the primary.
  const near = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const winW = 460;
  const winH = Math.min(660, near.height - 40);

  settingsWin = new BrowserWindow({
    x: Math.round(near.x + (near.width - winW) / 2),
    y: Math.round(near.y + (near.height - winH) / 2),
    width: winW,
    height: winH,
    minWidth: 420,
    minHeight: 520,
    title: 'EMoO BOT',
    icon: path.join(__dirname, '../../assets/icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#141418' : '#f6f6f4',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWin.loadFile(path.join(__dirname, '../renderer/settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

// ---------------------------------------------------------------- actions
function updateSettings(patch) {
  const next = store.set(patch);

  // A position update is bookkeeping, not a settings change worth re-applying.
  const onlyPosition = Object.keys(patch).length > 0 && Object.keys(patch).every((k) => k === 'position');

  if (patch.alwaysOnTop !== undefined && overlay) {
    overlay.setAlwaysOnTop(!!next.alwaysOnTop, 'screen-saver');
  }
  if (patch.launchOnLogin !== undefined) {
    applyLoginItem();
  }
  if (patch.watchActivity !== undefined && awareness) {
    if (next.watchActivity) awareness.start(); else awareness.stop();
  }
  if (patch.language !== undefined) {
    applyLanguage();
    // Both windows redraw their own chrome; the mascot also switches which
    // dialogue pack it speaks from.
    send("language", lang);
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("language", lang);
  }
  if (patch.focusMode !== undefined) {
    if (hidden && next.focusMode) toggleVisible(true);
    send('command', 'focusToggle', { on: !!next.focusMode });
  }
  if (!onlyPosition) {
    send('settings', next);
    refreshTray();
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('settings', next);
  }
  return next;
}

// ---------------------------------------------------------------- its spot
// Picking a spot by first dragging the mascot there and then opening a menu is
// fiddly. These put it somewhere exact in one action instead: at the cursor, or
// in a named corner of whichever screen you are looking at.

const CORNERS = {
  'top-left': [0, 0],
  'top-right': [1, 0],
  'bottom-left': [0, 1],
  'bottom-right': [1, 1],
};

function setHomeAt(point) {
  const host = displayAt(point);
  const w = host.workArea;
  const r = store.get('size') / 2;
  // Keep the whole body on real screen space, so a spot picked at the very edge
  // is still somewhere it can actually sit.
  const home = {
    x: Math.round(Math.min(Math.max(point.x, w.x + r), w.x + w.width - r)),
    y: Math.round(Math.min(Math.max(point.y, w.y + r), w.y + w.height - r)),
  };
  updateSettings({ home, homeWhenBusy: true });
  if (hidden) toggleVisible(true);
  send('command', 'homePlaced', home);
  return home;
}

const setHomeAtCursor = () => setHomeAt(screen.getCursorScreenPoint());

function setHomeCorner(corner) {
  const host = displayAt(screen.getCursorScreenPoint());
  const w = host.workArea;
  const inset = store.get('size') * 0.62;
  const [fx, fy] = CORNERS[corner] || CORNERS['bottom-right'];
  return setHomeAt({
    x: fx ? w.x + w.width - inset : w.x + inset,
    y: fy ? w.y + w.height - inset : w.y + inset,
  });
}

function command(name, payload) {
  if (name === '__summon') return summon();
  // Anything that needs screen geometry is answered here rather than forwarded
  // to the renderer, which only knows about the display it is currently on.
  if (name === '__homeCursor') return setHomeAtCursor();
  if (name === '__homeCorner') return setHomeCorner(payload && payload.corner);
  if (hidden && name !== 'reset') toggleVisible(true);
  send('command', name, payload || {});
}

function toggleVisible(force) {
  hidden = force === undefined ? !hidden : !force;
  if (!overlay || overlay.isDestroyed()) return;
  if (hidden) overlay.hide(); else overlay.show();
  refreshTray();
}

function summon() {
  const p = screen.getCursorScreenPoint();
  const host = displayAt(p);
  if (hidden) toggleVisible(true);
  useDisplay(host);
  publishDisplays();

  const w = host.workArea;
  const size = store.get('size');
  send('place', {
    x: Math.min(Math.max(p.x + size * 0.9, w.x + size / 2), w.x + w.width - size / 2),
    y: Math.min(Math.max(p.y - size * 0.4, w.y + size / 2), w.y + w.height - size / 2),
  });
  send('command', 'emotion', { key: 'alert' });
}

// ---------------------------------------------------------------- IPC
ipcMain.handle('bot:ready', () => {
  const position = store.get('position') || defaultPosition();
  const host = displayById(hostDisplayId) || displayAt(position);
  hostDisplayId = host.id;
  const b = overlay.getBounds();
  return {
    settings: store.all,
    lang,
    window: { x: host.bounds.x, y: host.bounds.y, width: b.width, height: b.height },
    displays: displayList(),
    hostId: host.id,
    position,
    // Everything it remembers about the two of you, plus what this launch
    // looked like (first ever run, new day, how long you were gone).
    bond: { ...store.bondSummary(), ...(session || {}) },
    shelf: store.shelf,
  };
});

ipcMain.on('bond:save', (_e, status) => {
  store.updateBond(status);
});

ipcMain.on('shelf:set', (_e, paths) => {
  if (!Array.isArray(paths)) return;
  store.setShelf(paths.filter((p) => typeof p === 'string').slice(0, 6));
  refreshTray();
});

// The renderer decides which display the body is on — it knows the position every
// frame, so a fast throw hands the window over without a round trip of lag.
ipcMain.on('bot:display', (_e, id) => {
  const d = displayById(id);
  if (d) useDisplay(d);
});

ipcMain.on('bot:interactive', (_e, interactive) => {
  if (!overlay || overlay.isDestroyed()) return;
  overlay.setIgnoreMouseEvents(!interactive, { forward: true });
});

ipcMain.on('bot:menu', (_e, ctx) => {
  command('menuOpen');
  const menu = buildContextMenu({
    settings: store.all,
    emotion: (ctx && ctx.emotion) || lastEmotion,
    timers: timers ? timers.snapshot() : { pomodoro: null, timers: [] },
    shelf: (ctx && ctx.shelf) || store.shelf,
    onCommand: command,
    onSetting: updateSettings,
    onSettings: openSettings,
    onTimer: addTimer,
    onCancelTimer: (id) => { timers?.cancel(id); refreshTray(); },
    onPomodoro: startOrStopPomodoro,
    onShelf: shelfAction,
    update: updater ? updater.state : null,
    onInstallUpdate: () => updater?.install(),
    onCheckUpdate: checkForUpdatesNow,
    onHide: () => toggleVisible(false),
    onQuit: () => { app.isQuitting = true; app.quit(); },
  });
  // The overlay is deliberately non-focusable so clicking the mascot never steals
  // focus — but a popup menu on a non-focusable window cannot take keyboard input
  // or dismiss reliably. Lend it focusability for the lifetime of the menu.
  const restore = () => {
    if (overlay && !overlay.isDestroyed()) overlay.setFocusable(false);
  };
  if (overlay && !overlay.isDestroyed()) overlay.setFocusable(true);
  menu.popup({ window: overlay, callback: restore });
});

ipcMain.on('settings:update', (_e, patch) => {
  if (patch && typeof patch === 'object') updateSettings(patch);
});

ipcMain.on('bot:emotion', (_e, key) => {
  lastEmotion = key;
});

ipcMain.handle('settings:get', () => store.all);
ipcMain.handle('lang:get', () => lang);
ipcMain.on('settings:reset', () => {
  const next = store.reset();
  send('settings', next);
  refreshTray();
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('settings', next);
});
ipcMain.on('settings:command', (_e, name, payload) => command(name, payload));

ipcMain.handle('update:get', () => (updater
  ? { ...updater.state, current: app.getVersion() }
  : { status: 'unsupported', reason: 'not ready yet', current: app.getVersion() }));
ipcMain.handle('update:check', async () => {
  await checkForUpdatesNow();
  return updater ? { ...updater.state, current: app.getVersion() } : null;
});
ipcMain.handle('update:install', () => !!updater?.install());

ipcMain.handle('bond:get', () => store.bondSummary());
ipcMain.handle('bond:forget', () => {
  const summary = store.resetBond();
  send('command', 'reset', {});
  return summary;
});

ipcMain.handle('timers:get', () => (timers ? timers.snapshot() : { pomodoro: null, timers: [] }));
ipcMain.handle('timers:add', (_e, minutes, label) => {
  addTimer(minutes, label);
  return timers ? timers.snapshot() : { pomodoro: null, timers: [] };
});
ipcMain.handle('timers:cancel', (_e, id) => {
  timers?.cancel(id);
  refreshTray();
  return timers ? timers.snapshot() : { pomodoro: null, timers: [] };
});
ipcMain.handle('timers:pomodoro', () => {
  startOrStopPomodoro();
  return timers ? timers.snapshot() : { pomodoro: null, timers: [] };
});
ipcMain.on('settings:openExternal', (_e, url) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url);
});

// ---------------------------------------------------------------- lifecycle
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (hidden) toggleVisible(true);
    command('greet');
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId(APP_ID);
    migrateUserData();
    store = new Store();
    hidden = process.argv.includes('--hidden');
    // Roll the day counter and work out how long we have been apart, before the
    // renderer asks for it in bot:ready.
    session = store.startSession();

    // Menu labels come from the same ES modules the renderer uses.
    const catalog = await loadCatalog();
    i18n = await import("../shared/i18n.js");
    applyLanguage();
    // A settings file written by an older build can still name a shape that has
    // since been retired. Pull it back onto one that exists before anything
    // draws it or builds a menu out of it.
    if (!catalog.SHAPES.some((s) => s.key === store.get('shape'))) {
      store.set({ shape: catalog.SHAPES[0].key });
    }
    // Same for what it is wearing, against the real roster in mark.js.
    const worn = store.get('accessory');
    const known = ['auto', 'none', ...catalog.ACCESSORY_GROUPS.flatMap((g) => g.keys)];
    if (!known.includes(worn)) store.set({ accessory: 'auto' });

    createOverlay();
    // Re-written every launch, not only when the switch is flipped: that is what
    // carries the setting to a fresh install and what replaces the old, hidden
    // login entry on copies that already have one.
    applyLoginItem();
    scheduleSettle(process.argv.includes('--login') ? LOGIN_SETTLE_AT : SETTLE_AT);
    announceStartup();
    createTray();
    startCursorFeed();
    startIdleFeed();
    startAwareness();
    startMachineFeed();
    startTimers();
    startUpdater();

    screen.on('display-added', onDisplaysChanged);
    screen.on('display-removed', onDisplaysChanged);
    screen.on('display-metrics-changed', onDisplaysChanged);

    // Waking from sleep and unlocking land in the same half-assembled desktop a
    // cold boot does, so both get the same treatment as launch.
    powerMonitor.on('resume', () => {
      onDisplaysChanged();
      scheduleSettle();
      command('wake');
    });
    powerMonitor.on('unlock-screen', () => {
      scheduleSettle();
      command('greet');
    });

    globalShortcut.register('Control+Alt+B', summon);
    globalShortcut.register('Control+Alt+H', () => toggleVisible());
    // Park on the home spot and go quiet.
    globalShortcut.register('Control+Alt+F', () => updateSettings({ focusMode: !store.get('focusMode') }));
    // "How long have I been at this?"
    globalShortcut.register('Control+Alt+L', () => command('report'));
    // Point at where you want it and press this. The most direct way there is
    // to put it somewhere exact.
    globalShortcut.register('Control+Alt+P', setHomeAtCursor);

    app.on('activate', () => { if (!overlay) createOverlay(); });
  });

  // The mascot lives in the tray, so closing the settings window must not quit
  // the app. Registering a listener at all suppresses Electron's default quit.
  app.on('window-all-closed', () => {});

  app.on('before-quit', () => {
    app.isQuitting = true;
    awareness?.stop();
    timers?.stop();
    clearInterval(cursorTimer);
    clearInterval(idleTimer);
    clearInterval(machineTimer);
    clearSettle();
    updater?.stop();
    globalShortcut.unregisterAll();
    store?.flush();
  });
}
