const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qubotSettings', {
  get: () => ipcRenderer.invoke('settings:get'),
  update: (patch) => ipcRenderer.send('settings:update', patch),
  reset: () => ipcRenderer.send('settings:reset'),
  command: (name, payload) => ipcRenderer.send('settings:command', name, payload),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, v) => cb(v)),

  // What it remembers about the two of you.
  bond: () => ipcRenderer.invoke('bond:get'),
  forgetBond: () => ipcRenderer.invoke('bond:forget'),

  // Timers, alarms and the pomodoro cycle.
  timers: () => ipcRenderer.invoke('timers:get'),
  addTimer: (minutes, label) => ipcRenderer.invoke('timers:add', minutes, label),
  cancelTimer: (id) => ipcRenderer.invoke('timers:cancel', id),
  pomodoro: () => ipcRenderer.invoke('timers:pomodoro'),
});
