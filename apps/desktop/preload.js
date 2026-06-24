const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    getAppFolder: () => ipcRenderer.invoke("get-app-folder"),
    saveFile: (buffer, fileName) => ipcRenderer.invoke("save-file", buffer, fileName),
    openFile: (filePath) => ipcRenderer.invoke("open-file", filePath),
});
