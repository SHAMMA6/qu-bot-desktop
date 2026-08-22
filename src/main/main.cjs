// Main process: owns the overlay window, feeds it the cursor and screen geometry,
// and provides the tray, context menu and global shortcuts.

const path = require('path');
const {
  app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage,
  globalShortcut, powerMonitor, shell, nativeTheme,
} = require('electron');

const { Store } = require('./store.cjs');
const { loadCatalog, buildContextMenu, buildTrayMenu } = require('./menus.cjs');
const { Awareness } = require('./awareness.cjs');

const isDev = process.argv.includes('--dev');

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
    console.log(`[qubot] overlay ${from} -> ${display.id}`,
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
  tray.setToolTip('QU Bot');
  refreshTray();
  tray.on('click', () => command('greet'));
  tray.on('double-click', () => openSettings());
  nativeTheme.on('updated', () => tray && tray.setImage(trayImage()));
}

function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu({
    settings: store.all, hidden, emotion: lastEmotion,
    onCommand: command,
    onSetting: (patch) => updateSettings(patch),
    onToggleVisible: toggleVisible,
    onSettings: openSettings,
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
    title: 'QU Bot',
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
    app.setLoginItemSettings({ openAtLogin: !!next.launchOnLogin, args: ['--hidden'] });
  }
  if (patch.watchActivity !== undefined && awareness) {
    if (next.watchActivity) awareness.start(); else awareness.stop();
  }
  if (!onlyPosition) {
    send('settings', next);
    refreshTray();
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('settings', next);
  }
  return next;
}

function command(name, payload) {
  if (name === '__summon') return summon();
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
    window: { x: host.bounds.x, y: host.bounds.y, width: b.width, height: b.height },
    displays: displayList(),
    hostId: host.id,
    position,
  };
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
  const menu = buildContextMenu({
    settings: store.all,
    emotion: (ctx && ctx.emotion) || lastEmotion,
    onCommand: command,
    onSetting: updateSettings,
    onSettings: openSettings,
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
ipcMain.on('settings:reset', () => {
  const next = store.reset();
  send('settings', next);
  refreshTray();
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('settings', next);
});
ipcMain.on('settings:command', (_e, name, payload) => command(name, payload));
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
    app.setAppUserModelId('com.qubot.desktop');
    store = new Store();
    hidden = process.argv.includes('--hidden');

    // Menu labels come from the same ES modules the renderer uses.
    await loadCatalog();

    createOverlay();
    createTray();
    startCursorFeed();
    startIdleFeed();
    startAwareness();

    screen.on('display-added', onDisplaysChanged);
    screen.on('display-removed', onDisplaysChanged);
    screen.on('display-metrics-changed', onDisplaysChanged);

    powerMonitor.on('resume', () => {
      onDisplaysChanged();
      command('wake');
    });
    powerMonitor.on('unlock-screen', () => command('greet'));

    globalShortcut.register('Control+Alt+B', summon);
    globalShortcut.register('Control+Alt+H', () => toggleVisible());
    globalShortcut.register('Control+Alt+C', () => command('celebrate'));

    app.on('activate', () => { if (!overlay) createOverlay(); });
  });

  // The mascot lives in the tray, so closing the settings window must not quit
  // the app. Registering a listener at all suppresses Electron's default quit.
  app.on('window-all-closed', () => {});

  app.on('before-quit', () => {
    app.isQuitting = true;
    awareness?.stop();
    clearInterval(cursorTimer);
    clearInterval(idleTimer);
    globalShortcut.unregisterAll();
    store?.flush();
  });
}
