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

const TOGGLES = [
  { key: 'followCursor', label: 'Watch what you do' },
  { key: 'watchActivity', label: 'Notice the app in front' },
  { key: 'gravity', label: 'Gravity (land instead of fly)' },
  { key: 'roam', label: 'Wander around' },
  { key: 'chatter', label: 'Speech bubbles' },
  { key: 'sleepWhenIdle', label: 'Sleep when idle' },
  { key: 'nudges', label: 'Occasional nudges' },
  { key: 'gazeFollowsCursor', label: 'Eyes follow cursor' },
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
    { label: 'Hop', click: () => onCommand('hop') },
    { label: 'Celebrate', accelerator: 'Ctrl+Alt+C', click: () => onCommand('celebrate') },
    asleep
      ? { label: 'Wake up', click: () => onCommand('wake') }
      : { label: 'Take a nap', click: () => onCommand('sleep') },
  ];
}

function buildContextMenu({ settings, emotion, onCommand, onSetting, onSettings, onHide, onQuit }) {
  const current = catalog.EMOTIONS[emotion];
  return Menu.buildFromTemplate([
    { label: `QU Bot — ${current ? current.label.toLowerCase() : emotion}`, enabled: false },
    { type: 'separator' },
    { label: 'Feeling', submenu: emotionMenu(settings, emotion, onCommand) },
    { label: 'Shape', submenu: shapeMenu(settings, onSetting) },
    { label: 'Colour', submenu: coatMenu(settings, onSetting, onSettings) },
    { label: 'Size', submenu: sizeMenu(settings, onSetting) },
    { type: 'separator' },
    ...actionItems(settings, emotion, onCommand),
    { type: 'separator' },
    { label: 'Behaviour', submenu: behaviourMenu(settings, onSetting) },
    { label: 'Settings…', click: onSettings },
    { type: 'separator' },
    { label: 'Hide', accelerator: 'Ctrl+Alt+H', click: onHide },
    { label: 'Quit QU Bot', click: onQuit },
  ]);
}

function buildTrayMenu({ settings, hidden, emotion, onCommand, onSetting, onToggleVisible, onSettings, onQuit }) {
  const current = catalog.EMOTIONS[emotion];
  return Menu.buildFromTemplate([
    { label: `QU Bot — ${current ? current.label.toLowerCase() : emotion}`, enabled: false },
    { type: 'separator' },
    { label: hidden ? 'Show' : 'Hide', accelerator: 'Ctrl+Alt+H', click: () => onToggleVisible() },
    { label: 'Summon to cursor', accelerator: 'Ctrl+Alt+B', enabled: !hidden, click: () => onCommand('__summon') },
    { type: 'separator' },
    { label: 'Feeling', submenu: emotionMenu(settings, emotion, onCommand) },
    { label: 'Shape', submenu: shapeMenu(settings, onSetting) },
    { label: 'Colour', submenu: coatMenu(settings, onSetting, onSettings) },
    { label: 'Size', submenu: sizeMenu(settings, onSetting) },
    { type: 'separator' },
    ...actionItems(settings, emotion, onCommand),
    { type: 'separator' },
    { label: 'Behaviour', submenu: behaviourMenu(settings, onSetting) },
    { label: 'Settings…', click: onSettings },
    { type: 'separator' },
    { label: 'Quit QU Bot', click: onQuit },
  ]);
}

module.exports = { loadCatalog, buildContextMenu, buildTrayMenu, SIZES, TOGGLES };
