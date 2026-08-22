const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qubotSettings', {
  get: () => ipcRenderer.invoke('settings:get'),
  update: (patch) => ipcRenderer.send('settings:update', patch),
  reset: () => ipcRenderer.send('settings:reset'),
  command: (name, payload) => ipcRenderer.send('settings:command', name, payload),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, v) => cb(v)),
});
