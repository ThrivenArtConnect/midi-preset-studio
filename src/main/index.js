const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const midi = require('midi')
const P = require('./sysex-protocol.js')
const M = require('./mapping-bridge.js')
const PortTest = require('./port-test.js')
const WriteGate = require('./preset-write-gate.js')

let input = null
let output = null
let sysexInput = null
let connectedOutIdx = -1
let mainInputIdx = -1
let sysexInputIdx = -1
const portTest = PortTest.createPortTestController({ midiInputFactory: () => new midi.Input() })
let dumpWatchdog = null
let dumpReceivedSinceRequest = false
let awaitingDump = false
const sysexBuffers = { main: [], sysexInput: [] }
let mainWindow = null
let midiLearnActive = false
let midiConnected = false

const DUMP_WAIT_MS = 30000
const PRESET_DUMP_LEN = 505

function ensureMidiIO() {
  if (!input) {
    input = new midi.Input()
    input.on('message', (_dt, msg) => handleIncomingMessage(_dt, msg, 'main input'))
  }
  if (!output) output = new midi.Output()
}

function presetsDir() {
  return path.join(app.getPath('userData'), 'presets')
}

function ensurePresetsDir() {
  fs.mkdirSync(presetsDir(), { recursive: true })
}

function presetSyxPath(num) {
  return path.join(presetsDir(), `preset_${String(num).padStart(2, '0')}.syx`)
}

function savePresetSyx(bytes) {
  ensurePresetsDir()
  const num = bytes[7]
  if (num == null) return
  fs.writeFileSync(presetSyxPath(num), Buffer.from(bytes))
  console.log(`💾 Gespeichert: ${presetSyxPath(num)} (${bytes.length} bytes)`)
}

function loadAllPresetsFromDisk() {
  ensurePresetsDir()
  const files = fs.readdirSync(presetsDir()).filter(f => f.endsWith('.syx'))
  const items = []

  for (const file of files) {
    try {
      const raw = [...fs.readFileSync(path.join(presetsDir(), file))]
      if (raw.length < 50) continue
      const preset = P.parsePreset(raw)
      if (preset) items.push({ preset, raw })
    } catch (err) {
      console.warn(`⚠️ Konnte ${file} nicht laden:`, err.message)
    }
  }

  items.sort((a, b) => a.preset.number - b.preset.number)
  return items
}

function sendToRenderer(channel, data) {
  const win = mainWindow || BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) return
  win.webContents.send(channel, data)
}

function emitMidiStatus(state) {
  midiConnected = state === 'connected'
  sendToRenderer('midi:status', { connected: midiConnected, state })
}

function deliverPreset(preset, raw) {
  savePresetSyx(raw)
  sendToRenderer('preset:received', { preset, raw })
}

function sendPresetCache() {
  const presets = loadAllPresetsFromDisk()
  console.log(`📂 Cache: ${presets.length} Preset(s) aus ${presetsDir()}`)
  sendToRenderer('preset:cache', { presets })
}

function hexMsg(msg) {
  return Array.from(msg).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
}

function isMpd24Sysex(msg) {
  return msg[0] === 0xF0 && msg[1] === 0x47 && msg[3] === 0x68
}

function validateRaw(raw) {
  if (!raw || raw.length !== 505) return false
  if (raw[0] !== 0xF0) return false
  if (raw[1] !== 0x47) return false
  if (raw[raw.length - 1] !== 0xF7) return false
  return true
}

function bufferKey(source) {
  return source === 'sysexInput' ? 'sysexInput' : 'main'
}

function resetSysexBuffers() {
  sysexBuffers.main = []
  sysexBuffers.sysexInput = []
}

function feedSysex(bytes, source) {
  const key = bufferKey(source)
  let buf = sysexBuffers[key]

  if (bytes[0] === 0xF0) {
    buf = [...bytes]
  } else if (buf.length) {
    buf = buf.concat(bytes)
  } else {
    return null
  }

  sysexBuffers[key] = buf

  if (buf.length && buf[buf.length - 1] === 0xF7) {
    sysexBuffers[key] = []
    return buf
  }

  return null
}

function closeSysexInputPort() {
  if (sysexInput) {
    try { sysexInput.closePort() } catch {}
  }
  sysexInputIdx = -1
}

function attachSysexInput(ports, mainInIdx) {
  closeSysexInputPort()
  const sysexIdx = ports.inputs.findIndex(n => n.includes('Anschluss 3'))
  if (sysexIdx === -1 || sysexIdx === mainInIdx) return null

  if (!sysexInput) {
    sysexInput = new midi.Input()
    sysexInput.on('message', (_dt, msg) => handleIncomingMessage(_dt, msg, 'sysexInput'))
  }

  const portName = ports.inputs[sysexIdx]
  try {
    sysexInput.openPort(sysexIdx)
    sysexInput.ignoreTypes(false, false, false)
    sysexInputIdx = sysexIdx
    console.log(`SysEx-Input: "${portName}" (idx ${sysexIdx})`)
  } catch (err) {
    console.error('⚠️ sysexInput.openPort failed:', err.message)
    return null
  }
  return portName
}

function finishDumpWait() {
  awaitingDump = false
  if (dumpWatchdog) {
    clearTimeout(dumpWatchdog)
    dumpWatchdog = null
  }
}

function startDumpWait() {
  if (dumpWatchdog) clearTimeout(dumpWatchdog)
  dumpWatchdog = setTimeout(() => {
    if (!dumpReceivedSinceRequest) {
      console.warn('⏱ Kein 505-Byte-Dump – am MPD24: GLOBAL → SysEx Tx → VALUE → ENTER')
    }
    finishDumpWait()
  }, DUMP_WAIT_MS)
}

function handleIncomingSysex(bytes, source = 'main input') {
  if (!isMpd24Sysex(bytes)) return

  if (bytes.length !== PRESET_DUMP_LEN) {
    if (bytes.length < 50 && awaitingDump) {
      console.log(`ACK ignored in waitForPreset: ${hexMsg(bytes)} [${source}]`)
    }
    return
  }

  console.log(`✅ MPD24 Preset dump – ${bytes.length} bytes, preset# ${bytes[7]} [${source}]`)
  dumpReceivedSinceRequest = true
  finishDumpWait()
  const preset = P.parsePreset(bytes)
  if (!preset) return
  deliverPreset(preset, bytes)
}

function parseMidiMonitorEvent(bytes) {
  if (!bytes.length) return null
  const status = bytes[0] & 0xF0
  const ch = (bytes[0] & 0x0F) + 1
  const ts = Date.now()

  if (status === 0x90 && bytes.length >= 3 && bytes[2] > 0) {
    return { type: 'note', note: bytes[1], velocity: bytes[2], channel: ch, ts }
  }
  if (status === 0x80 || (status === 0x90 && bytes.length >= 3 && bytes[2] === 0)) {
    return { type: 'noteOff', note: bytes[1], velocity: 0, channel: ch, ts }
  }
  if (status === 0xB0 && bytes.length >= 3) {
    return { type: 'cc', cc: bytes[1], value: bytes[2], channel: ch, ts }
  }
  if (status === 0xD0 && bytes.length >= 2) {
    return { type: 'aftertouch', value: bytes[1], channel: ch, ts }
  }
  if (status === 0xA0 && bytes.length >= 3) {
    return { type: 'polyAftertouch', note: bytes[1], value: bytes[2], channel: ch, ts }
  }
  if (status === 0xC0 && bytes.length >= 2) {
    return { type: 'programChange', program: bytes[1], channel: ch, ts }
  }
  return null
}

function handleNoteOnForLearn(bytes) {
  // Port-Test hat Vorrang: ein Pad-Hit waehrend eines aktiven Port-Tests darf nie
  // als MIDI-Learn-Eingabe verarbeitet werden, siehe Aufgabe 3.
  if (portTest.isActive()) return false
  if (!midiLearnActive || bytes.length < 3) return false
  const status = bytes[0]
  const type = status & 0xF0
  if (type !== 0x90 || bytes[2] === 0) return false

  const note = bytes[1]
  const channel = (status & 0x0F) + 1
  midiLearnActive = false
  sendToRenderer('midi:notein', { note, channel })
  console.log(`🎹 MIDI-Learn: note ${note} ch ${channel}`)
  return true
}

function handleIncomingMessage(_deltaTime, msg, source = 'main input') {
  const bytes = Array.from(msg)

  const complete = feedSysex(bytes, source)
  if (complete) {
    if (complete.length !== PRESET_DUMP_LEN) {
      if (awaitingDump && isMpd24Sysex(complete) && complete.length < 50) {
        console.log(`ACK ignored in waitForPreset: ${hexMsg(complete)} [${source}]`)
      }
      return
    }
    handleIncomingSysex(complete, source)
    return
  }

  if (bytes[0] === 0xF0 || sysexBuffers[bufferKey(source)].length) return

  if (handleNoteOnForLearn(bytes)) return

  // Weiterleitung an einen aktiven Port-Test fuer Nachrichten, die auf einem
  // bereits offenen Port (Hauptinput/sysexInput) eintreffen - registriert keinen
  // zusaetzlichen Listener, nutzt nur diesen vorhandenen Empfangsweg mit.
  if (portTest.isActive()) {
    const idx = source === 'sysexInput' ? sysexInputIdx : mainInputIdx
    const name = idx !== -1 ? getPorts().inputs[idx] : source
    portTest.forwardMessage(idx, name, bytes)
  }

  const evt = parseMidiMonitorEvent(bytes)
  if (evt) sendToRenderer('midi:monitor', evt)
}

function resolvePortIndex(ref, list) {
  const m = String(ref).match(/^(\d+):/)
  if (m) {
    const idx = +m[1]
    if (idx >= 0 && idx < list.length) return idx
  }
  return list.findIndex(n => n === ref)
}

function getPorts() {
  ensureMidiIO()
  const inputs = []
  const outputs = []
  for (let i = 0; i < input.getPortCount(); i++) inputs.push(input.getPortName(i))
  for (let i = 0; i < output.getPortCount(); i++) outputs.push(output.getPortName(i))
  return { inputs, outputs }
}

function disconnectMidi() {
  portTest.stop()
  try { input?.closePort() } catch {}
  closeSysexInputPort()
  try { output?.closePort() } catch {}
  connectedOutIdx = -1
  mainInputIdx = -1
  finishDumpWait()
  resetSysexBuffers()
  midiLearnActive = false
  emitMidiStatus('disconnected')
}

function connect(inputRef, outputRef) {
  emitMidiStatus('connecting')
  ensureMidiIO()
  resetSysexBuffers()

  const ports = getPorts()
  const inIdx = resolvePortIndex(inputRef, ports.inputs)
  const outIdx = resolvePortIndex(outputRef, ports.outputs)
  const inputName = ports.inputs[inIdx]
  const outputName = ports.outputs[outIdx]

  if (inIdx === -1) {
    emitMidiStatus('disconnected')
    return { error: `Input nicht gefunden: ${inputRef}` }
  }
  if (outIdx === -1) {
    emitMidiStatus('disconnected')
    return { error: `Output nicht gefunden: ${outputRef}` }
  }

  try { input.closePort() } catch {}
  try { output.closePort() } catch {}
  closeSysexInputPort()

  try {
    input.openPort(inIdx)
    output.openPort(outIdx)
    input.ignoreTypes(false, false, false)
    connectedOutIdx = outIdx
    mainInputIdx = inIdx
  } catch (err) {
    emitMidiStatus('disconnected')
    return { error: err.message }
  }

  attachSysexInput(getPorts(), inIdx)
  console.log(`Verbunden: IN="${inputName}" (idx ${inIdx}) OUT="${outputName}" (idx ${outIdx})`)
  emitMidiStatus('connected')
  return { ok: true }
}

/** Wait for passive SysEx dump from hardware (GLOBAL → SysEx Tx → ENTER). No outbound SysEx. */
function waitForPresetDump(num) {
  if (!midiConnected) throw new Error('MIDI not connected')
  if (awaitingDump) return { ok: false, error: 'Empfang läuft bereits' }
  dumpReceivedSinceRequest = false
  awaitingDump = true
  resetSysexBuffers()
  startDumpWait()
  console.log(`⏳ Warte auf SysEx-Dump Preset ${num} (MPD24: GLOBAL → SysEx Tx → VALUE → ENTER)`)
  return { ok: true, num }
}

function requestPreset(num) {
  if (!midiConnected) throw new Error('MIDI Output not connected')
  if (awaitingDump) return { ok: false, error: 'Empfang läuft bereits' }
  const bytes = P.buildDumpRequest(num)
  dumpReceivedSinceRequest = false
  awaitingDump = true
  resetSysexBuffers()
  startDumpWait()
  console.log('→ Dump request:', hexMsg(bytes))
  output.sendMessage(bytes)
  return { ok: true, hint: 'ACK erwartet – vollen Dump mit SysEx Tx + ENTER am Gerät senden' }
}

function sendRawPreset(rawArray) {
  if (!midiConnected || !output) throw new Error('MIDI Output not connected')
  const raw = Array.from(rawArray)
  const gate = WriteGate.evaluatePresetWrite(raw)
  if (!gate.allowed) throw new Error(gate.message)
  if (!validateRaw(raw)) throw new Error('Invalid preset data')
  output.sendMessage(raw)
  savePresetSyx(raw)
  console.log(`→ Preset ${raw[7]} gesendet (${raw.length} bytes)`)
  return { ok: true, raw }
}

function writePresetParsed(preset, raw) {
  const bytes = P.serializePreset(preset, raw)
  return sendRawPreset(bytes)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 860,
    title: 'Akai MPD24 Editor',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const isDev = !!process.env.ELECTRON_RENDERER_URL
  const csp = isDev
    ? "default-src 'self' http://localhost:5173 ws://localhost:5173; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173"
    : "default-src 'self'; script-src 'self'"

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

  mainWindow.webContents.once('did-finish-load', () => {
    sendPresetCache()
    emitMidiStatus('disconnected')
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('midi:getPorts', () => getPorts())
ipcMain.handle('midi:connect', (_, i, o) => connect(i, o))
ipcMain.handle('midi:disconnect', () => { disconnectMidi(); return { ok: true } })
ipcMain.handle('midi:waitForPreset', (_, n) => {
  try {
    return waitForPresetDump(n)
  } catch (err) {
    return { ok: false, error: err.message }
  }
})
ipcMain.handle('midi:requestPreset', (_, n) => {
  try {
    return requestPreset(n)
  } catch (err) {
    return { ok: false, error: err.message }
  }
})
ipcMain.handle('midi:writePreset', (_, rawArray) => {
  try {
    return sendRawPreset(rawArray)
  } catch (err) {
    console.warn('writePreset failed:', err.message)
    return { ok: false, error: err.message }
  }
})
ipcMain.handle('midi:learnStart', () => {
  if (portTest.isActive()) {
    return { ok: false, error: 'MIDI-Learn ist während des Port-Tests gesperrt.' }
  }
  midiLearnActive = true
  return { ok: true }
})
ipcMain.handle('midi:learnStop', () => {
  midiLearnActive = false
  return { ok: true }
})

ipcMain.handle('midi:portTestStart', () => {
  const ports = getPorts()
  const alreadyOpen = []
  if (mainInputIdx !== -1) alreadyOpen.push({ index: mainInputIdx, name: ports.inputs[mainInputIdx] })
  if (sysexInputIdx !== -1 && sysexInputIdx !== mainInputIdx) {
    alreadyOpen.push({ index: sysexInputIdx, name: ports.inputs[sysexInputIdx] })
  }
  midiLearnActive = false // Port-Test hat Vorrang, siehe Aufgabe 3
  return portTest.start({
    portNames: ports.inputs,
    alreadyOpen,
    onEvent: (payload) => sendToRenderer('midi:portTestEvent', payload),
  })
})

ipcMain.handle('midi:portTestStop', () => {
  return portTest.stop()
})

ipcMain.handle('preset:exportJSON', (_, data) => {
  const items = data?.presets?.length
    ? data.presets
    : loadAllPresetsFromDisk().map(({ preset, raw }) => ({
        number: preset.number,
        preset,
        raw,
      }))
  const outPath = path.join(app.getPath('downloads'), 'presets_backup.json')
  const payload = {
    version: 1,
    exported: new Date().toISOString(),
    presets: items.map(({ number, preset, raw }) => ({
      number: number ?? preset?.number,
      preset,
      raw,
    })),
    meta: data?.meta || {},
  }
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`📤 Export: ${outPath} (${items.length} Presets)`)
  return { path: outPath, count: items.length }
})

ipcMain.handle('mapping:pickFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'mapping.json wählen',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths?.[0]) return { canceled: true }
  return { path: filePaths[0] }
})

ipcMain.handle('mapping:validate', (_, preset, mappingPath) => {
  try {
    if (!preset?.banks?.A) {
      return { errors: ['Kein gültiges Preset geladen'], warnings: [] }
    }
    if (!mappingPath) {
      return { errors: ['Kein mapping.json Pfad angegeben'], warnings: [] }
    }
    const mapping = M.loadMapping(mappingPath)
    const { errors, warnings } = M.validateAgainstMapping(preset, mapping)
    return { errors, warnings }
  } catch (err) {
    return { errors: [err.message], warnings: [] }
  }
})

// Safety 0.2: preset:importJSON sendet jeden importierten Eintrag ueber
// writePresetParsed() sofort ans Geraet. Solange kein Backup-vor-Senden-Gate
// existiert, wird der Import deshalb vor jedem Dialog-/Datei-/JSON-Zugriff
// abgebrochen - bewusst kein alternativer, nur-lokaler Import in diesem
// Ticket. Die urspruengliche Dialog-/Lese-/Sende-Logik ist in Safety 0.1
// (Analyse-Ticket) vollstaendig dokumentiert.
ipcMain.handle('preset:importJSON', async () => WriteGate.describeImportBlock())

app.whenReady().then(() => {
  ensurePresetsDir()
  console.log(`Preset-Speicher: ${presetsDir()}`)
  createWindow()
})

app.on('window-all-closed', () => {
  disconnectMidi()
  if (process.platform !== 'darwin') app.quit()
})
