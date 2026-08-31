import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import createSyntheticRawPreset from './fixtures/synthetic-raw-preset.js'

const require = createRequire(import.meta.url)
const { parsePreset } = require('../src/main/sysex-protocol.js')
const { bankAStems, validateAgainstMapping } = require('../src/main/mapping-bridge.js')

const parsed = parsePreset(createSyntheticRawPreset(1))

describe('mapping-bridge', () => {
  it('bankAStems returns slots 1..8 from Bank A pads 0..7', () => {
    const stems = bankAStems(parsed)
    expect(stems).toHaveLength(8)
    expect(stems[0]).toEqual({
      slot: 1,
      note: parsed.banks.A[0].note,
      channel: parsed.banks.A[0].channel,
    })
    expect(stems[7].slot).toBe(8)
  })

  it('validateAgainstMapping passes for inline mapping built from stems', () => {
    const stems = bankAStems(parsed)
    const mapping = Object.fromEntries(
      stems.map(s => [
        `TAG_STEM_${String(s.slot).padStart(2, '0')}`,
        { note: s.note, channel: s.channel, stem_slot: s.slot },
      ])
    )

    const { errors, warnings } = validateAgainstMapping(parsed, mapping)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('validateAgainstMapping reports note-not-sent and slot/note mismatch errors', () => {
    const stems = bankAStems(parsed)
    const ghostNote = 127
    while (stems.some(s => s.note === ghostNote)) ghostNote--
    const mismatchSlot = 2
    const mismatchPad = stems[mismatchSlot - 1]

    const mapping = {
      TAG_GHOST: { note: ghostNote, channel: 1, stem_slot: 1 },
      TAG_MISMATCH: {
        note: mismatchPad.note + 1,
        channel: mismatchPad.channel,
        stem_slot: mismatchSlot,
      },
    }

    const { errors } = validateAgainstMapping(parsed, mapping)

    expect(errors.some(e =>
      e.startsWith('TAG_GHOST:') &&
      e.includes(`note ${ghostNote} not sent by any Bank A pad`)
    )).toBe(true)

    expect(errors.some(e =>
      e.startsWith('TAG_MISMATCH:') &&
      e.includes(`slot ${mismatchSlot} note mismatch`) &&
      e.includes(`mapping note ${mismatchPad.note + 1}`) &&
      e.includes(`pad note ${mismatchPad.note}`)
    )).toBe(true)
  })
})
