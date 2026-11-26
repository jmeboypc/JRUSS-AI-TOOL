const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  fetchYoutubeTranscript: (url) => ipcRenderer.invoke('fetch-youtube-transcript', url),
});
