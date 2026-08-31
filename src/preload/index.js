const { contextBridge, ipcRenderer } = require('electron')

function subscribe(channel, cb) {
  const handler = (_, data) => cb(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('mapping', {
  validate:   (preset, mappingPath) => ipcRenderer.invoke('mapping:validate', preset, mappingPath),
  pickFile:   ()                     => ipcRenderer.invoke('mapping:pickFile'),
})

contextBridge.exposeInMainWorld('midi', {
  getPorts:      ()         => ipcRenderer.invoke('midi:getPorts'),
  connect:       (i, o)     => ipcRenderer.invoke('midi:connect', i, o),
  disconnect:    ()         => ipcRenderer.invoke('midi:disconnect'),
  waitForPreset: (n)        => ipcRenderer.invoke('midi:waitForPreset', n),
  requestPreset: (n)        => ipcRenderer.invoke('midi:requestPreset', n),
  writePreset:   (raw)      => ipcRenderer.invoke('midi:writePreset', raw),
  learnStart:    ()         => ipcRenderer.invoke('midi:learnStart'),
  learnStop:     ()         => ipcRenderer.invoke('midi:learnStop'),
  portTestStart: ()         => ipcRenderer.invoke('midi:portTestStart'),
  portTestStop:  ()         => ipcRenderer.invoke('midi:portTestStop'),
  exportJSON:    (data)     => ipcRenderer.invoke('preset:exportJSON', data),
  importJSON:    ()         => ipcRenderer.invoke('preset:importJSON'),
  onPreset:      (cb)       => subscribe('preset:received', cb),
  onPresetCache: (cb)       => subscribe('preset:cache', cb),
  onNoteIn:      (cb)       => subscribe('midi:notein', cb),
  onMonitor:     (cb)       => subscribe('midi:monitor', cb),
  onPortTestEvent: (cb)     => subscribe('midi:portTestEvent', cb),
  onStatus:      (cb)       => subscribe('midi:status', cb),
})
