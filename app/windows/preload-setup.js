const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tflix', {
  saveToken: (token) => ipcRenderer.send('tflix:save-token', token),
  cancel: () => ipcRenderer.send('tflix:cancel'),
});
