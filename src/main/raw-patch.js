/** CJS mirror of src/shared/raw-patch.js — keep in sync */
/**
 * SysEx byte offsets – must match src/main/sysex-protocol.js
 *
 * Non-overlapping layout (30 factory captures, 2026-05-23):
 * - eventTypeA pads 1-8: 108..115
 * - ch pads 1-8: 116..123 (alias: same bytes as eventType pads 9-16 in captures)
 * - ch pads 9-16: 124..131
 * - bank A note/PROG program: 52..67 (dual-use)
 * - bank D notes: 132..147 (NOT program — bytes 140..147 are bank D pads 9-16)
 */
const OFF = {
  name: 8,
  eventTypeA: 108,
  bankMA: 156,
  bankLA: 172,
  mode: 100,
  ch: 116,
  pressure: 148,
  bankNote: { A: 52, B: 68, C: 84, D: 132 },
  knobCc: 180,
  knobMin: 188,
  knobCh: 196,
  knobMax: 204,
  faderCc: 212,
  faderMin: 220,
  faderCh: 228,
  faderMax: 236,
}

function pressureByte(p) {
  if (p === 'CPR') return 1
  if (p === 'PPR') return 2
  return 0
}

function bankToRaw(v) {
  if (v === 'OFF' || v == null) return 127
  return v & 0x7F
}

function channelToRaw(ch) {
  if (ch === 0) return 0
  return Math.max(0, Math.min(127, (ch | 0) - 1))
}

function eventTypeByteA({ eventType, mode }) {
  if (eventType === 'PROG') return 0x03
  return mode === 'TGL' ? 0x02 : 0x00
}

function finalizeBankAChannels(d, bankA) {
  if (!bankA) return d
  const out = [...d]
  for (let j = 0; j < 8; j++) {
    const pad = bankA[j]
    if (pad?.channel != null) {
      out[OFF.ch + j] = channelToRaw(pad.channel)
    }
  }
  for (let i = 8; i < 16; i++) {
    const pad = bankA[i]
    if (pad?.channel != null) out[OFF.ch + i] = channelToRaw(pad.channel)
  }
  return out
}

function validateRaw(raw) {
  if (!raw || raw.length !== 505) return false
  if (raw[0] !== 0xF0) return false
  if (raw[1] !== 0x47) return false
  if (raw[raw.length - 1] !== 0xF7) return false
  return true
}

function patchNameInRaw(raw, name) {
  const padded = (name ?? '').slice(0, 8).padEnd(8, ' ')
  const d = [...raw]
  for (let i = 0; i < 8; i++) d[OFF.name + i] = padded.charCodeAt(i) & 0x7F
  return d
}

function patchPadInRaw(raw, bank, padIdx, patch) {
  const d = [...raw]
  const { note, channel, mode, pressure, eventType, program, bankM, bankL } = patch
  const noteOff = OFF.bankNote[bank]

  if (bank !== 'A' && channel != null) d[OFF.ch + padIdx] = channelToRaw(channel)

  if (bank === 'A') {
    const et = eventType ?? (d[OFF.eventTypeA + padIdx] === 0x03 ? 'PROG' : 'NOTE')

    if (padIdx < 8) {
      d[OFF.eventTypeA + padIdx] = eventTypeByteA({ eventType: et, mode: mode ?? 'MTY' })
    }

    if (et === 'PROG') {
      const prog = (program ?? note) & 0x7F
      if (prog != null) d[OFF.bankNote.A + padIdx] = prog
      if (bankM != null) d[OFF.bankMA + padIdx] = bankToRaw(bankM)
      if (bankL != null) d[OFF.bankLA + padIdx] = bankToRaw(bankL)
    } else if (noteOff != null && note != null) {
      d[noteOff + padIdx] = note & 0x7F
    }
    return d
  }

  if (noteOff != null && note != null) d[noteOff + padIdx] = note & 0x7F
  if (mode != null) d[OFF.mode + padIdx] = mode === 'TGL' ? 0x02 : 0x00
  if (pressure != null) d[OFF.pressure + padIdx] = pressureByte(pressure)
  return d
}

function patchKnobInRaw(raw, idx, { cc, ch, min, max }) {
  const d = [...raw]
  if (cc != null) d[OFF.knobCc + idx] = cc & 0x7F
  if (min != null) d[OFF.knobMin + idx] = min & 0x7F
  if (ch != null) d[OFF.knobCh + idx] = channelToRaw(ch)
  if (max != null) d[OFF.knobMax + idx] = max & 0x7F
  return d
}

function patchFaderInRaw(raw, idx, { cc, ch, min, max }) {
  const d = [...raw]
  if (cc != null) d[OFF.faderCc + idx] = cc & 0x7F
  if (min != null) d[OFF.faderMin + idx] = min & 0x7F
  if (ch != null) d[OFF.faderCh + idx] = channelToRaw(ch)
  if (max != null) d[OFF.faderMax + idx] = max & 0x7F
  return d
}

function serializeRawFromPreset(preset, orig) {
  let d = [...orig]

  if (preset.name != null && preset.name.trim() !== nameFromRaw(orig)) {
    d = patchNameInRaw(d, preset.name)
  }

  const banks = preset.banks || {
    A: preset.bankA,
    B: preset.bankB,
    C: preset.bankC,
    D: preset.bankD,
  }

  for (let i = 0; i < 16; i++) {
    const pad = banks.A?.[i]
    if (!pad) continue
    d = patchPadInRaw(d, 'A', i, {
      note: pad.note,
      channel: pad.channel,
      mode: pad.mode,
      pressure: pad.pressure,
      eventType: pad.eventType,
      program: pad.program,
      bankM: pad.bankM,
      bankL: pad.bankL,
    })
  }

  d = finalizeBankAChannels(d, banks.A)

  for (const bank of ['B', 'C', 'D']) {
    for (let i = 0; i < 16; i++) {
      const pad = banks[bank]?.[i]
      if (!pad || pad.note == null) continue
      d = patchPadInRaw(d, bank, i, { note: pad.note })
    }
  }

  preset.knobs?.forEach((k, i) => {
    d = patchKnobInRaw(d, i, { cc: k.cc, ch: k.ch, min: k.min, max: k.max })
  })

  preset.faders?.forEach((f, i) => {
    d = patchFaderInRaw(d, i, { cc: f.cc, ch: f.ch, min: f.min, max: f.max })
  })

  return d
}

function nameFromRaw(raw) {
  if (!raw?.length) return ''
  return raw.slice(OFF.name, OFF.name + 8)
    .map(b => (b >= 32 && b < 127 ? String.fromCharCode(b) : ' '))
    .join('')
    .trim()
}

module.exports = {
  OFF,
  validateRaw,
  patchNameInRaw,
  patchPadInRaw,
  patchKnobInRaw,
  patchFaderInRaw,
  serializeRawFromPreset,
  nameFromRaw,
}
