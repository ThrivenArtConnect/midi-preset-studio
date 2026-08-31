import { describe, it, expect } from 'vitest'
import {
  validatePreset,
  BANK_SELECT_CCS,
  CS1X_CONTROLLER_CCS,
  CS1X_CONTROLLER_NAMES,
  SAMPLER_NOTE_MIN,
  SAMPLER_NOTE_MAX,
} from '../src/shared/preset-validator.js'
import { buildPresetFromTemplate } from '../src/shared/preset-generator.js'
import sickfyn1 from '../src/shared/presets/sickfyn1.json'
import createSyntheticRawPreset from './fixtures/synthetic-raw-preset.js'

function makePad(pad, note, overrides = {}) {
  return {
    pad, note, noteName: `note${note}`, eventType: 'NOTE', mode: 'MTY', pressure: 'OFF',
    channel: 0, channelLabel: 'CC', bankM: 'OFF', bankL: 'OFF', ...overrides,
  }
}

// Kleine, in sich stimmige 2-Pad-pro-Bank-Fixture im echten App-Format
// (banks{A,B,C,D}, knobs[], faders[]) - validatePreset() setzt keine feste
// Pad-Anzahl voraus.
function basePreset(overrides = {}) {
  return {
    number: 99,
    name: 'TEST',
    banks: {
      A: [makePad(1, 36), makePad(2, 37)],
      B: [makePad(1, 52), makePad(2, 53)],
      C: [makePad(1, 68), makePad(2, 69)],
      D: [makePad(1, 84), makePad(2, 85)],
    },
    knobs: [
      { knob: 1, cc: 20, ch: 11, min: 0, max: 127 },
      { knob: 2, cc: 21, ch: 11, min: 0, max: 127 },
    ],
    faders: [
      { fader: 1, cc: 28, ch: 11, min: 0, max: 127 },
    ],
    ...overrides,
  }
}

describe('validatePreset - Bank Select (B1)', () => {
  it('warns for a knob on CC 0 (Bank Select MSB)', () => {
    const p = basePreset({ knobs: [{ knob: 1, cc: 0, ch: 11, min: 0, max: 127 }] })
    const warnings = validatePreset(p).filter(w => w.type === 'bank-select')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].controlIds).toEqual(['K1'])
    expect(warnings[0].cc).toBe(0)
    expect(warnings[0].message).toMatch(/MSB/)
  })

  it('warns for a fader on CC 32 (Bank Select LSB)', () => {
    const p = basePreset({ faders: [{ fader: 1, cc: 32, ch: 11, min: 0, max: 127 }] })
    const warnings = validatePreset(p).filter(w => w.type === 'bank-select')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].controlIds).toEqual(['F1'])
    expect(warnings[0].message).toMatch(/LSB/)
  })

  it('covers exactly CC 0 and CC 32', () => {
    expect(BANK_SELECT_CCS).toEqual([0, 32])
  })
})

describe('validatePreset - Doppelte Regler-CC (B2)', () => {
  it('warns when two knobs share a CC, referencing both control ids', () => {
    const p = basePreset({
      knobs: [
        { knob: 1, cc: 20, ch: 11, min: 0, max: 127 },
        { knob: 2, cc: 20, ch: 11, min: 0, max: 127 },
      ],
    })
    const warnings = validatePreset(p).filter(w => w.type === 'duplicate-cc')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].controlIds.sort()).toEqual(['K1', 'K2'])
    expect(warnings[0].cc).toBe(20)
  })

  it('warns across knobs and faders sharing a CC', () => {
    const p = basePreset({
      knobs: [{ knob: 1, cc: 25, ch: 11, min: 0, max: 127 }],
      faders: [{ fader: 1, cc: 25, ch: 11, min: 0, max: 127 }],
    })
    const warnings = validatePreset(p).filter(w => w.type === 'duplicate-cc')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].controlIds.sort()).toEqual(['F1', 'K1'])
  })

  it('does not warn when CCs are distinct', () => {
    const p = basePreset()
    expect(validatePreset(p).filter(w => w.type === 'duplicate-cc')).toHaveLength(0)
  })
})

describe('validatePreset - CS1x-Controller-Kollision (B3)', () => {
  it('names a known CS1x controller (CC 74 Brightness)', () => {
    const p = basePreset({ knobs: [{ knob: 1, cc: 74, ch: 11, min: 0, max: 127 }] })
    const warnings = validatePreset(p).filter(w => w.type === 'cs1x-collision')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toMatch(/Brightness/)
    expect(warnings[0].cc).toBe(74)
  })

  it('uses neutral wording for a collision CC without a confirmed name (CC 64)', () => {
    const p = basePreset({ faders: [{ fader: 1, cc: 64, ch: 11, min: 0, max: 127 }] })
    const warnings = validatePreset(p).filter(w => w.type === 'cs1x-collision')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toMatch(/reserviert/)
    expect(warnings[0].message).not.toMatch(/kollidiert mit Yamaha CS1x:/)
  })

  it('does not invent a name for every CC in the collision list', () => {
    const unnamed = CS1X_CONTROLLER_CCS.filter(cc => !(cc in CS1X_CONTROLLER_NAMES))
    expect(unnamed.length).toBeGreaterThan(0)
    expect(unnamed).toContain(5)
    expect(unnamed).toContain(64)
  })

  it('covers the exact confirmed CC list', () => {
    expect(CS1X_CONTROLLER_CCS).toEqual([
      1, 5, 7, 10, 11, 16, 64, 65, 66, 67, 71, 72, 73, 74, 84, 91, 93, 94, 96, 97,
    ])
  })
})

describe('validatePreset - Allgemeiner TGL-Hinweis (B4)', () => {
  it('warns for a TGL pad in Bank A (independent of the shared byte)', () => {
    const p = basePreset()
    p.banks.A[0].mode = 'TGL'
    const warnings = validatePreset(p).filter(w => w.type === 'tgl-mode')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].padRefs).toEqual([{ bank: 'A', padIndex: 0, note: 36 }])
    expect(warnings[0].message).toMatch(/Toggle/)
  })

  it('warns for a TGL pad outside the 9-16 collision range without a byte-collision warning', () => {
    const p = basePreset()
    p.banks.B[0].mode = 'TGL' // Pad 1, padIndex 0 - not in the 8-15 collision range
    const warnings = validatePreset(p)
    expect(warnings.filter(w => w.type === 'tgl-mode')).toHaveLength(1)
    expect(warnings.filter(w => w.type === 'byte-collision')).toHaveLength(0)
  })
})

describe('validatePreset - Kritische MPD24-Byte-Kollision (B5)', () => {
  it('warns when a Bank D pad 9-16 is TGL, mapping to the correct Bank A pad', () => {
    // Pad 13 = padIndex 12 -> Bank A Pad 5 (12 - 7 = 5), per preset-generator.js
    const p = basePreset({
      banks: {
        A: Array.from({ length: 16 }, (_, i) => makePad(i + 1, 36 + i)),
        B: Array.from({ length: 16 }, (_, i) => makePad(i + 1, 52 + i)),
        C: Array.from({ length: 16 }, (_, i) => makePad(i + 1, 68 + i)),
        D: Array.from({ length: 16 }, (_, i) => makePad(i + 1, 84 + i)),
      },
    })
    p.banks.D[12].mode = 'TGL' // Pad 13

    const warnings = validatePreset(p)
    const collision = warnings.filter(w => w.type === 'byte-collision')
    expect(collision).toHaveLength(1)
    expect(collision[0].message).toMatch(/Pad 13/)
    expect(collision[0].message).toMatch(/Bank D/)
    expect(collision[0].message).toMatch(/Bank A Pad 5/)
    expect(collision[0].padRefs).toContainEqual({ bank: 'A', padIndex: 4, note: 40 })

    // kommt zusaetzlich zum allgemeinen TGL-Hinweis, nicht statt ihm
    expect(warnings.filter(w => w.type === 'tgl-mode' && w.padRefs[0].bank === 'D')).toHaveLength(1)
  })

  it('names all affected banks when B, C and D collide on the same pad index', () => {
    const p = basePreset({
      banks: {
        A: Array.from({ length: 16 }, (_, i) => makePad(i + 1, 36 + i)),
        B: Array.from({ length: 16 }, (_, i) => makePad(i + 1, 52 + i)),
        C: Array.from({ length: 16 }, (_, i) => makePad(i + 1, 68 + i)),
        D: Array.from({ length: 16 }, (_, i) => makePad(i + 1, 84 + i)),
      },
    })
    p.banks.B[8].mode = 'TGL' // Pad 9 -> Bank A Pad 1
    p.banks.C[8].mode = 'TGL'
    p.banks.D[8].mode = 'TGL'

    const collision = validatePreset(p).filter(w => w.type === 'byte-collision')
    expect(collision).toHaveLength(1)
    expect(collision[0].message).toMatch(/Bank B\/C\/D/)
    expect(collision[0].message).toMatch(/Bank A Pad 1/)
  })
})

describe('validatePreset - Notenüberschneidungen (B6)', () => {
  it('warns when the same note appears in two different banks', () => {
    const p = basePreset()
    p.banks.A[0].note = 60
    p.banks.C[0].note = 60
    const warnings = validatePreset(p).filter(w => w.type === 'note-overlap')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].note).toBe(60)
    expect(warnings[0].message).toMatch(/Bank A Pad 1/)
    expect(warnings[0].message).toMatch(/Bank C Pad 1/)
    expect(warnings[0].padRefs).toHaveLength(2)
  })

  it('does not warn for a duplicate note within the same bank', () => {
    const p = basePreset()
    p.banks.A[0].note = 40
    p.banks.A[1].note = 40
    expect(validatePreset(p).filter(w => w.type === 'note-overlap')).toHaveLength(0)
  })
})

describe('validatePreset - Typische Sampler-Range (B7)', () => {
  it('warns (info) for a note below 12', () => {
    const p = basePreset()
    p.banks.A[0].note = 5
    const warnings = validatePreset(p).filter(w => w.type === 'note-range')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].severity).toBe('info')
    expect(warnings[0].note).toBe(5)
  })

  it('warns (info) for a note above 108', () => {
    const p = basePreset()
    p.banks.A[0].note = 120
    const warnings = validatePreset(p).filter(w => w.type === 'note-range')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].note).toBe(120)
  })

  it('does not warn inside the 12-108 range', () => {
    const p = basePreset()
    p.banks.A[0].note = SAMPLER_NOTE_MIN
    p.banks.A[1].note = SAMPLER_NOTE_MAX
    expect(validatePreset(p).filter(w => w.type === 'note-range')).toHaveLength(0)
  })
})

describe('validatePreset - SICKFYN1 clean state (C4)', () => {
  const baseRaw13 = createSyntheticRawPreset(13)
  const { preset } = buildPresetFromTemplate(sickfyn1, baseRaw13)
  const warnings = validatePreset(preset)

  it('produces zero warnings for the generated SICKFYN1 preset', () => {
    expect(warnings).toEqual([])
  })

  it('has no warnings of any known type individually (defensive, explicit per type)', () => {
    for (const type of ['bank-select', 'duplicate-cc', 'cs1x-collision', 'tgl-mode', 'byte-collision', 'note-overlap', 'note-range']) {
      expect(warnings.filter(w => w.type === type)).toHaveLength(0)
    }
  })
})

describe('validatePreset - Reinheit (A4)', () => {
  it('does not mutate the passed preset', () => {
    const p = basePreset({
      knobs: [{ knob: 1, cc: 0, ch: 11, min: 0, max: 127 }, { knob: 2, cc: 0, ch: 11, min: 0, max: 127 }],
    })
    p.banks.D[0].mode = 'TGL'
    p.banks.A[0].note = 5
    const before = JSON.stringify(p)
    validatePreset(p)
    expect(JSON.stringify(p)).toBe(before)
  })

  it('returns stable ids across repeated calls on the same input', () => {
    const p = basePreset({ knobs: [{ knob: 1, cc: 0, ch: 11, min: 0, max: 127 }] })
    const ids1 = validatePreset(p).map(w => w.id)
    const ids2 = validatePreset(p).map(w => w.id)
    expect(ids1).toEqual(ids2)
  })
})
