const { contextBridge, ipcRenderer } = require('electron');
const sub = (channel) => (cb) => {
  const h = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};
contextBridge.exposeInMainWorld('vitals', {
  start: () => ipcRenderer.invoke('vitals:start'),
  stop: () => ipcRenderer.invoke('vitals:stop'),
  onSample: sub('vitals:sample'),
  onTrace: sub('vitals:trace'),
  onValidation: sub('vitals:validation'),
  onProcessing: sub('vitals:processing'),
  onError: sub('vitals:error'),
  onState: sub('vitals:state'),
});