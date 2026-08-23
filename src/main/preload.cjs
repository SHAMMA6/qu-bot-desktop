// Narrow bridge between the mascot window and the main process. The renderer gets
// exactly these calls and nothing else — no node, no remote module.

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = (channel, cb) => {
  ipcRenderer.on(channel, (_e, ...args) => cb(...args));
};

contextBridge.exposeInMainWorld('qubot', {
  // Handshake: returns settings, window metrics, screen bounds and start position.
  ready: () => ipcRenderer.invoke('bot:ready'),

  // Renderer -> main
  move: (x, y) => ipcRenderer.send('bot:move', x, y),
  setInteractive: (v) => ipcRenderer.send('bot:interactive', !!v),
  openMenu: (ctx) => ipcRenderer.send('bot:menu', ctx),
  updateSettings: (patch) => ipcRenderer.send('settings:update', patch),
  emotionChanged: (key) => ipcRenderer.send('bot:emotion', key),
  // Called only when the body crosses onto a different monitor.
  setDisplay: (id) => ipcRenderer.send('bot:display', id),
  // The four slow meters and the lifetime counters, written back periodically.
  saveBond: (status) => ipcRenderer.send('bond:save', status),
  setShelf: (paths) => ipcRenderer.send('shelf:set', paths),

  // Dropped files. Electron removed `File.path` in v32, so the only way to get a
  // real path out of a DataTransfer is webUtils — which is not reachable from an
  // isolated renderer, hence this shim.
  pathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch { return ''; }
  },

  // Main -> renderer
  onSettings: (cb) => on('settings', cb),
  onLayout: (cb) => on('layout', cb),
  onCursor: (cb) => on('cursor', cb),
  onDisplays: (cb) => on('displays', cb),
  onIdle: (cb) => on('idle', cb),
  onActivity: (cb) => on('activity', cb),
  onCommand: (cb) => on('command', cb),
  onPlace: (cb) => on('place', cb),
  onMachine: (cb) => on('machine', cb),
});
