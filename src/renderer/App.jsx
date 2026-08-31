import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Tooltip, { TipField } from './components/Tooltip.jsx'
import GlobalInfoPanel from './components/GlobalInfoPanel.jsx'
import MonitorPanel from './components/MonitorPanel.jsx'
import TutorialPanel from './components/TutorialPanel.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import PresetToolsPanel from './components/PresetToolsPanel.jsx'
import WarningsPanel from './components/WarningsPanel.jsx'
import {
  loadTags, saveTags, pushSnapshot, popSnapshot, loadSnapshots, hasSnapshots,
} from './preset-storage.js'
import {
  patchNameInRaw,
  patchPadInRaw,
  patchKnobInRaw,
  patchFaderInRaw,
  serializeRawFromPreset,
  nameFromRaw,
  validateRaw,
} from './raw-patch.js'
import { buildPresetFromTemplate } from '../shared/preset-generator.js'
import { createBlankRawPreset } from '../shared/blank-raw-preset.js'
import { validatePreset } from '../shared/preset-validator.js'
import sickfyn1Template from '../shared/presets/sickfyn1.json'
import { PRESET_WRITE_LOCKED, PRESET_WRITE_LOCK_NOTICE } from './preset-write-lock.js'

const FACTORY_LOCKED_MAX = 12

const ACCENT = '#e63946'
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const BANKS = ['A', 'B', 'C', 'D']
const BANK_NOTE_OFFSET = { A: 52, B: 68, C: 84, D: 132 }
const PAD_LAYOUT = [
  [12, 13, 14, 15],
  [8, 9, 10, 11],
  [4, 5, 6, 7],
  [0, 1, 2, 3],
]
const PAD_CHANNEL_OPTS = [
  ...Array.from({ length: 16 }, (_, i) => ({ v: i + 1, l: String(i + 1) })),
  { v: 0, l: 'CC' },
]
const CTRL_CHANNEL_OPTS = [
  ...PAD_CHANNEL_OPTS,
  ...Array.from({ length: 16 }, (_, i) => ({ v: i + 17, l: `B${i + 1}` })),
]
const PRESSURE_OPTS = ['OFF', 'CPR', 'PPR']

const TIPS = {
  midiInput: 'MIDI-Eingang wählen (MPD24 Anschluss 3).\nEmpfängt Preset-Dumps und Noten für MIDI-Learn.',
  midiOutput: 'MIDI-Ausgang wählen (MPD24).\nSendet SysEx-Presets zum Gerät.',
  connect: 'MIDI-Verbindung zum MPD24 öffnen.\nInput und Output müssen gewählt sein.',
  presetSelect: 'Wähle ein Preset (1–30). Änderungen werden nicht automatisch gespeichert.',
  presetName: 'Preset-Name bearbeiten (max. 8 Zeichen). Wird im MPD24-Display angezeigt.',
  unsaved: 'Dieses Preset hat ungespeicherte Änderungen.',
  send: 'Sendet das aktuelle Preset als SysEx an den MPD24. Das Gerät überschreibt den gespeicherten Slot.',
  sendAll: 'Sendet alle 30 Presets nacheinander an den MPD24.\nDas Gerät speichert jeden Slot automatisch.\nDauer: ca. 3–5 Sekunden.',
  loadFromDevice: 'Wählt Preset am Gerät per SysEx-Request (ACK).\n505-Byte-Dump: GLOBAL → [>] SysEx Tx → VALUE-Dial → ENTER am MPD24.',
  connConnected: 'MIDI-Verbindung aktiv (Input + Output).',
  connConnecting: 'Verbindung wird hergestellt…',
  connDisconnected: 'Keine MIDI-Verbindung. Klicken zum Verbinden.',
  export: 'Exportiert alle 30 Presets als JSON-Backup in den Downloads-Ordner.',
  import: 'Lädt ein gesichertes JSON und stellt die Presets wieder her.',
  loadTemplate: `Erzeugt das Preset „${sickfyn1Template.name}“ aus der Vorlage ${'`'}src/shared/presets/sickfyn1.json${'`'}\nund lädt es als Entwurf für Slot ${sickfyn1Template.slot} (noch nicht gesendet, noch nicht gespeichert).`,
  factoryLocked: 'Werks-Preset (Slot 1–12): schreibgeschützt. Eigene Presets ab Slot 13 anlegen.',
  presetWriteLocked: PRESET_WRITE_LOCK_NOTICE,
  bankTab: 'Bank A: Pads 1–16 (erste Belegung)\nBank B: Pads 1–16 (zweite Belegung)\nBank C/D: weitere Belegungen.\nAm MPD24 mit den BANK-Tasten wechseln.',
  padSelected: 'Aktuell ausgewählt. Bearbeite Note, Kanal, Modus und Druck im Panel rechts.',
  padDirty: 'Änderung noch nicht zum Gerät gesendet.',
  noteInput: 'MIDI-Notennummer (0–127).\n0 = C-1, 36 = C2, 60 = C4 (Middle C), 127 = G9.\nBestimmt welchen Sound das Pad auslöst.',
  noteName: 'Notenname der aktuellen MIDI-Nummer (z.B. C2, F#3).',
  padChannel: "MIDI-Kanal des Pads (1–16).\n'CC' = Common Channel (global in Global Mode einstellbar).",
  mty: 'Momentary: Pad sendet Note On beim Drücken, Note Off beim Loslassen. Standard-Modus.',
  tgl: 'Toggle: Erstes Drücken = Note On, zweites Drücken = Note Off. Gut für Loops.',
  pressure: 'Aftertouch-Modus:\nOFF = Kein Aftertouch.\nCPR = Channel Pressure (ganzer Kanal).\nPPR = Poly Pressure (nur dieses Pad).',
  pressureOff: 'Kein Aftertouch wird gesendet.',
  pressureCpr: 'Channel Pressure: Aftertouch gilt für den ganzen Kanal.',
  pressurePpr: 'Poly Pressure: Aftertouch gilt nur für dieses Pad (polyphon).',
  midiLearn: 'Warte auf MIDI-Eingang: Drücke eine Taste/Pad am Gerät.\nDie Note wird automatisch übernommen.\nTimeout nach 5 Sekunden.',
  midiLearnBlockedByPortTest: 'MIDI-Learn ist während des Port-Tests gesperrt, damit ein Pad-Hit eindeutig dem MPD24-Port zugeordnet wird.',
  knobCc: 'Control Change Nummer (0–127).\nMuss mit dem Parameter in deiner DAW übereinstimmen.',
  knobMin: 'Minimalwert den der Knob sendet (Standard: 0).',
  knobMax: 'Maximalwert den der Knob sendet (Standard: 127).',
  knobChannel: 'MIDI-Kanal des Knobs.',
  faderCc: 'Control Change Nummer (0–127).\nMuss mit dem Parameter in deiner DAW übereinstimmen.',
  faderMin: 'Minimalwert den der Fader sendet (Standard: 0).',
  faderMax: 'Maximalwert den der Fader sendet (Standard: 127).',
  faderChannel: 'MIDI-Kanal des Faders.',
  padPanelEmpty: 'Wähle ein Pad in der 4×4-Matrix links, um Note, Kanal und Modus zu bearbeiten.',
  eventType: 'Event-Typ:\nNOTE = MIDI-Note senden.\nPROGRAM CHANGE = Patch/Kit am Ziel-Synth umschalten.',
  program: 'Program-Nummer (0–127).\nEntspricht dem Patch-Slot im Ziel-Synth oder Sampler.',
  bankM: 'Bank Select MSB (Most Significant Byte).\n„OFF“ = kein Bank Select, nur Program Change.\nGesetzt = CC0 vor Program Change.',
  bankL: 'Bank Select LSB (Least Significant Byte).\n„OFF“ = kein LSB.\nZusammen mit Bank M für erweiterte Bank-Auswahl.',
  pcHelp: 'Program Change schaltet Sounds/Kits um.\nBank M/L optional für Synths mit MSB/LSB-Banken.\nTeste mit externem Synth oder DAW.',
  tabEditor: 'Preset-Editor: Pads, Knobs, Fader bearbeiten.',
  tabGlobal: 'Global & Info: Erklärungen zu Common Channel, Sensitivity, Velocity-Kurven.',
  tabMonitor: 'Live-Monitor: Letzte MIDI-Events vom MPD24 anzeigen.',
  tabTools: 'Preset-Tools: A/B-Vergleich, Tags, Snapshot/Undo.',
  tabTutorials: 'Schritt-für-Schritt-Anleitungen für typische Workflows.',
  snapshot: 'Speichert den aktuellen Preset-Zustand vor dem Senden.\nMit Undo wiederherstellen.',
}

function rawBankVal(v) {
  if (v == null || v >= 127) return 'OFF'
  return v
}

function padTip(pad, idx, selectedPad, isDirty) {
  if (selectedPad === idx) return TIPS.padSelected
  if (isDirty) return TIPS.padDirty
  const label = pad.eventType === 'PROG'
    ? `PROG ${pad.program ?? pad.note}`
    : `${pad.noteName} (${pad.note})`
  return `Pad ${pad.pad} – ${label} – Ch ${pad.channelLabel}\nKlicken zum Bearbeiten.`
}

function padDisplayLabel(pad) {
  if (pad.eventType === 'PROG') return `P${pad.program ?? pad.note}`
  return pad.noteName
}

function parsePadFromRaw(raw, i, pad, modes, channels, bankKey) {
  const chRaw = raw?.[116 + i]
  const ch = chRaw === 0 && channels[i] === 1 ? 0 : (channels[i] ?? (chRaw ?? 0) + 1)
  const base = { pad: pad.pad ?? i + 1, channel: ch, channelLabel: channelLabel(ch) }

  if (bankKey === 'A') {
    const flag = raw?.[108 + i] ?? 0
    if (flag === 0x03) {
      const program = raw?.[52 + i] ?? pad.program ?? pad.note ?? 0
      return {
        ...base,
        eventType: 'PROG',
        mode: 'TGL',
        program,
        note: program,
        noteName: `Prog ${program}`,
        bankM: rawBankVal(raw?.[156 + i] ?? pad.bankM),
        bankL: rawBankVal(raw?.[172 + i] ?? pad.bankL),
        pressure: 'OFF',
      }
    }
    const note = pad.note ?? raw?.[52 + i] ?? 0
    return {
      ...base,
      eventType: 'NOTE',
      note,
      noteName: pad.noteName ?? noteToName(note),
      mode: flag === 0x02 ? 'TGL' : (modes[i] ?? 'MTY'),
      bankM: 'OFF',
      bankL: 'OFF',
      pressure: pad.pressure ?? 'OFF',
    }
  }

  const noteOff = BANK_NOTE_OFFSET[bankKey]
  const note = pad.note ?? raw?.[noteOff + i] ?? 0
  return {
    ...base,
    eventType: 'NOTE',
    note,
    noteName: pad.noteName ?? noteToName(note),
    mode: modes[i] ?? (raw?.[100 + i] === 0x02 ? 'TGL' : 'MTY'),
    bankM: 'OFF',
    bankL: 'OFF',
    pressure: pad.pressure ?? 'OFF',
  }
}

function knobTip(k) {
  return `Knob ${k.knob} – CC ${k.cc} – Ch ${k.channelLabel}\nKlicken zum Bearbeiten.`
}

function faderTip(f) {
  return `Fader ${f.fader} – CC ${f.cc} – Ch ${f.channelLabel}\nKlicken zum Bearbeiten.`
}

function pressureTip(value) {
  if (value === 'CPR') return TIPS.pressureCpr
  if (value === 'PPR') return TIPS.pressurePpr
  return TIPS.pressureOff
}

function noteToName(n) {
  if (n == null || n < 0 || n > 127) return '?'
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`
}

function channelLabel(ch) {
  if (ch === 0) return 'CC'
  const c = ch | 0
  if (c >= 1 && c <= 16) return String(c)
  if (c >= 17 && c <= 32) return `B${c - 16}`
  return `Ch${c}`
}

function clone(o) {
  return JSON.parse(JSON.stringify(o))
}

function portRef(list, idx) {
  return `${idx}:${list[idx] || ''}`
}

function defaultInputRef(p) {
  const idx = p.inputs.findIndex(n => n.includes('MPD24') && !n.includes('Anschluss 3'))
  if (idx >= 0) return portRef(p.inputs, idx)
  const a3 = p.inputs.findIndex(n => n.includes('Anschluss 3'))
  if (a3 >= 0) return portRef(p.inputs, a3)
  return p.inputs[0] ? portRef(p.inputs, 0) : ''
}

function defaultOutputRef(p) {
  const outs = p.outputs
    .map((n, i) => ({ n, i }))
    .filter(x => x.n.includes('MPD24') && !x.n.includes('DLS'))
  if (outs.length >= 1) return portRef(p.outputs, outs[0].i)
  return ''
}

function parseBankFromRaw(raw, noteOff) {
  return Array.from({ length: 16 }, (_, i) => {
    const note = raw[noteOff + i] ?? 0
    return { pad: i + 1, note, noteName: noteToName(note) }
  })
}

function normalizePreset(entry) {
  const { preset, raw } = entry
  const num = preset.number ?? entry.number
  const modes = preset.modes?.length === 16 ? [...preset.modes] : Array(16).fill('MTY')
  const channels = preset.channels?.length === 16 ? [...preset.channels] : Array(16).fill(1)

  function enrichBank(pads, bankKey) {
    const base = pads?.length === 16
      ? pads
      : (raw?.length >= 50 ? parseBankFromRaw(raw, BANK_NOTE_OFFSET[bankKey]) : [])
    return base.map((pad, i) => parsePadFromRaw(raw, i, pad, modes, channels, bankKey))
  }

  const bankA = enrichBank(preset.bankA, 'A')
  const bankB = enrichBank(preset.bankB, 'B')
  const bankC = enrichBank(preset.bankC, 'C')
  const bankD = enrichBank(preset.bankD, 'D')
  const banks = { A: bankA, B: bankB, C: bankC, D: bankD }

  const knobs = Array.from({ length: 8 }, (_, i) => {
    const k = preset.knobs?.[i] || {}
    const ch = k.ch ?? 1
    return { knob: i + 1, cc: k.cc ?? 0, ch, channelLabel: channelLabel(ch), min: k.min ?? 0, max: k.max ?? 127 }
  })

  const faders = Array.from({ length: 6 }, (_, i) => {
    const f = preset.faders?.[i] || {}
    const ch = f.ch ?? 1
    return { fader: i + 1, cc: f.cc ?? 0, ch, channelLabel: channelLabel(ch), min: f.min ?? 0, max: f.max ?? 127 }
  })

  return {
    number: num,
    name: preset.name || `Preset ${num}`,
    banks, bankA, bankB, bankC, bankD,
    modes, channels, knobs, faders,
  }
}

const S = {
  page: { background: '#09090b', color: '#fafafa', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  topBar: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', background: '#18181b', borderBottom: '1px solid #27272a' },
  badge: (ok) => ({ background: ok ? '#14532d' : '#27272a', color: ok ? '#86efac' : '#a1a1aa', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }),
  modeBadge: (mode) => ({
    display: 'inline-block',
    background: mode === 'TGL' ? '#1e3a5f' : '#27272a',
    color: mode === 'TGL' ? '#93c5fd' : '#a1a1aa',
    padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
  }),
  select: { background: '#27272a', color: '#fff', border: '1px solid #3f3f46', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' },
  btn: (primary = false, active = false) => ({
    background: active ? '#1d4ed8' : primary ? ACCENT : '#27272a',
    color: '#fff',
    border: primary && !active ? 'none' : '1px solid #3f3f46',
    borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  }),
  section: { padding: '16px' },
  h2: { color: ACCENT, fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' },
  tab: (active) => ({
    padding: '8px 16px', background: active ? ACCENT : '#27272a', color: '#fff',
    border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
  }),
  pad: (selected) => ({
    background: selected ? '#3f1014' : '#27272a',
    border: `2px solid ${selected ? ACCENT : '#3f3f46'}`,
    borderRadius: '8px', padding: '10px 6px', textAlign: 'center', cursor: 'pointer',
  }),
  panel: { background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', padding: '16px' },
  label: { display: 'block', color: '#71717a', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', background: '#09090b', color: '#fff', border: '1px solid #3f3f46', borderRadius: '4px', padding: '6px 8px', fontSize: '13px', fontFamily: 'ui-monospace, monospace' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', maxWidth: '420px' },
  chip: (active) => ({
    background: active ? '#3f1014' : '#27272a',
    border: `1px solid ${active ? ACCENT : '#3f3f46'}`,
    borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
  }),
  ctrlRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px', marginBottom: '12px' },
  toast: (ok) => ({
    position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
    background: ok ? '#14532d' : '#7f1d1d', color: ok ? '#86efac' : '#fca5a5',
    padding: '12px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  }),
  connBadge: (state) => ({
    padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, border: 'none',
    cursor: state === 'disconnected' ? 'pointer' : 'default',
    background: state === 'connected' ? '#14532d' : state === 'connecting' ? '#713f12' : '#27272a',
    color: state === 'connected' ? '#86efac' : state === 'connecting' ? '#fde047' : '#fca5a5',
  }),
  banner: {
    background: '#713f12', color: '#fde047', padding: '8px 16px', fontSize: '13px',
    fontWeight: 600, textAlign: 'center',
  },
  progressBar: {
    height: '4px', background: '#27272a', borderRadius: '2px', overflow: 'hidden', marginTop: '4px',
  },
  progressFill: (pct) => ({
    height: '100%', width: `${pct}%`, background: ACCENT, transition: 'width 0.15s',
  }),
  learnPulse: {
    animation: 'midiLearnPulse 1s ease-in-out infinite',
  },
}

function Field({ label, children, tip }) {
  if (tip) {
    return (
      <TipField label={label} tip={tip}>
        {children}
      </TipField>
    )
  }
  return (
    <div>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  )
}

export default function App() {
  const [ports, setPorts] = useState({ inputs: [], outputs: [] })
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [connState, setConnState] = useState('disconnected')
  const [showDisconnectBanner, setShowDisconnectBanner] = useState(false)
  const [status, setStatus] = useState('Presets werden geladen…')

  const [presets, setPresets] = useState({})
  const [rawMap, setRawMap] = useState({})
  const [dirtySet, setDirtySet] = useState(new Set())
  const [selectedId, setSelectedId] = useState(null)
  const [editPreset, setEditPreset] = useState(null)

  const [activeBank, setActiveBank] = useState('A')
  const [selectedPad, setSelectedPad] = useState(null)
  const [selectedKnob, setSelectedKnob] = useState(null)
  const [selectedFader, setSelectedFader] = useState(null)
  const [midiLearnActive, setMidiLearnActive] = useState(false)
  const [toast, setToast] = useState(null)
  const [bulkProgress, setBulkProgress] = useState(null)
  const [mainTab, setMainTab] = useState('editor')
  const [monitorEvents, setMonitorEvents] = useState([])
  const [portTestActive, setPortTestActive] = useState(false)
  const [portTestLastHit, setPortTestLastHit] = useState(null)
  const [portTestStartResult, setPortTestStartResult] = useState(null)
  const [presetTags, setPresetTags] = useState(() => loadTags())
  const [presetSearch, setPresetSearch] = useState('')
  const [snapshotCounts, setSnapshotCounts] = useState({})
  const [dismissedWarningIds, setDismissedWarningIds] = useState(new Set())

  const MONITOR_MAX = 50

  const selectedIdRef = useRef(selectedId)
  const showToastRef = useRef(() => {})
  const learnTimeoutRef = useRef(null)
  const pendingPresetRef = useRef(null)
  const loadPresetTimeoutRef = useRef(null)
  const toastTimerRef = useRef(null)
  const wasConnectedRef = useRef(false)
  const connected = connState === 'connected'
  const presetCount = Object.keys(presets).length
  const isDirty = selectedId != null && dirtySet.has(selectedId)
  const isFactoryLocked = selectedId != null && selectedId <= FACTORY_LOCKED_MAX

  // Validiert bei jeder Aenderung von editPreset neu (deckt normales Laden,
  // Vorlagen-Laden und laufende Bearbeitung ab) - rein lesend, siehe
  // preset-validator.js. Quittierungen gelten nur fuer den aktuell
  // ausgewaehlten Slot und werden beim Presetwechsel zurueckgesetzt.
  const warnings = useMemo(() => validatePreset(editPreset), [editPreset])
  const visibleWarnings = useMemo(
    () => warnings.filter(w => !dismissedWarningIds.has(w.id)),
    [warnings, dismissedWarningIds]
  )
  useEffect(() => {
    setDismissedWarningIds(new Set())
  }, [selectedId])
  const dismissWarning = useCallback((id) => {
    setDismissedWarningIds(prev => new Set(prev).add(id))
  }, [])

  const markDirty = useCallback((id) => {
    if (id == null) return
    setDirtySet(prev => new Set(prev).add(id))
  }, [])

  const clearDirty = useCallback((id) => {
    setDirtySet(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const showToast = useCallback((msg, ok = true, duration = ok ? 2000 : 4000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, ok })
    toastTimerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  selectedIdRef.current = selectedId
  showToastRef.current = showToast

  const patchRaw = useCallback((id, patchFn) => {
    setRawMap(prev => {
      if (!prev[id]) return prev
      return { ...prev, [id]: patchFn(prev[id]) }
    })
  }, [])

  const loadPreset = useCallback((preset, raw, select = true) => {
    setPresets(prev => ({ ...prev, [preset.number]: preset }))
    setRawMap(prev => ({ ...prev, [preset.number]: raw }))
    if (select) {
      setSelectedId(preset.number)
      setEditPreset(clone(preset))
      setSelectedPad(null)
      setSelectedKnob(null)
      setSelectedFader(null)
    }
  }, [])

  useEffect(() => {
    // Public Safe Baseline: keine eingebetteten Factory-Presets
    // (presets-data.js ist nicht Teil des oeffentlichen Repos). Presets
    // kommen ausschliesslich per Geraete-Dump (onPreset-Handler weiter unten)
    // oder ueber "Preset importieren" hinzu.
    const embeddedPresets = []
    const loaded = {}
    embeddedPresets.forEach(entry => {
      const preset = normalizePreset(entry)
      loaded[preset.number] = { preset, raw: entry.raw }
    })
    const nums = Object.keys(loaded).map(Number).sort((a, b) => a - b)
    nums.forEach(n => loadPreset(loaded[n].preset, loaded[n].raw, false))
    if (nums.length) {
      setSelectedId(nums[0])
      setEditPreset(clone(loaded[nums[0]].preset))
      setStatus(`${nums.length} Presets geladen`)
    } else {
      setStatus('Keine Presets geladen')
    }
    const counts = {}
    nums.forEach(n => { counts[n] = loadSnapshots(n).length })
    setSnapshotCounts(counts)
  }, [loadPreset])

  useEffect(() => {
    saveTags(presetTags)
  }, [presetTags])

  useEffect(() => {
    const onMonitor = (evt) => {
      setMonitorEvents(prev => [evt, ...prev].slice(0, MONITOR_MAX))
    }
    const unsub = window.midi.onMonitor?.(onMonitor)
    return () => unsub?.()
  }, [])

  useEffect(() => {
    const onPortTestEvent = (payload) => setPortTestLastHit(payload)
    const unsub = window.midi.onPortTestEvent?.(onPortTestEvent)
    return () => unsub?.()
  }, [])

  const startPortTest = useCallback(async () => {
    setPortTestLastHit(null)
    const r = await window.midi.portTestStart()
    setPortTestStartResult(r)
    if (!r?.ok) {
      setStatus(r?.error || '⚠️ Port-Test konnte nicht gestartet werden')
      showToast(r?.error || '✗ Port-Test fehlgeschlagen', false, 5000)
      return
    }
    setPortTestActive(true)
    setMidiLearnActive(false)
    setStatus('🔌 Port-Test aktiv – Pad am MPD24 drücken (MIDI-Learn gesperrt)')
    showToast('✓ Port-Test gestartet')
  }, [showToast])

  const stopPortTest = useCallback(async () => {
    await window.midi.portTestStop()
    setPortTestActive(false)
    setPortTestStartResult(null)
    setStatus('Port-Test gestoppt')
  }, [])

  // Tab-Wechsel weg vom Monitor beendet einen laufenden Port-Test (temporaer
  // geoeffnete Ports werden im Main-Prozess geschlossen).
  useEffect(() => {
    if (mainTab !== 'monitor' && portTestActive) {
      stopPortTest()
    }
  }, [mainTab, portTestActive, stopPortTest])

  // Absicherung beim Unmount, unabhaengig vom React-State.
  useEffect(() => {
    return () => { window.midi.portTestStop?.() }
  }, [])

  const saveAutoSnapshot = useCallback(() => {
    if (selectedId == null || !editPreset || !rawMap[selectedId]) return
    pushSnapshot(selectedId, { preset: clone(editPreset), raw: [...rawMap[selectedId]] })
    setSnapshotCounts(prev => ({ ...prev, [selectedId]: loadSnapshots(selectedId).length }))
  }, [selectedId, editPreset, rawMap])

  const undoSnapshot = useCallback(() => {
    if (selectedId == null) return
    const snap = popSnapshot(selectedId)
    if (!snap) return
    setEditPreset(clone(snap.preset))
    setPresets(prev => ({ ...prev, [selectedId]: clone(snap.preset) }))
    setRawMap(prev => ({ ...prev, [selectedId]: [...snap.raw] }))
    markDirty(selectedId)
    setSnapshotCounts(prev => ({ ...prev, [selectedId]: loadSnapshots(selectedId).length }))
    showToast('↩ Snapshot wiederhergestellt')
  }, [selectedId, markDirty, showToast])

  const onTagsChange = useCallback((num, tags) => {
    setPresetTags(prev => ({ ...prev, [num]: tags }))
  }, [])

  useEffect(() => {
    window.midi.getPorts().then(p => {
      setPorts(p)
      setInput(defaultInputRef(p))
      setOutput(defaultOutputRef(p))
    })
    const unsubPreset = window.midi.onPreset(({ preset, raw }) => {
      if (!raw || raw.length !== 505) return
      const pending = pendingPresetRef.current
      if (pending != null && preset.number === pending) {
        pendingPresetRef.current = null
        if (loadPresetTimeoutRef.current) clearTimeout(loadPresetTimeoutRef.current)
        const normalized = normalizePreset({ preset, raw })
        setPresets(prev => ({ ...prev, [normalized.number]: normalized }))
        setRawMap(prev => ({ ...prev, [normalized.number]: raw }))
        if (selectedIdRef.current === normalized.number) {
          setEditPreset(clone(normalized))
          clearDirty(normalized.number)
        }
        setStatus(`✓ Preset ${normalized.number} neu geladen`)
        showToastRef.current(`✓ Preset ${normalized.number} neu geladen`)
        return
      }
      loadPreset(normalizePreset({ preset, raw }), raw)
    })
    const unsubStatus = window.midi.onStatus(({ state, connected: isOn }) => {
      const next = state || (isOn ? 'connected' : 'disconnected')
      setConnState(next)
      if (next === 'connected') {
        wasConnectedRef.current = true
        setShowDisconnectBanner(false)
      } else if (next === 'disconnected' && wasConnectedRef.current) {
        setShowDisconnectBanner(true)
        wasConnectedRef.current = false
        setMidiLearnActive(false)
      }
    })
    return () => {
      unsubPreset?.()
      unsubStatus?.()
    }
  }, [loadPreset, clearDirty])

  const connect = async () => {
    if (!input || !output) return setStatus('⚠️ Input und Output wählen')
    setConnState('connecting')
    setStatus('Verbinde…')
    const r = await window.midi.connect(input, output)
    if (r?.error) {
      setConnState('disconnected')
      return setStatus(r.error)
    }
    if (r?.ok) {
      wasConnectedRef.current = true
    }
    setConnState('connected')
    setShowDisconnectBanner(false)
    setStatus('MPD24 verbunden')
  }

  const onSelectPreset = (n) => {
    const num = +n
    if (!presets[num]) return
    setSelectedId(num)
    const preset = clone(presets[num])
    if (rawMap[num]) preset.name = nameFromRaw(rawMap[num])
    setEditPreset(preset)
    setSelectedPad(null)
    setSelectedKnob(null)
    setSelectedFader(null)
  }

  const syncPadIndex = (next, idx, patch) => {
    BANKS.forEach(b => Object.assign(next.banks[b][idx], patch))
  }

  const updatePad = useCallback((bank, idx, field, value) => {
    setEditPreset(prev => {
      const next = clone(prev)
      const pad = next.banks[bank][idx]
      if (field === 'eventType') {
        pad.eventType = value
        if (value === 'PROG') {
          pad.program = pad.program ?? pad.note ?? 0
          pad.note = pad.program
          pad.noteName = `Prog ${pad.program}`
          pad.mode = 'TGL'
          pad.pressure = 'OFF'
        } else {
          pad.noteName = noteToName(pad.note)
        }
      } else if (field === 'program') {
        pad.program = +value
        pad.note = +value
        pad.noteName = `Prog ${+value}`
      } else if (field === 'note') {
        pad.note = +value
        pad.noteName = pad.eventType === 'PROG' ? `Prog ${+value}` : noteToName(+value)
        if (pad.eventType === 'PROG') pad.program = +value
      } else if (field === 'channel') {
        const ch = +value
        pad.channel = ch
        pad.channelLabel = channelLabel(ch)
        next.channels[idx] = ch
        syncPadIndex(next, idx, { channel: ch, channelLabel: channelLabel(ch) })
      } else if (field === 'mode') {
        pad.mode = value
        next.modes[idx] = value
        syncPadIndex(next, idx, { mode: value })
      } else if (field === 'pressure') {
        pad.pressure = value
        syncPadIndex(next, idx, { pressure: value })
      } else if (field === 'bankM' || field === 'bankL') {
        pad[field] = value === 'OFF' ? 'OFF' : +value
      }
      next[`bank${bank}`] = next.banks[bank]
      return next
    })

    if (selectedId != null) {
      const patch = {}
      if (field === 'program') {
        patch.program = +value
        patch.note = +value
      }
      if (field === 'note') patch.note = +value
      if (field === 'channel') patch.channel = +value
      if (field === 'mode') patch.mode = value
      if (field === 'pressure') patch.pressure = value
      if (field === 'bankM') patch.bankM = value === 'OFF' ? 'OFF' : +value
      if (field === 'bankL') patch.bankL = value === 'OFF' ? 'OFF' : +value
      if (field === 'eventType') {
        patch.eventType = value
        const pad = editPreset?.banks?.[bank]?.[idx]
        if (pad) {
          patch.mode = value === 'PROG' ? 'TGL' : pad.mode
          if (value === 'PROG') {
            patch.program = pad.program ?? pad.note ?? 0
            patch.note = patch.program
          } else {
            patch.note = pad.note
          }
        }
      }
      patchRaw(selectedId, raw => patchPadInRaw(raw, bank, idx, patch))
      markDirty(selectedId)
    }
  }, [selectedId, patchRaw, markDirty, editPreset])

  useEffect(() => {
    const onNote = ({ note }) => {
      if (selectedPad == null || selectedId == null) return
      if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current)
      setMidiLearnActive(false)
      window.midi.learnStop()
      updatePad(activeBank, selectedPad, 'note', note)
      setStatus(`✓ Note ${noteToName(note)} gelernt!`)
      showToast(`✓ Note ${noteToName(note)} gelernt!`)
    }
    const unsub = window.midi.onNoteIn(onNote)
    return () => {
      unsub?.()
      window.midi.learnStop()
      if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current)
    }
  }, [selectedPad, activeBank, selectedId, updatePad])

  const updateKnob = (idx, field, value) => {
    const num = +value
    setEditPreset(prev => {
      const next = clone(prev)
      next.knobs[idx][field] = num
      if (field === 'ch') next.knobs[idx].channelLabel = channelLabel(num)
      return next
    })
    if (selectedId != null) {
      patchRaw(selectedId, raw => patchKnobInRaw(raw, idx, { [field]: num }))
      markDirty(selectedId)
    }
  }

  const updateFader = (idx, field, value) => {
    const num = +value
    setEditPreset(prev => {
      const next = clone(prev)
      next.faders[idx][field] = num
      if (field === 'ch') next.faders[idx].channelLabel = channelLabel(num)
      return next
    })
    if (selectedId != null) {
      patchRaw(selectedId, raw => patchFaderInRaw(raw, idx, { [field]: num }))
      markDirty(selectedId)
    }
  }

  const updatePresetName = (value) => {
    const name = value.slice(0, 8)
    setEditPreset(prev => ({ ...prev, name }))
    if (selectedId == null || !rawMap[selectedId]) return
    patchRaw(selectedId, raw => patchNameInRaw(raw, name))
    markDirty(selectedId)
  }

  const startMidiLearn = async () => {
    if (!connected) return setStatus('⚠️ Bitte zuerst MIDI verbinden')
    if (portTestActive) return setStatus('⚠️ Port-Test aktiv – zuerst stoppen, um MIDI-Learn zu nutzen')
    if (selectedPad == null) return setStatus('⚠️ Zuerst ein Pad wählen')
    const r = await window.midi.learnStart()
    if (r && r.ok === false) return setStatus(r.error || '⚠️ MIDI-Learn gesperrt')
    setMidiLearnActive(true)
    if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current)
    learnTimeoutRef.current = setTimeout(() => {
      setMidiLearnActive(false)
      window.midi.learnStop()
      setStatus('⏱ Timeout – keine Note empfangen')
      showToast('⏱ Timeout – keine Note empfangen', false, 4000)
    }, 5000)
    setStatus('🎹 MIDI-Learn aktiv – Note am Gerät spielen…')
  }

  const sendToDevice = async () => {
    if (!editPreset || !rawMap[selectedId]) return setStatus('⚠️ Kein Raw-SysEx')
    if (!connected) return showToast('✗ Fehler – Gerät verbunden?', false, 4000)
    saveAutoSnapshot()
    setStatus('Sende…')
    const synced = serializeRawFromPreset(editPreset, rawMap[selectedId])
    if (!validateRaw(synced)) {
      setStatus('⚠ Preset-Daten beschädigt')
      return showToast('⚠ Preset-Daten beschädigt', false, 4000)
    }
    const r = await window.midi.writePreset(synced)
    if (!r?.ok) {
      setStatus(r?.error || 'Senden fehlgeschlagen')
      return showToast('✗ Fehler – Gerät verbunden?', false, 4000)
    }
    if (r.raw?.length) setRawMap(prev => ({ ...prev, [selectedId]: r.raw }))
    setPresets(prev => ({ ...prev, [selectedId]: clone(editPreset) }))
    clearDirty(selectedId)
    setStatus(`Preset ${selectedId} gesendet`)
    showToast('✓ Gesendet')
  }

  const sendAllToDevice = async () => {
    if (!connected) return showToast('✗ Fehler – Gerät verbunden?', false, 4000)
    const nums = Object.keys(rawMap).map(Number).sort((a, b) => a - b)
    if (!nums.length) return
    setBulkProgress({ current: 0, total: nums.length })
    setStatus(`Sende Preset 0/${nums.length}…`)

    for (let i = 0; i < nums.length; i++) {
      const n = nums[i]
      const preset = n === selectedId ? editPreset : presets[n]
      const synced = serializeRawFromPreset(preset, rawMap[n])
      if (!validateRaw(synced)) {
        setBulkProgress(null)
        setStatus('⚠ Preset-Daten beschädigt')
        return showToast('⚠ Preset-Daten beschädigt', false, 4000)
      }
      setStatus(`Sende Preset ${i + 1}/${nums.length}…`)
      const r = await window.midi.writePreset(synced)
      if (!r?.ok) {
        setBulkProgress(null)
        return showToast('✗ Fehler – Gerät verbunden?', false, 4000)
      }
      if (r.raw?.length) setRawMap(prev => ({ ...prev, [n]: r.raw }))
      setBulkProgress({ current: i + 1, total: nums.length })
      await new Promise(res => setTimeout(res, 150))
    }

    setBulkProgress(null)
    setDirtySet(new Set())
    setStatus('✓ Alle Presets übertragen')
    showToast('✓ Alle 30 Presets übertragen')
  }

  const loadFromDevice = async () => {
    if (!connected || !selectedId) return showToast('✗ Fehler – Gerät verbunden?', false, 4000)
    setStatus(`Preset ${selectedId}: GLOBAL → SysEx Tx → VALUE → ENTER am MPD24`)
    showToast('Am MPD24: GLOBAL → [>] SysEx Tx → VALUE → ENTER', false, 6000)
    pendingPresetRef.current = selectedId
    if (loadPresetTimeoutRef.current) clearTimeout(loadPresetTimeoutRef.current)
    loadPresetTimeoutRef.current = setTimeout(() => {
      if (pendingPresetRef.current === selectedId) {
        pendingPresetRef.current = null
        setStatus('⏱ Timeout – kein Preset empfangen')
        showToast('⏱ Timeout – SysEx Tx + ENTER am Gerät?', false, 5000)
      }
    }, 30000)
    const r = await window.midi.waitForPreset(selectedId)
    if (!r?.ok) {
      pendingPresetRef.current = null
      if (loadPresetTimeoutRef.current) clearTimeout(loadPresetTimeoutRef.current)
      return showToast('✗ Fehler – Gerät verbunden?', false, 4000)
    }
  }

  const exportAll = async () => {
    const list = Object.keys(rawMap).sort((a, b) => +a - +b).map(n => ({
      number: +n,
      preset: +n === selectedId ? editPreset : presets[n],
      raw: rawMap[n],
    }))
    const r = await window.midi.exportJSON({ presets: list, meta: { tags: presetTags } })
    if (r?.error) return setStatus('⚠️ Export fehlgeschlagen')
    setStatus(`✅ ${r.count} Presets → ${r.path}`)
    showToast(`✓ ${r.count} exportiert`)
  }

  const importFromDisk = async () => {
    const r = await window.midi.importJSON()
    if (r?.error && !r.sent) return setStatus(`⚠️ ${r.error}`)
    setStatus(`✅ ${r.sent}/${r.total} Presets importiert`)
    showToast(`✓ ${r.sent} importiert`)
  }

  // Erzeugt einen User-Slot-Entwurf aus einer JSON-Vorlage. Ersetzt nur den lokalen
  // Bearbeitungsstand (presets/rawMap/editPreset) und markiert ihn als unsaved -
  // sendet nichts ans Gerät. Der bisherige Rohdump des Ziel-Slots dient nur als
  // Basis fürs Patchen (Header/unbelegte Bytes), nicht als "das ist schon SICKFYN1".
  const loadPresetFromTemplate = (template) => {
    // Ohne bekannten Rohdump fuer den Ziel-Slot (kein presets-data.js, noch
    // kein Geraete-Dump geladen) dient ein synthetischer Blank-Rahmen als
    // Basis - buildPresetFromTemplate() nutzt daraus nur Header/Slot-Nummer,
    // alle Pad-/Knob-/Fader-Werte kommen vollstaendig aus der Vorlage.
    const knownRaw = rawMap[template.slot]
    const baseRaw = knownRaw || createBlankRawPreset(template.slot)
    try {
      const { preset, raw } = buildPresetFromTemplate(template, baseRaw)
      loadPreset(preset, raw, true)
      markDirty(preset.number)
      const note = knownRaw ? '' : ' (kein Geräte-Dump vorhanden, synthetischer Rahmen verwendet)'
      setStatus(`Vorlage „${template.name}“ als Entwurf für Slot ${preset.number} geladen${note} – noch nicht gesendet`)
      showToast(`✓ Vorlage geladen – Entwurf Slot ${preset.number} (unsaved)`)
    } catch (err) {
      showToast(`✗ ${err.message}`, false, 6000)
    }
  }

  const presetList = Object.keys(presets).sort((a, b) => +a - +b).map(n => ({
    number: +n,
    preset: +n === selectedId ? editPreset : presets[n],
  }))

  const filteredPresetNums = Object.keys(presets)
    .map(Number)
    .sort((a, b) => a - b)
    .filter(n => {
      const q = presetSearch.trim().toLowerCase()
      if (!q) return true
      const p = n === selectedId ? editPreset : presets[n]
      const name = (p?.name || '').toLowerCase()
      const tags = (presetTags[n] || []).join(' ').toLowerCase()
      return name.includes(q) || tags.includes(q) || String(n).includes(q)
    })

  const currentTags = selectedId != null ? (presetTags[selectedId] || []) : []

  const MAIN_TABS = [
    { id: 'editor', label: 'Editor', tip: TIPS.tabEditor },
    { id: 'global', label: 'Global & Info', tip: TIPS.tabGlobal },
    { id: 'monitor', label: 'Monitor', tip: TIPS.tabMonitor },
    { id: 'tools', label: 'Preset-Tools', tip: TIPS.tabTools },
    { id: 'tutorials', label: 'Tutorials', tip: TIPS.tabTutorials },
  ]

  const pads = editPreset?.banks?.[activeBank] || []
  const selPad = selectedPad != null ? pads[selectedPad] : null

  return (
    <div style={S.page}>
      <style>{`
        @keyframes midiLearnPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(29, 78, 216, 0.55); }
          50% { box-shadow: 0 0 0 10px rgba(29, 78, 216, 0); }
        }
      `}</style>

      {showDisconnectBanner && !connected && (
        <div style={S.banner}>
          ⚠ MPD24 getrennt – bitte USB-Kabel prüfen
        </div>
      )}

      <div style={S.topBar}>
        <span style={{ fontWeight: 800, color: ACCENT, fontSize: '15px' }}>MPD24 Editor</span>

        <Tooltip text={connState === 'connected' ? TIPS.connConnected : connState === 'connecting' ? TIPS.connConnecting : TIPS.connDisconnected}>
          <button
            id="conn-status"
            style={S.connBadge(connState)}
            onClick={connState === 'disconnected' ? connect : undefined}
          >
            {connState === 'connected' ? '🟢 MPD24 verbunden' : connState === 'connecting' ? '🟡 Verbinde…' : '🔴 Nicht verbunden'}
          </button>
        </Tooltip>

        <div id="midi-ports" style={{ display: 'flex', gap: '10px' }}>
        <Tooltip text={TIPS.midiInput}>
          <select value={input} onChange={e => setInput(e.target.value)} style={{ ...S.select, maxWidth: 160 }}>
            <option value="">Input</option>
            {ports.inputs.map((p, i) => <option key={i} value={`${i}:${p}`}>{p} [{i}]</option>)}
          </select>
        </Tooltip>
        <Tooltip text={TIPS.midiOutput}>
          <select value={output} onChange={e => setOutput(e.target.value)} style={{ ...S.select, maxWidth: 160 }}>
            <option value="">Output</option>
            {ports.outputs.map((p, i) => <option key={i} value={`${i}:${p}`}>{p} [{i}]</option>)}
          </select>
        </Tooltip>
        </div>
        <Tooltip text={TIPS.connect}>
          <button id="btn-connect" style={S.btn()} onClick={connect}>Verbinden</button>
        </Tooltip>

        <Tooltip text={TIPS.presetSelect}>
          <input
            type="search"
            placeholder="Preset suchen…"
            value={presetSearch}
            onChange={e => setPresetSearch(e.target.value)}
            style={{ ...S.input, width: '120px', padding: '7px 8px', fontSize: '12px' }}
          />
        </Tooltip>
        <Tooltip text={TIPS.presetSelect}>
          <select
            id="preset-select"
            value={selectedId ?? ''}
            onChange={e => onSelectPreset(e.target.value)}
            style={{ ...S.select, minWidth: 80 }}
            disabled={!presetCount}
          >
            <option value="">Preset</option>
            {filteredPresetNums.map(n => (
              <option key={n} value={n}>
                {n <= FACTORY_LOCKED_MAX ? '🔒 ' : ''}{String(n).padStart(2, '0')}{dirtySet.has(n) ? ' ●' : ''}
              </option>
            ))}
          </select>
        </Tooltip>

        <Tooltip text={TIPS.loadFromDevice}>
          <button style={S.btn()} onClick={loadFromDevice} disabled={!connected || !selectedId}>
            ↓ Vom Gerät laden
          </button>
        </Tooltip>

        {editPreset && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tooltip text={TIPS.presetName}>
                <input
                  id="preset-name"
                  type="text"
                  value={editPreset.name}
                  onChange={e => updatePresetName(e.target.value)}
                  maxLength={8}
                  spellCheck={false}
                  disabled={isFactoryLocked}
                  style={{ ...S.input, width: '9em', padding: '7px 10px', fontSize: '13px', opacity: isFactoryLocked ? 0.5 : 1 }}
                />
              </Tooltip>
              <span style={{ ...S.mono, fontSize: '11px', color: '#71717a' }}>{editPreset.name.length}/8</span>
              {isDirty && (
                <Tooltip text={TIPS.unsaved}>
                  <span style={{ color: '#facc15', fontSize: '11px', fontWeight: 600, cursor: 'help' }}>* unsaved</span>
                </Tooltip>
              )}
              {isFactoryLocked && (
                <Tooltip text={TIPS.factoryLocked}>
                  <span id="factory-locked-badge" style={{ color: '#a1a1aa', fontSize: '11px', fontWeight: 600, cursor: 'help' }}>🔒 Werk</span>
                </Tooltip>
              )}
            </div>
            {currentTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {currentTags.map(t => (
                  <span key={t} style={{
                    background: '#27272a', color: '#71717a', fontSize: '10px',
                    padding: '2px 6px', borderRadius: '4px',
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <Tooltip text={isFactoryLocked ? TIPS.factoryLocked : PRESET_WRITE_LOCKED ? TIPS.presetWriteLocked : TIPS.send}>
          <button id="btn-send" style={S.btn(true)} onClick={sendToDevice} disabled={!connected || !editPreset || isFactoryLocked || PRESET_WRITE_LOCKED}>
            Zum Gerät senden
          </button>
        </Tooltip>
        <Tooltip text={PRESET_WRITE_LOCKED ? TIPS.presetWriteLocked : TIPS.sendAll}>
          <button id="btn-send-all" style={S.btn()} onClick={sendAllToDevice} disabled={!connected || bulkProgress != null || PRESET_WRITE_LOCKED}>
            Alle 30 Presets senden
          </button>
        </Tooltip>
        <Tooltip text={TIPS.export}>
          <button id="btn-export" style={S.btn()} onClick={exportAll} disabled={!presetCount}>
            Alle Presets sichern
          </button>
        </Tooltip>
        <Tooltip text={PRESET_WRITE_LOCKED ? TIPS.presetWriteLocked : TIPS.import}>
          <button style={S.btn()} onClick={importFromDisk} disabled={!connected || PRESET_WRITE_LOCKED}>
            Preset importieren
          </button>
        </Tooltip>
        <Tooltip text={TIPS.loadTemplate}>
          <button id="btn-load-template" style={S.btn()} onClick={() => loadPresetFromTemplate(sickfyn1Template)}>
            Preset aus Vorlage laden
          </button>
        </Tooltip>
      </div>

      {PRESET_WRITE_LOCKED && (
        <div id="preset-write-lock-notice" style={{
          margin: '0 16px 8px', padding: '8px 12px',
          background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px',
          display: 'flex', alignItems: 'flex-start', gap: '8px',
        }}>
          <span style={{ color: '#facc15', fontSize: '15px', lineHeight: '18px' }}>⚠</span>
          <span style={{ color: '#a1a1aa', fontSize: '12px', lineHeight: '18px' }}>{PRESET_WRITE_LOCK_NOTICE}</span>
        </div>
      )}

      {bulkProgress && (
        <div style={{ padding: '4px 16px 8px' }}>
          <div style={{ fontSize: '12px', color: '#a1a1aa' }}>
            Sende Preset {bulkProgress.current}/{bulkProgress.total}…
          </div>
          <div style={S.progressBar}>
            <div style={S.progressFill((bulkProgress.current / bulkProgress.total) * 100)} />
          </div>
        </div>
      )}

      <p style={{ padding: '6px 16px', margin: 0, color: '#71717a', fontSize: '12px' }}>{status}</p>

      {editPreset && <WarningsPanel warnings={visibleWarnings} onDismiss={dismissWarning} />}

      <div style={{ display: 'flex', gap: '4px', padding: '0 16px', borderBottom: '1px solid #27272a' }}>
        {MAIN_TABS.map(t => (
          <Tooltip key={t.id} text={t.tip}>
            <button
              id={`tab-${t.id}`}
              style={S.tab(mainTab === t.id)}
              onClick={() => setMainTab(t.id)}
            >
              {t.label}
            </button>
          </Tooltip>
        ))}
      </div>

      {mainTab === 'global' && <GlobalInfoPanel />}

      {mainTab === 'monitor' && (
        <MonitorPanel
          events={monitorEvents}
          onClear={() => setMonitorEvents([])}
          portTestActive={portTestActive}
          portTestLastHit={portTestLastHit}
          portTestStartResult={portTestStartResult}
          onStartPortTest={startPortTest}
          onStopPortTest={stopPortTest}
          showToast={showToast}
        />
      )}

      {mainTab === 'tools' && editPreset && (
        <PresetToolsPanel
          presets={presetList}
          currentPreset={editPreset}
          currentNum={selectedId}
          presetTags={presetTags}
          onTagsChange={onTagsChange}
          onUndoSnapshot={undoSnapshot}
          hasSnapshot={selectedId != null && hasSnapshots(selectedId)}
          snapshotCount={snapshotCounts[selectedId] || 0}
        />
      )}

      {mainTab === 'tutorials' && (
        <ErrorBoundary name="TutorialPanel">
          <TutorialPanel onRequestTab={setMainTab} />
        </ErrorBoundary>
      )}

      {mainTab === 'editor' && !editPreset ? (
        <div style={{ padding: '32px 16px', color: '#52525b' }}>Keine Presets geladen.</div>
      ) : mainTab === 'editor' && editPreset ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, alignItems: 'flex-start' }}>
          {/* Left: grid + knobs/faders */}
          <div style={{ ...S.section, flex: '1 1 480px', borderRight: '1px solid #27272a' }}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
              {BANKS.map(b => (
                <Tooltip key={b} text={TIPS.bankTab}>
                  <button style={S.tab(activeBank === b)} onClick={() => { setActiveBank(b); setSelectedPad(null) }}>
                    Bank {b}
                  </button>
                </Tooltip>
              ))}
            </div>

            <div id="pad-grid" style={S.grid4}>
              {PAD_LAYOUT.flat().map(idx => {
                const pad = pads[idx]
                if (!pad) return null
                return (
                  <Tooltip key={`${activeBank}-${pad.pad}`} text={padTip(pad, idx, selectedPad, isDirty)} block>
                    <div
                      style={{ ...S.pad(selectedPad === idx), width: '100%' }}
                      onClick={() => setSelectedPad(idx)}
                    >
                      <div style={{ color: '#52525b', fontSize: '10px' }}>PAD {pad.pad}</div>
                      <div style={{ ...S.mono, fontSize: '17px', fontWeight: 700, color: ACCENT }}>
                        {padDisplayLabel(pad)}
                      </div>
                      <div style={{ ...S.mono, fontSize: '11px', color: '#a1a1aa' }}>
                        {pad.eventType === 'PROG' ? 'PROG' : pad.note}
                      </div>
                      <div style={{ fontSize: '10px', color: '#71717a', marginTop: '4px', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <span>{pad.channelLabel}</span>
                        {pad.eventType !== 'PROG' && <span style={S.modeBadge(pad.mode)}>{pad.mode}</span>}
                        {pad.eventType === 'PROG' && <span style={{ ...S.modeBadge('TGL'), background: '#3f1014', color: ACCENT }}>PROG</span>}
                      </div>
                    </div>
                  </Tooltip>
                )
              })}
            </div>

            <h2 style={{ ...S.h2, marginTop: '20px' }}>Knobs</h2>
            <div id="knob-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {editPreset.knobs.map((k, i) => (
                <Tooltip key={k.knob} text={knobTip(k)}>
                  <button style={S.chip(selectedKnob === i)} onClick={() => setSelectedKnob(selectedKnob === i ? null : i)}>
                    K{k.knob} · CC{k.cc}
                  </button>
                </Tooltip>
              ))}
            </div>
            {selectedKnob != null && (
              <div id="knob-range" style={S.ctrlRow}>
                <Field label="CC" tip={TIPS.knobCc}>
                  <Tooltip text={TIPS.knobCc}>
                    <input id="knob-cc" type="number" min={0} max={127} value={editPreset.knobs[selectedKnob].cc} style={S.input}
                      disabled={isFactoryLocked}
                      onChange={e => updateKnob(selectedKnob, 'cc', e.target.value)} />
                  </Tooltip>
                </Field>
                <Field label="Channel" tip={TIPS.knobChannel}>
                  <Tooltip text={TIPS.knobChannel}>
                    <select id="knob-channel" value={editPreset.knobs[selectedKnob].ch} style={S.input}
                      disabled={isFactoryLocked}
                      onChange={e => updateKnob(selectedKnob, 'ch', e.target.value)}>
                      {CTRL_CHANNEL_OPTS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                  </Tooltip>
                </Field>
                <Field label="Min" tip={TIPS.knobMin}>
                  <Tooltip text={TIPS.knobMin}>
                    <input type="number" min={0} max={127} value={editPreset.knobs[selectedKnob].min} style={S.input}
                      disabled={isFactoryLocked}
                      onChange={e => updateKnob(selectedKnob, 'min', e.target.value)} />
                  </Tooltip>
                </Field>
                <Field label="Max" tip={TIPS.knobMax}>
                  <Tooltip text={TIPS.knobMax}>
                    <input type="number" min={0} max={127} value={editPreset.knobs[selectedKnob].max} style={S.input}
                      disabled={isFactoryLocked}
                      onChange={e => updateKnob(selectedKnob, 'max', e.target.value)} />
                  </Tooltip>
                </Field>
              </div>
            )}

            <h2 style={{ ...S.h2, marginTop: '12px' }}>Faders</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {editPreset.faders.map((f, i) => (
                <Tooltip key={f.fader} text={faderTip(f)}>
                  <button style={S.chip(selectedFader === i)} onClick={() => setSelectedFader(selectedFader === i ? null : i)}>
                    F{f.fader} · CC{f.cc}
                  </button>
                </Tooltip>
              ))}
            </div>
            {selectedFader != null && (
              <div style={S.ctrlRow}>
                <Field label="CC" tip={TIPS.faderCc}>
                  <Tooltip text={TIPS.faderCc}>
                    <input type="number" min={0} max={127} value={editPreset.faders[selectedFader].cc} style={S.input}
                      disabled={isFactoryLocked}
                      onChange={e => updateFader(selectedFader, 'cc', e.target.value)} />
                  </Tooltip>
                </Field>
                <Field label="Channel" tip={TIPS.faderChannel}>
                  <Tooltip text={TIPS.faderChannel}>
                    <select value={editPreset.faders[selectedFader].ch} style={S.input}
                      disabled={isFactoryLocked}
                      onChange={e => updateFader(selectedFader, 'ch', e.target.value)}>
                      {CTRL_CHANNEL_OPTS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                  </Tooltip>
                </Field>
                <Field label="Min" tip={TIPS.faderMin}>
                  <Tooltip text={TIPS.faderMin}>
                    <input type="number" min={0} max={127} value={editPreset.faders[selectedFader].min} style={S.input}
                      disabled={isFactoryLocked}
                      onChange={e => updateFader(selectedFader, 'min', e.target.value)} />
                  </Tooltip>
                </Field>
                <Field label="Max" tip={TIPS.faderMax}>
                  <Tooltip text={TIPS.faderMax}>
                    <input type="number" min={0} max={127} value={editPreset.faders[selectedFader].max} style={S.input}
                      disabled={isFactoryLocked}
                      onChange={e => updateFader(selectedFader, 'max', e.target.value)} />
                  </Tooltip>
                </Field>
              </div>
            )}
          </div>

          {/* Right: pad edit panel */}
          <div style={{ ...S.section, flex: '0 0 300px', background: '#0f0f11' }}>
            {selPad ? (
              <div style={S.panel}>
                <h3 style={{ margin: '0 0 16px', color: '#fff', fontSize: '14px' }}>
                  PAD {selPad.pad} – Bank {activeBank}
                </h3>

                {activeBank === 'A' && (
                <Field label="Event-Typ" tip={TIPS.eventType}>
                  <Tooltip text={TIPS.eventType}>
                    <select
                      id="pad-event-type"
                      value={selPad.eventType || 'NOTE'}
                      style={S.input}
                      disabled={isFactoryLocked}
                      onChange={e => updatePad(activeBank, selectedPad, 'eventType', e.target.value)}
                    >
                      <option value="NOTE">NOTE</option>
                      <option value="PROG">PROGRAM CHANGE</option>
                    </select>
                  </Tooltip>
                </Field>
                )}

                {selPad.eventType === 'PROG' && activeBank === 'A' ? (
                  <>
                    <div style={{ marginTop: '12px' }}>
                      <Field label="Program (0–127)" tip={TIPS.program}>
                        <Tooltip text={TIPS.program}>
                          <input
                            id="pad-program"
                            type="number"
                            min={0}
                            max={127}
                            value={selPad.program ?? selPad.note}
                            style={S.input}
                            disabled={isFactoryLocked}
                            onChange={e => updatePad(activeBank, selectedPad, 'program', +e.target.value)}
                          />
                        </Tooltip>
                      </Field>
                    </div>
                    <div id="pad-bank" style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Field label="Bank M (MSB)" tip={TIPS.bankM}>
                        <Tooltip text={TIPS.bankM}>
                          <select
                            value={selPad.bankM === 'OFF' ? 'OFF' : selPad.bankM}
                            style={S.input}
                            disabled={isFactoryLocked}
                            onChange={e => updatePad(activeBank, selectedPad, 'bankM', e.target.value === 'OFF' ? 'OFF' : +e.target.value)}
                          >
                            <option value="OFF">OFF</option>
                            {Array.from({ length: 128 }, (_, i) => (
                              <option key={i} value={i}>{i}</option>
                            ))}
                          </select>
                        </Tooltip>
                      </Field>
                      <Field label="Bank L (LSB)" tip={TIPS.bankL}>
                        <Tooltip text={TIPS.bankL}>
                          <select
                            value={selPad.bankL === 'OFF' ? 'OFF' : selPad.bankL}
                            style={S.input}
                            disabled={isFactoryLocked}
                            onChange={e => updatePad(activeBank, selectedPad, 'bankL', e.target.value === 'OFF' ? 'OFF' : +e.target.value)}
                          >
                            <option value="OFF">OFF</option>
                            {Array.from({ length: 128 }, (_, i) => (
                              <option key={i} value={i}>{i}</option>
                            ))}
                          </select>
                        </Tooltip>
                      </Field>
                    </div>
                    <p style={{ margin: '12px 0 0', fontSize: '11px', color: '#71717a', lineHeight: 1.5 }}>
                      {TIPS.pcHelp}
                    </p>
                  </>
                ) : (
                  <Field label="Note" tip={TIPS.noteInput}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Tooltip text={TIPS.noteInput}>
                        <input id="pad-note" type="number" min={0} max={127} value={selPad.note} style={{ ...S.input, width: '72px' }}
                          disabled={isFactoryLocked}
                          onChange={e => updatePad(activeBank, selectedPad, 'note', +e.target.value)} />
                      </Tooltip>
                      <Tooltip text={TIPS.noteName}>
                        <span style={{ ...S.mono, color: ACCENT, fontSize: '13px', cursor: 'help' }}>
                          = {selPad.noteName}
                        </span>
                      </Tooltip>
                    </div>
                  </Field>
                )}

                <div style={{ marginTop: '12px' }}>
                  <Field label="MIDI Channel" tip={TIPS.padChannel}>
                    <Tooltip text={TIPS.padChannel}>
                      <select id="pad-channel" value={selPad.channel} style={S.input}
                        disabled={isFactoryLocked}
                        onChange={e => updatePad(activeBank, selectedPad, 'channel', +e.target.value)}>
                        {PAD_CHANNEL_OPTS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                      </select>
                    </Tooltip>
                  </Field>
                </div>

                {selPad.eventType !== 'PROG' && (
                <div style={{ marginTop: '12px' }}>
                  <Tooltip text={TIPS.pressure}>
                    <label style={{ ...S.label, cursor: 'help' }}>Play Mode</label>
                  </Tooltip>
                  <div id="pad-mode" style={{ display: 'flex', gap: '6px' }}>
                    <Tooltip text={TIPS.mty}>
                      <button
                        style={{ ...S.btn(false), flex: 1, background: selPad.mode === 'MTY' ? ACCENT : '#27272a' }}
                        onClick={() => updatePad(activeBank, selectedPad, 'mode', 'MTY')}
                        disabled={isFactoryLocked}
                      >
                        MTY
                      </button>
                    </Tooltip>
                    <Tooltip text={TIPS.tgl}>
                      <button
                        style={{ ...S.btn(false), flex: 1, background: selPad.mode === 'TGL' ? ACCENT : '#27272a' }}
                        onClick={() => updatePad(activeBank, selectedPad, 'mode', 'TGL')}
                        disabled={isFactoryLocked}
                      >
                        TGL
                      </button>
                    </Tooltip>
                  </div>
                </div>
                )}

                {selPad.eventType !== 'PROG' && (
                <div style={{ marginTop: '12px' }}>
                  <Field label="Pressure" tip={TIPS.pressure}>
                    <Tooltip text={pressureTip(selPad.pressure)}>
                      <select value={selPad.pressure} style={S.input}
                        disabled={isFactoryLocked}
                        onChange={e => updatePad(activeBank, selectedPad, 'pressure', e.target.value)}>
                        {PRESSURE_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </Tooltip>
                  </Field>
                </div>
                )}

                {selPad.eventType !== 'PROG' && (
                <Tooltip text={portTestActive ? TIPS.midiLearnBlockedByPortTest : TIPS.midiLearn} block>
                  <button
                    style={{
                      ...S.btn(false, midiLearnActive),
                      ...(midiLearnActive ? S.learnPulse : {}),
                      width: '100%',
                      marginTop: '16px',
                      display: 'block',
                    }}
                    onClick={startMidiLearn}
                    disabled={!connected || isFactoryLocked || portTestActive}
                  >
                    🎹 MIDI-LEARN
                  </button>
                </Tooltip>
                )}
              </div>
            ) : (
              <Tooltip text={TIPS.padPanelEmpty}>
                <div style={{ ...S.panel, color: '#52525b', fontSize: '13px', textAlign: 'center', cursor: 'help' }}>
                  Pad anklicken zum Bearbeiten
                </div>
              </Tooltip>
            )}
          </div>
        </div>
      ) : null}

      {toast && <div style={S.toast(toast.ok)}>{toast.msg}</div>}
    </div>
  )
}
