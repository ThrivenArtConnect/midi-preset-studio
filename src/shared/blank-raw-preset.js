/**
 * Builds a minimal, blank 505-byte MPD24 SysEx frame - only header, slot
 * number and terminator are set. Used as a synthetic base for
 * buildPresetFromTemplate() when no real hardware dump for that slot is
 * known yet (rawMap empty): buildPresetFromTemplate() only reads the base
 * for header bytes/slot number/unused padding, every pad/knob/fader value
 * is supplied entirely by the template (see preset-generator.js).
 */
export function createBlankRawPreset(slotNumber) {
  const slot = Number(slotNumber)
  if (!Number.isInteger(slot) || slot < 1 || slot > 30) {
    throw new Error(`createBlankRawPreset: slotNumber must be an integer 1-30, got ${slotNumber}`)
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
  d[504] = 0xF7

  return d
}
