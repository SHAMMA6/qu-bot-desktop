// Tray and right-click menus. The catalogs (emotion labels, shapes, coats) live
// in ES modules shared with the renderer, so they are imported once at startup
// and cached — there is exactly one source of truth for every label.
//
// Every user-visible string goes through `tr()`. Both menus are rebuilt from
// scratch on every settings change already, so switching language costs nothing
// beyond the rebuild that was going to happen anyway.

const { Menu } = require('electron');

let catalog = null;
let lang = 'en';
let strings = null;

const tr = (key, vars) => (strings ? strings.t(lang, key, vars) : key);

async function loadCatalog() {
  if (catalog) return catalog;
  const [emotions, themes, data, i18n, mark] = await Promise.all([
    import('../renderer/lib/emotions.js'),
    import('../shared/themes.js'),
    import('../shared/mascot-data.js'),
    import('../shared/i18n.js'),
    import('../renderer/lib/mark.js'),
  ]);
  strings = i18n;
  catalog = {
    EMOTIONS: emotions.EMOTIONS,
    COATS: themes.COATS,
    SHAPES: Object.keys(data.default.shapes).map((key) => ({ key })),
    ACCESSORY_GROUPS: mark.ACCESSORY_GROUPS,
  };
  return catalog;
}

// Called by main whenever the resolved language changes.
function setMenuLanguage(next) {
  lang = next || 'en';
}

const SIZES = [
  { key: 'size.small', value: 96 },
  { key: 'size.medium', value: 128 },
  { key: 'size.large', value: 168 },
  { key: 'size.huge', value: 220 },
];

function shapeMenu(settings, onSetting) {
  return catalog.SHAPES.map((s) => ({
    label: tr(`shape.${s.key}`),
    type: 'radio',
    checked: settings.shape === s.key,
    click: () => onSetting({ shape: s.key }),
  }));
}

function coatMenu(settings, onSetting, onSettings) {
  const items = catalog.COATS.map((c) => ({
    label: tr(`coat.${c.key}`),
    type: 'radio',
    checked: settings.coat === c.key,
    click: () => onSetting({ coat: c.key }),
  }));
  items.push({ type: 'separator' });
  items.push({
    label: tr('menu.custom', { hex: settings.customCoat }),
    type: 'radio',
    checked: settings.coat === 'custom',
    click: () => { onSetting({ coat: 'custom' }); onSettings(); },
  });
  // A gradient cannot be picked from a menu — it is three colours and an angle —
  // so this switches it on and opens the window where it can be edited.
  items.push({
    label: tr('menu.gradient'),
    type: 'radio',
    checked: settings.coat === 'gradient',
    click: () => { onSetting({ coat: 'gradient' }); onSettings(); },
  });
  return items;
}

function sizeMenu(settings, onSetting) {
  return SIZES.map((s) => ({
    label: `${tr(s.key)} (${s.value}px)`,
    type: 'radio',
    checked: settings.size === s.value,
    click: () => onSetting({ size: s.value }),
  }));
}

// There are 35 wearables now, so this is grouped the way the settings window is
// rather than being one very long list.
function accessoryMenu(settings, onSetting) {
  const worn = settings.accessory || 'auto';
  const item = (key, label) => ({
    label, type: 'radio', checked: worn === key, click: () => onSetting({ accessory: key }),
  });
  const items = [item('auto', tr('wear.auto')), item('none', tr('wear.none')), { type: 'separator' }];
  for (const g of catalog.ACCESSORY_GROUPS || []) {
    items.push({
      label: tr(`wear.${g.key}`),
      submenu: g.keys.map((k) => item(k, tr(`acc.${k}`))),
    });
  }
  return items;
}

const QUICK_TIMERS = [5, 10, 15, 25, 45, 60];

const mmss = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Timers, alarms and the pomodoro cycle. Anything already running is listed with
// its remaining time so the menu doubles as the readout.
function timerMenu(timers, onTimer, onCancelTimer, onPomodoro) {
  const items = QUICK_TIMERS.map((m) => ({
    label: tr('menu.nMinutes', { n: m }),
    click: () => onTimer(m, tr('menu.nMinutes', { n: m })),
  }));

  items.push({ type: 'separator' });
  items.push({
    label: timers.pomodoro ? tr('menu.stopPomodoro', { state: timers.pomodoro }) : tr('menu.startPomodoro'),
    click: () => onPomodoro(),
  });

  const running = timers.timers || [];
  if (running.length) {
    items.push({ type: 'separator' });
    items.push({ label: tr('menu.running'), enabled: false });
    for (const t of running) {
      items.push({
        label: `${t.label} — ${mmss(t.remaining)}`,
        click: () => onCancelTimer(t.id),
        toolTip: tr('menu.cancelTip'),
      });
    }
  }
  return items;
}

// Files parked on the mascot.
function shelfMenu(shelf, onShelf) {
  const items = shelf.map((file) => ({
    label: file.split(/[\\/]/).pop().slice(0, 48),
    submenu: [
      { label: tr('menu.open'), click: () => onShelf('open', file) },
      { label: tr('menu.reveal'), click: () => onShelf('reveal', file) },
      { type: 'separator' },
      { label: tr('menu.letGo'), click: () => onShelf('drop', file) },
    ],
  }));
  items.push({ type: 'separator' });
  items.push({ label: tr('menu.letGoAll'), click: () => onShelf('clear') });
  return items;
}

const TOGGLES = [
  { key: 'followCursor' },
  { key: 'watchActivity' },
  { key: 'rideWindows' },
  { key: 'gravity' },
  { key: 'roam' },
  { key: 'chatter' },
  { key: 'gestures' },
  { key: 'sleepWhenIdle' },
  { key: 'nudges' },
  { key: 'gazeFollowsCursor' },
  { key: 'homeWhenBusy' },
  { key: 'focusReports' },
  { key: 'machineAware' },
  { key: 'soundEnabled' },
  { key: 'alwaysOnTop' },
  { key: 'greetOnLaunch' },
  { key: 'launchOnLogin' },
];

function behaviourMenu(settings, onSetting) {
  return TOGGLES.map((t) => ({
    label: tr(`toggle.${t.key}`),
    type: 'checkbox',
    checked: !!settings[t.key],
    click: (item) => onSetting({ [t.key]: item.checked }),
  }));
}

// The parking spot, and the switch that sends it there and shuts it up.
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function placeItems(settings, onCommand, onSetting) {
  const items = [
    // Point and press: the most direct way to put it somewhere exact.
    { label: tr('menu.parkCursor'), accelerator: 'Ctrl+Alt+P', click: () => onCommand('__homeCursor') },
    {
      label: tr('menu.parkCorner'),
      submenu: CORNERS.map((key) => ({
        label: tr(`corner.${key}`), click: () => onCommand('__homeCorner', { corner: key }),
      })),
    },
    { label: settings.home ? tr('menu.moveSpot') : tr('menu.parkHere'),
      click: () => onCommand('setHome') },
  ];
  if (settings.home) {
    items.push({ label: tr('menu.sendSpot'), click: () => onCommand('goHome') });
    items.push({ label: tr('menu.forgetSpot'), click: () => onCommand('clearHome') });
  }
  items.push({ type: 'separator' });
  items.push({
    label: tr('menu.focusMode'),
    type: 'checkbox',
    accelerator: 'Ctrl+Alt+F',
    checked: !!settings.focusMode,
    click: (item) => onSetting({ focusMode: item.checked }),
  });
  return items;
}

// Sections both menus share, so the tray and the right-click menu can never
// drift apart.
function commonSections(o) {
  const { settings, timers, shelf, onCommand, onSetting, onSettings,
    onTimer, onCancelTimer, onPomodoro, onShelf } = o;
  const held = shelf || [];
  return [
    // The one thing in either menu that asks it to *do* something rather than
    // to be something. Everything else it performs, it performs on its own.
    { label: tr('menu.trick'), enabled: !!settings.gestures, click: () => onCommand('trick') },
    { type: 'separator' },
    { label: tr('menu.shape'), submenu: shapeMenu(settings, onSetting) },
    { label: tr('menu.colour'), submenu: coatMenu(settings, onSetting, onSettings) },
    { label: tr('menu.size'), submenu: sizeMenu(settings, onSetting) },
    { label: tr('menu.wearing'), submenu: accessoryMenu(settings, onSetting) },
    { type: 'separator' },
    { label: tr('menu.spot'), submenu: placeItems(settings, onCommand, onSetting) },
    {
      label: (timers.timers || []).length
        ? tr('menu.timersRunning', { n: timers.timers.length })
        : tr('menu.timers'),
      submenu: timerMenu(timers, onTimer, onCancelTimer, onPomodoro),
    },
    ...(held.length
      ? [{ label: tr(held.length > 1 ? 'menu.holdingPlural' : 'menu.holding', { n: held.length }),
        submenu: shelfMenu(held, onShelf) }]
      : []),
    { type: 'separator' },
    { label: tr('menu.behaviour'), submenu: behaviourMenu(settings, onSetting) },
    { label: tr('menu.settings'), click: onSettings },
  ];
}

const title = (settings, emotion) => {
  const name = settings.name || 'EMoO BOT';
  const feeling = catalog.EMOTIONS[emotion] ? tr(`emotion.${emotion}`) : emotion;
  return `${name} — ${feeling}`;
};

// The update section reflects whatever the updater is actually doing, including
// telling you plainly when this build cannot update itself at all.
// The updater reports state; the words for it live here, because only whoever
// is drawing the menu knows which language to draw it in.
function updateLabel(u) {
  switch (u.status) {
    case 'unsupported': return tr('update.unsupported', { reason: u.reason });
    case 'checking': return tr('update.checking');
    case 'available': return tr('update.available', { version: u.version });
    case 'downloading': return tr('update.downloading', { percent: u.percent });
    case 'ready': return tr('update.ready', { version: u.version });
    case 'none': return tr('update.none');
    case 'error': return tr('update.error', { reason: u.reason });
    default: return tr('update.check');
  }
}

function updateItems(update, onInstallUpdate, onCheckUpdate) {
  if (!update) return [];
  const items = [{ type: 'separator' }];
  switch (update.status) {
    case 'ready':
      items.push({ label: updateLabel(update), click: onInstallUpdate });
      break;
    case 'checking':
    case 'downloading':
    case 'unsupported':
      items.push({ label: updateLabel(update), enabled: false });
      break;
    case 'available':
      items.push({ label: updateLabel(update), enabled: false });
      items.push({ label: tr('update.downloadNow'), click: onCheckUpdate });
      break;
    case 'none':
    case 'error':
      items.push({ label: updateLabel(update), enabled: false });
      items.push({ label: tr('update.checkAgain'), click: onCheckUpdate });
      break;
    default:
      items.push({ label: tr('update.check'), click: onCheckUpdate });
  }
  return items;
}

function buildContextMenu(o) {
  const { settings, emotion, update, onInstallUpdate, onCheckUpdate, onHide, onQuit } = o;
  return Menu.buildFromTemplate([
    { label: title(settings, emotion), enabled: false },
    { type: 'separator' },
    ...commonSections(o),
    ...updateItems(update, onInstallUpdate, onCheckUpdate),
    { type: 'separator' },
    { label: tr('menu.hide'), accelerator: 'Ctrl+Alt+H', click: onHide },
    { label: tr('menu.quit', { name: settings.name || 'EMoO BOT' }), click: onQuit },
  ]);
}

function buildTrayMenu(o) {
  const { settings, hidden, emotion, update, onInstallUpdate, onCheckUpdate,
    onCommand, onToggleVisible, onQuit } = o;
  return Menu.buildFromTemplate([
    { label: title(settings, emotion), enabled: false },
    { type: 'separator' },
    { label: hidden ? tr('menu.show') : tr('menu.hide'), accelerator: 'Ctrl+Alt+H', click: () => onToggleVisible() },
    { label: tr('menu.summon'), accelerator: 'Ctrl+Alt+B', enabled: !hidden, click: () => onCommand('__summon') },
    { type: 'separator' },
    ...commonSections(o),
    ...updateItems(update, onInstallUpdate, onCheckUpdate),
    { type: 'separator' },
    { label: tr('menu.quit', { name: settings.name || 'EMoO BOT' }), click: onQuit },
  ]);
}

module.exports = {
  loadCatalog, setMenuLanguage, buildContextMenu, buildTrayMenu, SIZES, TOGGLES, QUICK_TIMERS,
};
