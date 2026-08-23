// Tray and right-click menus. The catalogs (emotions, shapes, coats) live in ES
// modules shared with the renderer, so they are imported once at startup and
// cached — there is exactly one source of truth for every label.

const { Menu } = require('electron');

let catalog = null;

async function loadCatalog() {
  if (catalog) return catalog;
  const [emotions, themes, data] = await Promise.all([
    import('../renderer/lib/emotions.js'),
    import('../shared/themes.js'),
    import('../shared/mascot-data.js'),
  ]);
  const shapes = data.default.shapes;
  catalog = {
    EMOTIONS: emotions.EMOTIONS,
    EMOTION_GROUPS: emotions.EMOTION_GROUPS,
    COATS: themes.COATS,
    SHAPES: Object.entries(shapes).map(([key, s]) => ({ key, label: s.label })),
  };
  return catalog;
}

const SIZES = [
  { label: 'Small', value: 96 },
  { label: 'Medium', value: 128 },
  { label: 'Large', value: 168 },
  { label: 'Huge', value: 220 },
];

function emotionMenu(settings, current, onCommand) {
  return catalog.EMOTION_GROUPS.map((group) => ({
    label: group.name,
    submenu: group.keys.map((key) => {
      const e = catalog.EMOTIONS[key];
      return {
        label: `${e.emoji}  ${e.label}`,
        type: 'radio',
        checked: current === key,
        click: () => onCommand('emotion', { key }),
      };
    }),
  }));
}

function shapeMenu(settings, onSetting) {
  return catalog.SHAPES.map((s) => ({
    label: s.label,
    type: 'radio',
    checked: settings.shape === s.key,
    click: () => onSetting({ shape: s.key }),
  }));
}

function coatMenu(settings, onSetting, onSettings) {
  const items = catalog.COATS.map((c) => ({
    label: c.label,
    type: 'radio',
    checked: settings.coat === c.key,
    click: () => onSetting({ coat: c.key }),
  }));
  items.push({ type: 'separator' });
  items.push({
    label: `Custom… (${settings.customCoat})`,
    type: 'radio',
    checked: settings.coat === 'custom',
    click: () => { onSetting({ coat: 'custom' }); onSettings(); },
  });
  return items;
}

function sizeMenu(settings, onSetting) {
  return SIZES.map((s) => ({
    label: `${s.label} (${s.value}px)`,
    type: 'radio',
    checked: settings.size === s.value,
    click: () => onSetting({ size: s.value }),
  }));
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
    label: `${m} minutes`,
    click: () => onTimer(m, `${m} minute timer`),
  }));

  items.push({ type: 'separator' });
  items.push({
    label: timers.pomodoro ? `Stop pomodoro (${timers.pomodoro})` : 'Start pomodoro',
    click: () => onPomodoro(),
  });

  const running = timers.timers || [];
  if (running.length) {
    items.push({ type: 'separator' });
    items.push({ label: 'Running', enabled: false });
    for (const t of running) {
      items.push({
        label: `${t.label} — ${mmss(t.remaining)}`,
        click: () => onCancelTimer(t.id),
        toolTip: 'Click to cancel',
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
      { label: 'Open', click: () => onShelf('open', file) },
      { label: 'Show in folder', click: () => onShelf('reveal', file) },
      { type: 'separator' },
      { label: 'Let go of it', click: () => onShelf('drop', file) },
    ],
  }));
  items.push({ type: 'separator' });
  items.push({ label: 'Let go of everything', click: () => onShelf('clear') });
  return items;
}

const TOGGLES = [
  { key: 'followCursor', label: 'Watch what you do' },
  { key: 'watchActivity', label: 'Notice the app in front' },
  { key: 'rideWindows', label: 'Sit on the window you are using' },
  { key: 'gravity', label: 'Gravity (land instead of fly)' },
  { key: 'roam', label: 'Wander around' },
  { key: 'chatter', label: 'Speech bubbles' },
  { key: 'sleepWhenIdle', label: 'Sleep when idle' },
  { key: 'nudges', label: 'Occasional nudges' },
  { key: 'gazeFollowsCursor', label: 'Eyes follow cursor' },
  { key: 'homeWhenBusy', label: 'Wait on its spot while you work' },
  { key: 'focusReports', label: 'Mention long stretches' },
  { key: 'machineAware', label: 'React to battery and network' },
  { key: 'seasonal', label: 'Seasonal hats' },
  { key: 'soundEnabled', label: 'Sound' },
  { key: 'alwaysOnTop', label: 'Always on top' },
  { key: 'greetOnLaunch', label: 'Greet on launch' },
  { key: 'launchOnLogin', label: 'Start with Windows' },
];

function behaviourMenu(settings, onSetting) {
  return TOGGLES.map((t) => ({
    label: t.label,
    type: 'checkbox',
    checked: !!settings[t.key],
    click: (item) => onSetting({ [t.key]: item.checked }),
  }));
}

function actionItems(settings, emotion, onCommand) {
  const asleep = emotion === 'sleeping';
  return [
    { label: 'Say something', click: () => onCommand('say', { emotion: 'talking', text: null }) },
    { label: 'How long have I been at this?', accelerator: 'Ctrl+Alt+L', click: () => onCommand('report') },
    { label: 'Hop', click: () => onCommand('hop') },
    { label: 'Celebrate', accelerator: 'Ctrl+Alt+C', click: () => onCommand('celebrate') },
    asleep
      ? { label: 'Wake up', click: () => onCommand('wake') }
      : { label: 'Take a nap', click: () => onCommand('sleep') },
  ];
}

// The parking spot, and the switch that sends it there and shuts it up.
function placeItems(settings, onCommand, onSetting) {
  const items = [{
    label: settings.home ? 'Move its spot here' : 'Park it here',
    click: () => onCommand('setHome'),
  }];
  if (settings.home) {
    items.push({ label: 'Send it to its spot', click: () => onCommand('goHome') });
    items.push({ label: 'Forget the spot', click: () => onCommand('clearHome') });
  }
  items.push({ type: 'separator' });
  items.push({
    label: 'Focus mode',
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
  const { settings, emotion, timers, shelf, onCommand, onSetting, onSettings,
    onTimer, onCancelTimer, onPomodoro, onShelf } = o;
  const held = shelf || [];
  return [
    { label: 'Feeling', submenu: emotionMenu(settings, emotion, onCommand) },
    { label: 'Shape', submenu: shapeMenu(settings, onSetting) },
    { label: 'Colour', submenu: coatMenu(settings, onSetting, onSettings) },
    { label: 'Size', submenu: sizeMenu(settings, onSetting) },
    { type: 'separator' },
    ...actionItems(settings, emotion, onCommand),
    { type: 'separator' },
    { label: 'Its spot', submenu: placeItems(settings, onCommand, onSetting) },
    {
      label: (timers.timers || []).length
        ? `Timers (${timers.timers.length} running)`
        : 'Timers',
      submenu: timerMenu(timers, onTimer, onCancelTimer, onPomodoro),
    },
    ...(held.length
      ? [{ label: `Holding ${held.length} file${held.length > 1 ? 's' : ''}`, submenu: shelfMenu(held, onShelf) }]
      : []),
    { type: 'separator' },
    { label: 'Behaviour', submenu: behaviourMenu(settings, onSetting) },
    { label: 'Settings…', click: onSettings },
  ];
}

const title = (settings, emotion) => {
  const current = catalog.EMOTIONS[emotion];
  const name = settings.name || 'QU Bot';
  return `${name} — ${current ? current.label.toLowerCase() : emotion}`;
};

const updateItems = (updateReady, onInstallUpdate) => (updateReady
  ? [{ type: 'separator' }, { label: `Restart to update to ${updateReady}`, click: onInstallUpdate }]
  : []);

function buildContextMenu(o) {
  const { settings, emotion, updateReady, onInstallUpdate, onHide, onQuit } = o;
  return Menu.buildFromTemplate([
    { label: title(settings, emotion), enabled: false },
    { type: 'separator' },
    ...commonSections(o),
    ...updateItems(updateReady, onInstallUpdate),
    { type: 'separator' },
    { label: 'Hide', accelerator: 'Ctrl+Alt+H', click: onHide },
    { label: `Quit ${settings.name || 'QU Bot'}`, click: onQuit },
  ]);
}

function buildTrayMenu(o) {
  const { settings, hidden, emotion, updateReady, onInstallUpdate,
    onCommand, onToggleVisible, onQuit } = o;
  return Menu.buildFromTemplate([
    { label: title(settings, emotion), enabled: false },
    { type: 'separator' },
    { label: hidden ? 'Show' : 'Hide', accelerator: 'Ctrl+Alt+H', click: () => onToggleVisible() },
    { label: 'Summon to cursor', accelerator: 'Ctrl+Alt+B', enabled: !hidden, click: () => onCommand('__summon') },
    { type: 'separator' },
    ...commonSections(o),
    ...updateItems(updateReady, onInstallUpdate),
    { type: 'separator' },
    { label: `Quit ${settings.name || 'QU Bot'}`, click: onQuit },
  ]);
}

module.exports = { loadCatalog, buildContextMenu, buildTrayMenu, SIZES, TOGGLES, QUICK_TIMERS };
