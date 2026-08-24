const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('emooSettings', {
  get: () => ipcRenderer.invoke('settings:get'),
  update: (patch) => ipcRenderer.send('settings:update', patch),
  reset: () => ipcRenderer.send('settings:reset'),
  command: (name, payload) => ipcRenderer.send('settings:command', name, payload),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, v) => cb(v)),

  // The resolved interface language: the setting can say 'auto', only main
  // knows what that turned into.
  lang: () => ipcRenderer.invoke('lang:get'),
  onLanguage: (cb) => ipcRenderer.on('language', (_e, v) => cb(v)),

  // What it remembers about the two of you.
  bond: () => ipcRenderer.invoke('bond:get'),
  forgetBond: () => ipcRenderer.invoke('bond:forget'),

  // Updates. Deliberately NOT called `update`: that name already belongs to the
  // settings patch above, and in an object literal the later duplicate key wins
  // silently — which took every control in the settings window down with it.
  updateState: () => ipcRenderer.invoke('update:get'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: (cb) => ipcRenderer.on('update:state', (_e, v) => cb(v)),

  // Timers, alarms and the pomodoro cycle.
  timers: () => ipcRenderer.invoke('timers:get'),
  addTimer: (minutes, label) => ipcRenderer.invoke('timers:add', minutes, label),
  cancelTimer: (id) => ipcRenderer.invoke('timers:cancel', id),
  pomodoro: () => ipcRenderer.invoke('timers:pomodoro'),
});
