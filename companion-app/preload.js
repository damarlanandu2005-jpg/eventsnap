const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  setAuth:         (d) => ipcRenderer.invoke('set-auth', d),
  selectFolder:    () => ipcRenderer.invoke('select-folder'),
  selectFiles:     () => ipcRenderer.invoke('select-files'),
  startWatching:   (d) => ipcRenderer.invoke('start-watching', d),
  stopWatching:    () => ipcRenderer.invoke('stop-watching'),
  uploadFiles:     (d) => ipcRenderer.invoke('upload-files', d),
  getQueueStatus:  () => ipcRenderer.invoke('get-queue-status'),
  startFtpServer:  (d) => ipcRenderer.invoke('start-ftp-server', d),
  stopFtpServer:   () => ipcRenderer.invoke('stop-ftp-server'),
  getFtpStatus:    () => ipcRenderer.invoke('get-ftp-status'),

  on: (channel, cb) => {
    const allowed = [
      'file-detected','upload-start','upload-success',
      'upload-retry','upload-failed','watch-error',
      'ftp-started','ftp-stopped'
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => cb(data));
    }
  },
  off: (channel) => ipcRenderer.removeAllListeners(channel),
});
