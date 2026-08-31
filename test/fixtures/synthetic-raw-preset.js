// Field placement mirrors src/shared/raw-patch.js (OFF). Values are
// deterministic, ascending sequences chosen to be obviously synthetic - not
// derived from any real hardware capture.
const BANK_NOTE_OFFSET = { A: 52, B: 68, C: 84, D: 132 }
const BANK_NOTE_BASE = { A: 10, B: 30, C: 50, D: 70 }

const MODE_OFFSET = 100
const MODE_LEN = 16
const CHANNEL_OFFSET = 116
const CHANNEL_LEN = 16
const PRESSURE_OFFSET = 148
const PRESSURE_LEN = 16

const KNOB_CC_OFFSET = 180
const KNOB_MIN_OFFSET = 188
const KNOB_CH_OFFSET = 196
const KNOB_MAX_OFFSET = 204
const KNOB_COUNT = 8

const FADER_CC_OFFSET = 212
const FADER_MIN_OFFSET = 220
const FADER_CH_OFFSET = 228
const FADER_MAX_OFFSET = 236
const FADER_COUNT = 6

/**
 * Builds a structurally valid, entirely synthetic 505-byte MPD24 SysEx dump
 * for tests. Mode/channel/pressure bytes are set to values that survive a
 * parsePreset -> serializePreset roundtrip unchanged (see
 * src/main/sysex-protocol.js / src/shared/raw-patch.js).
 */
export default function createSyntheticRawPreset(slotNumber) {
  const slot = Number(slotNumber)
  if (!Number.isInteger(slot) || slot < 1 || slot > 30) {
    throw new Error(`createSyntheticRawPreset: slotNumber must be an integer 1-30, got ${slotNumber}`)
  }

  const d = new Array(505).fill(0)

  d[0] = 0xF0
  d[1] = 0x47
  d[2] = 0x00
  d[3] = 0x68
  d[4] = 0x10
  d[5] = 0x03
  d[6] = 0x71
  d[7] = slot

  const name = `SYN${String(slot).padStart(2, '0')}`.padEnd(8, ' ')
  for (let i = 0; i < 8; i++) d[8 + i] = name.charCodeAt(i) & 0x7F

  for (const bank of Object.keys(BANK_NOTE_OFFSET)) {
    const off = BANK_NOTE_OFFSET[bank]
    const base = BANK_NOTE_BASE[bank]
    for (let i = 0; i < 16; i++) d[off + i] = (base + i) % 128
  }

  for (let i = 0; i < MODE_LEN; i++) d[MODE_OFFSET + i] = 0x00
  for (let i = 0; i < CHANNEL_LEN; i++) d[CHANNEL_OFFSET + i] = 0x00
  for (let i = 0; i < PRESSURE_LEN; i++) d[PRESSURE_OFFSET + i] = 0x00

  for (let i = 0; i < KNOB_COUNT; i++) {
    d[KNOB_CC_OFFSET + i] = (20 + i) % 128
    d[KNOB_MIN_OFFSET + i] = 0
    d[KNOB_CH_OFFSET + i] = 0
    d[KNOB_MAX_OFFSET + i] = 127
  }

  for (let i = 0; i < FADER_COUNT; i++) {
    d[FADER_CC_OFFSET + i] = (40 + i) % 128
    d[FADER_MIN_OFFSET + i] = 0
    d[FADER_CH_OFFSET + i] = 0
    d[FADER_MAX_OFFSET + i] = 127
  }

  d[504] = 0xF7

  return d
}
