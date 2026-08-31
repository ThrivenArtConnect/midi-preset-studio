import { serializeRawFromPreset, patchPadInRaw } from './raw-patch.js'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BANKS = ['A', 'B', 'C', 'D']

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

function buildBankPads(bankTemplate, padDefaults) {
  const { noteStart, padOverrides = {} } = bankTemplate
  return Array.from({ length: 16 }, (_, i) => {
    const padNum = i + 1
    const merged = { ...padDefaults, ...(padOverrides[String(padNum)] || {}) }
    const note = noteStart + i
    const channel = merged.channel ?? 0
    return {
      pad: padNum,
      eventType: merged.eventType ?? 'NOTE',
      note,
      noteName: noteToName(note),
      mode: merged.mode ?? 'MTY',
      pressure: merged.pressure ?? 'OFF',
      channel,
      channelLabel: channelLabel(channel),
      bankM: 'OFF',
      bankL: 'OFF',
    }
  })
}

function buildKnobs(list = []) {
  return list.map((k, i) => ({
    knob: i + 1, cc: k.cc, ch: k.ch, channelLabel: channelLabel(k.ch), min: k.min, max: k.max,
  }))
}

function buildFaders(list = []) {
  return list.map((f, i) => ({
    fader: i + 1, cc: f.cc, ch: f.ch, channelLabel: channelLabel(f.ch), min: f.min, max: f.max,
  }))
}

/**
 * Play Mode, Pressure (Bank B/C/D) und Channel (Bank A-D) liegen laut allen 30
 * Werks-Captures auf je einem gemeinsamen Byte pro Pad-Index, nicht pro Bank.
 * Eine Vorlage, die hier abweichende Werte je Bank verlangt, waere auf der
 * Hardware nicht umsetzbar - deshalb hart geprueft statt still ignoriert.
 *
 * ZUSAETZLICHE KOLLISION (bestaetigt per Roundtrip-Test, siehe
 * test/preset-generator.test.js): Das Play-Mode-Byte fuer Pad-Index 8-15
 * (Pad 9-16) in Bank B/C/D liegt auf denselben Rohbytes (108-115) wie das
 * Event-Type-Flag von Bank A Pad 1-8. TGL auf Pad 9-16 in B/C/D ueberschreibt
 * damit das Event-Type-Flag der entsprechenden Bank-A-Pads (Pad-Index 8 -> A
 * Pad1, ..., Pad-Index 15 -> A Pad8). Fuer SICKFYN1 bleiben deshalb alle 64
 * Pads MTY (keine Ausnahme fuer Pad 13-16). preset-validator.js warnt, falls
 * eine andere Vorlage TGL auf dieser Pad-Kombination setzt.
 */
function assertSharedPadBytesConsistent(banks) {
  for (let i = 0; i < 16; i++) {
    const [a, b, c, d] = BANKS.map(k => banks[k][i])
    if (b.mode !== c.mode || c.mode !== d.mode) {
      throw new Error(
        `buildPresetFromTemplate: Pad ${i + 1} hat unterschiedliche Play-Mode-Werte in Bank B/C/D ` +
        `(${b.mode}/${c.mode}/${d.mode}) - dieses Byte ist zwischen B/C/D geteilt und kann nicht pro Bank abweichen.`
      )
    }
    if (b.pressure !== c.pressure || c.pressure !== d.pressure) {
      throw new Error(
        `buildPresetFromTemplate: Pad ${i + 1} hat unterschiedliche Pressure-Werte in Bank B/C/D ` +
        `(${b.pressure}/${c.pressure}/${d.pressure}) - dieses Byte ist zwischen B/C/D geteilt.`
      )
    }
    if (a.channel !== b.channel || b.channel !== c.channel || c.channel !== d.channel) {
      throw new Error(
        `buildPresetFromTemplate: Pad ${i + 1} hat unterschiedliche Channel-Werte ueber Bank A-D ` +
        `(${a.channel}/${b.channel}/${c.channel}/${d.channel}) - dieses Byte ist bankuebergreifend geteilt.`
      )
    }
  }
}

/**
 * serializeRawFromPreset synct fuer Bank B/C/D bewusst nur die Note (siehe
 * src/shared/raw-patch.js) - Mode/Pressure muessen fuer diese Baenke separat
 * nachgezogen werden. Da das Byte geteilt ist (s.o.), reicht ein Bank-Wert
 * (hier B) als Quelle fuer alle drei.
 */
function applySharedPadBytes(raw, banks) {
  let d = raw
  for (let i = 0; i < 16; i++) {
    const pad = banks.B[i]
    d = patchPadInRaw(d, 'B', i, { mode: pad.mode, pressure: pad.pressure })
  }
  return d
}

/**
 * Baut ein vollstaendiges MPD24-Preset (JS-Objekt + 505-Byte-SysEx) aus einer
 * versionierten JSON-Vorlage (z.B. src/shared/presets/sickfyn1.json).
 * @param {object} template
 * @param {number[]} baseRawPreset - bestehender 505-Byte-Rohdump des Ziel-Slots
 *   (z.B. aus presets-data.js), liefert Header/Slot-Nummer/unbelegte Bytes.
 * @returns {{ preset: object, raw: number[] }}
 */
export function buildPresetFromTemplate(template, baseRawPreset) {
  if (!template?.banks) throw new Error('buildPresetFromTemplate: Vorlage ohne banks{}')
  if (!baseRawPreset || baseRawPreset.length !== 505) {
    throw new Error('buildPresetFromTemplate: baseRawPreset muss 505 Byte lang sein')
  }

  const padDefaults = template.padDefaults || {}
  const banks = {}
  for (const bankKey of BANKS) {
    const bankTemplate = template.banks[bankKey]
    if (!bankTemplate) throw new Error(`buildPresetFromTemplate: Bank ${bankKey} fehlt in Vorlage`)
    banks[bankKey] = buildBankPads(bankTemplate, padDefaults)
  }

  assertSharedPadBytesConsistent(banks)

  const preset = {
    number: template.slot,
    name: (template.name || '').slice(0, 8),
    banks,
    bankA: banks.A, bankB: banks.B, bankC: banks.C, bankD: banks.D,
    modes: banks.A.map(p => p.mode),
    channels: banks.A.map(p => p.channel),
    knobs: buildKnobs(template.knobs),
    faders: buildFaders(template.faders),
  }

  let raw = serializeRawFromPreset(preset, baseRawPreset)
  raw = applySharedPadBytes(raw, banks)

  return { preset, raw }
}
