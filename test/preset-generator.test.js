import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import createSyntheticRawPreset from './fixtures/synthetic-raw-preset.js'
import { buildPresetFromTemplate } from '../src/shared/preset-generator.js'
import sickfyn1 from '../src/shared/presets/sickfyn1.json'

const require = createRequire(import.meta.url)
const { parsePreset } = require('../src/main/sysex-protocol.js')
const { validateRaw } = require('../src/main/raw-patch.js')

const baseRaw13 = createSyntheticRawPreset(13)

describe('buildPresetFromTemplate (SICKFYN1)', () => {
  const { preset, raw } = buildPresetFromTemplate(sickfyn1, baseRaw13)

  it('produces a valid 505-byte SysEx buffer', () => {
    expect(raw.length).toBe(505)
    expect(validateRaw(raw)).toBe(true)
  })

  it('targets slot 13 with the correct name', () => {
    expect(preset.number).toBe(13)
    expect(preset.name).toBe('SICKFYN1')
  })

  it('name never exceeds 8 characters even if the template did', () => {
    const { preset: p } = buildPresetFromTemplate({ ...sickfyn1, name: 'WAYTOOLONGNAME' }, baseRaw13)
    expect(p.name.length).toBeLessThanOrEqual(8)
  })

  describe('note blocks per bank (readback via parsePreset)', () => {
    const parsed = parsePreset(raw)

    it('Bank A: 36-51', () => {
      expect(parsed.banks.A.map(p => p.note)).toEqual(Array.from({ length: 16 }, (_, i) => 36 + i))
    })
    it('Bank B: 52-67', () => {
      expect(parsed.banks.B.map(p => p.note)).toEqual(Array.from({ length: 16 }, (_, i) => 52 + i))
    })
    it('Bank C: 68-83', () => {
      expect(parsed.banks.C.map(p => p.note)).toEqual(Array.from({ length: 16 }, (_, i) => 68 + i))
    })
    it('Bank D: 84-99', () => {
      expect(parsed.banks.D.map(p => p.note)).toEqual(Array.from({ length: 16 }, (_, i) => 84 + i))
    })
  })

  // Vorlage -> Generator -> Raw-Preset -> Parser: Play Mode ist fuer SICKFYN1
  // ausnahmslos MTY, insbesondere auch Pad 13-16 in Bank B/C/D. Eine TGL-Ausnahme
  // dort wuerde beim Serialisieren auf dieselben Rohbytes wie das Event-Type-Flag
  // von Bank A Pad 5-8 (Perc1, Perc2, Ride, Crash) treffen und sie ungewollt zu
  // TGL machen - siehe Kommentar in preset-generator.js. Deshalb keine Ausnahme.
  describe('Play Mode (Roundtrip: Vorlage -> Generator -> Raw -> Parser)', () => {
    const parsed = parsePreset(raw)

    it('all 64 pads across Bank A-D are MTY after the roundtrip', () => {
      for (const bank of ['A', 'B', 'C', 'D']) {
        expect(parsed.banks[bank].every(p => p.mode === 'MTY')).toBe(true)
      }
    })

    it('Bank A pad 5-8 (Perc1, Perc2, Ride, Crash) specifically stay MTY', () => {
      expect(parsed.banks.A.slice(4, 8).every(p => p.mode === 'MTY')).toBe(true)
    })
  })

  it('all pads use Pressure OFF in the generated preset object', () => {
    for (const bank of ['A', 'B', 'C', 'D']) {
      expect(preset.banks[bank].every(p => p.pressure === 'OFF')).toBe(true)
    }
  })

  it('all pads are Common Channel ("CC") in the generated preset object', () => {
    for (const bank of ['A', 'B', 'C', 'D']) {
      expect(preset.banks[bank].every(p => p.channel === 0 && p.channelLabel === 'CC')).toBe(true)
    }
  })

  it('pressure survives a raw round-trip via parsePreset', () => {
    const parsed = parsePreset(raw)
    for (const bank of ['A', 'B', 'C', 'D']) {
      expect(parsed.banks[bank].every(p => p.pressure === 'OFF')).toBe(true)
    }
  })

  // KNOWN LIMITATION (pre-existing, not introduced by the generator): channelToRaw()
  // in raw-patch.js maps both Common Channel (0) and real Channel 1 to the same raw
  // byte (0). No factory capture ever used Common Channel, so there's no evidence for
  // what raw value the real hardware expects - parsePreset() therefore always reads
  // raw byte 0 back as Channel 1, never as "CC", once the bytes are re-parsed (e.g.
  // after sending to the device and reading it back). The freshly generated preset
  // object itself still correctly shows "CC" (see test above) until that round-trip.
  it('after a raw round-trip, Common Channel pads read back as Channel 1 (known ambiguity)', () => {
    const parsed = parsePreset(raw)
    for (const bank of ['A', 'B', 'C', 'D']) {
      expect(parsed.banks[bank].every(p => p.channel === 1)).toBe(true)
    }
  })

  it('Knobs K1-K8 on CC 20-27, Channel 11, 0-127', () => {
    const parsed = parsePreset(raw)
    expect(parsed.knobs.map(k => k.cc)).toEqual([20, 21, 22, 23, 24, 25, 26, 27])
    expect(parsed.knobs.every(k => k.ch === 11)).toBe(true)
    expect(parsed.knobs.every(k => k.min === 0 && k.max === 127)).toBe(true)
  })

  it('Faders F1-F6 on CC 28,29,30,31,102,103, Channel 11, 0-127', () => {
    const parsed = parsePreset(raw)
    expect(parsed.faders.map(f => f.cc)).toEqual([28, 29, 30, 31, 102, 103])
    expect(parsed.faders.every(f => f.ch === 11)).toBe(true)
    expect(parsed.faders.every(f => f.min === 0 && f.max === 127)).toBe(true)
  })
})

describe('buildPresetFromTemplate guards', () => {
  it('rejects a base raw preset that is not 505 bytes', () => {
    expect(() => buildPresetFromTemplate(sickfyn1, [0xF0, 0xF7])).toThrow(/505 Byte/)
  })

  it('rejects a template missing a bank', () => {
    const broken = { ...sickfyn1, banks: { A: sickfyn1.banks.A } }
    expect(() => buildPresetFromTemplate(broken, baseRaw13)).toThrow(/Bank B fehlt/)
  })

  it('rejects inconsistent Play Mode across Bank B/C/D for the same pad', () => {
    const broken = structuredClone(sickfyn1)
    broken.banks.B.padOverrides = { 13: { mode: 'TGL' } }
    broken.banks.C.padOverrides = { 13: { mode: 'MTY' } }
    expect(() => buildPresetFromTemplate(broken, baseRaw13)).toThrow(/Play-Mode-Werte/)
  })
})
