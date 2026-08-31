const { serializeRawFromPreset } = require('./raw-patch.js')

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

function noteToName(n) {
  if (n == null || n < 0 || n > 127) return '?'
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`
}

function channelLabel(ch) {
  const c = ch | 0
  if (c >= 1 && c <= 16) return `A${c}`
  if (c >= 17 && c <= 32) return `B${c - 16}`
  return `Ch${c}`
}

function parsePressure(v) {
  if (v === 1) return 'CPR'
  if (v === 2) return 'PPR'
  return 'OFF'
}

/**
 * Bank A field layout (30 factory captures, 2026-05-23):
 * - eventTypeA pads 1-8: 108..115; pads 9-16 read alias bytes 116..123
 * - ch pads 1-8: 116..123; pads 9-16: 124..131 (stored as ch−1)
 * - PROG program reuses bank A note byte 52..67; offset 140 is bank D pads 9-16
 */
const OFF = {
  eventTypeA: 108,
  bankMA: 156,
  bankLA: 172,
  mode: 100,
  ch: 116,
  pressure: 148,
  bankNote: { A: 52, B: 68, C: 84, D: 132 },
}

function rawBankVal(v) {
  if (v == null || v >= 127) return 'OFF'
  return v
}

function buildPad(d, i, noteOff, bankKey) {
  const ch = (d[OFF.ch + i] ?? 0) + 1
  const base = {
    pad: i + 1,
    channel: ch,
    channelLabel: channelLabel(ch),
  }

  if (bankKey === 'A') {
    const flag = d[OFF.eventTypeA + i] ?? 0
    if (flag === 0x03) {
      const program = d[OFF.bankNote.A + i] ?? 0
      return {
        ...base,
        eventType: 'PROG',
        mode: 'TGL',
        program,
        note: program,
        noteName: `Prog ${program}`,
        bankM: rawBankVal(d[OFF.bankMA + i]),
        bankL: rawBankVal(d[OFF.bankLA + i]),
        pressure: 'OFF',
      }
    }
    const note = d[noteOff + i] ?? 0
    return {
      ...base,
      eventType: 'NOTE',
      note,
      noteName: noteToName(note),
      mode: flag === 0x02 ? 'TGL' : 'MTY',
      pressure: parsePressure(d[OFF.pressure + i] ?? 0),
      bankM: 'OFF',
      bankL: 'OFF',
    }
  }

  const note = d[noteOff + i] ?? 0
  return {
    ...base,
    eventType: 'NOTE',
    note,
    noteName: noteToName(note),
    mode: d[OFF.mode + i] === 0x02 ? 'TGL' : 'MTY',
    pressure: parsePressure(d[OFF.pressure + i] ?? 0),
    bankM: 'OFF',
    bankL: 'OFF',
  }
}

function buildBank(d, noteOff, bankKey) {
  return Array.from({ length: 16 }, (_, i) => buildPad(d, i, noteOff, bankKey))
}

function parsePreset(d) {
  if (!d || d.length < 50) return null

  const num  = d[7]
  const name = d.slice(8, 16).filter(b => b > 31 && b < 127)
    .map(b => String.fromCharCode(b)).join('').trim() || `Preset ${num}`

  const banks = {
    A: buildBank(d, OFF.bankNote.A, 'A'),
    B: buildBank(d, OFF.bankNote.B, 'B'),
    C: buildBank(d, OFF.bankNote.C, 'C'),
    D: buildBank(d, OFF.bankNote.D, 'D'),
  }

  const knobs = Array.from({ length: 8 }, (_, i) => {
    const ch = (d[196 + i] ?? 0) + 1
    return {
      knob: i + 1,
      cc: d[180 + i] ?? 0,
      ch,
      channelLabel: channelLabel(ch),
      min: d[188 + i] ?? 0,
      max: d[204 + i] ?? 127,
    }
  })

  const faders = Array.from({ length: 6 }, (_, i) => {
    const ch = (d[228 + i] ?? 0) + 1
    return {
      fader: i + 1,
      cc: d[212 + i] ?? 0,
      ch,
      channelLabel: channelLabel(ch),
      min: d[220 + i] ?? 0,
      max: d[236 + i] ?? 127,
    }
  })

  return {
    number: num,
    name,
    banks,
    bankA: banks.A,
    bankB: banks.B,
    bankC: banks.C,
    bankD: banks.D,
    modes: banks.A.map(p => p.mode),
    channels: banks.A.map(p => p.channel),
    knobs,
    faders,
    _raw: [...d],
  }
}

function buildDumpRequest(num) {
  const p = Math.max(1, Math.min(30, num))
  return [0xF0, 0x47, 0x00, 0x68, 0x10, 0x03, 0x71, p, 0xF7]
}

function serializePreset(preset, orig) {
  const base = preset._raw ?? orig
  if (!base || base.length !== 505) {
    throw new Error('serializePreset: missing 505-byte raw buffer')
  }
  return serializeRawFromPreset(preset, base)
}

module.exports = { parsePreset, buildDumpRequest, serializePreset, noteToName, channelLabel }
