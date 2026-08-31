// MPD24 Port-Test - eigenständiges Modul, siehe Aufgabe 3.
// Ziel: bei einem Pad-Hit den konkreten macOS-MIDI-Input-Port ermitteln, über den
// die Note tatsächlich eingeht (mehrere "Akai MPD24 [...]"-Ports moeglich).
// Kein SysEx, kein Senden, kein Geraete-/Preset-Write - reine Empfangs-Diagnose.

// Gleiche Erkennungskonvention wie in src/renderer/App.jsx (defaultInputRef):
// Substring-Match auf "MPD24", keine festen Indizes/Suffixe. Bewusst NICHT nur
// "Akai", damit andere Akai-Geraete (z.B. MPK) nicht versehentlich erkannt werden.
const NAME_MATCH = 'MPD24'

function isMpd24PortName(name) {
  return typeof name === 'string' && name.includes(NAME_MATCH)
}

/** @param {string[]} portNames @returns {{index:number, name:string}[]} */
function findMpd24PortIndices(portNames) {
  return (portNames || [])
    .map((name, index) => ({ index, name }))
    .filter(p => isMpd24PortName(p.name))
}

/**
 * Dedupe-Entscheidung: welche passenden Ports sind schon offen (Hauptinput/
 * sysexInput) und werden nur referenziert, welche muessen fuer den Test
 * temporaer zusaetzlich geoeffnet werden.
 * @param {string[]} portNames
 * @param {number[]} alreadyOpenIndices
 */
function planPortsToOpen(portNames, alreadyOpenIndices = []) {
  const openSet = new Set(alreadyOpenIndices)
  const matches = findMpd24PortIndices(portNames)
  return {
    matches,
    reuse: matches.filter(m => openSet.has(m.index)),
    toOpen: matches.filter(m => !openSet.has(m.index)),
  }
}

/** Nur reguläre 3-Byte Note-On mit Velocity > 0, Kanal 1-16. Alles andere (Note-Off,
 * Note-On Vel 0, CC, Program Change, Pitch Bend, SysEx) wird ignoriert. */
function isRelevantNoteOn(bytes) {
  if (!bytes || bytes.length < 3) return false
  const status = bytes[0] & 0xf0
  const channel = bytes[0] & 0x0f
  if (status !== 0x90) return false
  if (channel < 0 || channel > 15) return false
  return bytes[2] > 0
}

function parseNoteOnEvent(bytes) {
  return { note: bytes[1], velocity: bytes[2], channel: (bytes[0] & 0x0f) + 1 }
}

/**
 * Zustandsbehaftete Steuerung. Bekommt eine Factory fuer midi.Input-Instanzen
 * injiziert (Main-Prozess uebergibt `() => new midi.Input()`), damit dieses
 * Modul ohne echte MIDI-Hardware testbar bleibt.
 * @param {{ midiInputFactory: () => any }} deps
 */
function createPortTestController({ midiInputFactory }) {
  let active = false
  let temporaryInputs = [] // [{ index, name, input }]
  let onEvent = null

  function handleMessage(portIndex, portName, bytes) {
    if (!active) return
    if (!isRelevantNoteOn(bytes)) return
    const { note, velocity, channel } = parseNoteOnEvent(bytes)
    onEvent?.({ portIndex, portName, note, velocity, channel, timestamp: Date.now() })
  }

  /**
   * @param {{ portNames: string[], alreadyOpen: {index:number,name:string}[], onEvent: (payload:object)=>void }} args
   */
  function start({ portNames, alreadyOpen = [], onEvent: cb }) {
    if (active) {
      return { ok: true, alreadyRunning: true, matches: findMpd24PortIndices(portNames) }
    }

    const plan = planPortsToOpen(portNames, alreadyOpen.map(p => p.index))
    if (!plan.matches.length) {
      return { ok: false, error: 'Kein passender MPD24-Input-Port gefunden.', matches: [] }
    }

    onEvent = cb
    temporaryInputs = []

    for (const { index, name } of plan.toOpen) {
      const inputInstance = midiInputFactory()
      try {
        inputInstance.openPort(index)
        inputInstance.ignoreTypes(false, false, false)
      } catch (err) {
        continue // dieser Port liess sich nicht oeffnen - Test laeuft mit den uebrigen weiter
      }
      inputInstance.on('message', (_dt, msg) => handleMessage(index, name, Array.from(msg)))
      temporaryInputs.push({ index, name, input: inputInstance })
    }

    active = true
    return {
      ok: true,
      matches: plan.matches,
      reused: plan.reuse,
      opened: temporaryInputs.map(t => ({ index: t.index, name: t.name })),
    }
  }

  /** Weiterleitung von Nachrichten, die auf einem bereits offenen Port (Hauptinput
   * oder sysexInput) eintreffen - siehe index.js handleIncomingMessage. Registriert
   * keinen eigenen Listener, nutzt nur den vorhandenen Empfangsweg mit. */
  function forwardMessage(portIndex, portName, bytes) {
    handleMessage(portIndex, portName, bytes)
  }

  function stop() {
    for (const t of temporaryInputs) {
      try { t.input.removeAllListeners?.('message') } catch {}
      try { t.input.closePort() } catch {}
    }
    temporaryInputs = []
    active = false
    onEvent = null
    return { ok: true }
  }

  function isActive() {
    return active
  }

  return { start, stop, isActive, forwardMessage }
}

module.exports = {
  isMpd24PortName,
  findMpd24PortIndices,
  planPortsToOpen,
  isRelevantNoteOn,
  parseNoteOnEvent,
  createPortTestController,
}
