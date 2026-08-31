import { describe, it, expect } from 'vitest'
import createSyntheticRawPreset from './synthetic-raw-preset.js'
import { validateRaw } from '../../src/shared/raw-patch.js'

describe('createSyntheticRawPreset', () => {
  it('produces a 505-byte buffer', () => {
    expect(createSyntheticRawPreset(1)).toHaveLength(505)
  })

  it('has the correct SysEx header and terminator', () => {
    const raw = createSyntheticRawPreset(1)
    expect(raw.slice(0, 8)).toEqual([0xF0, 0x47, 0x00, 0x68, 0x10, 0x03, 0x71, 1])
    expect(raw[504]).toBe(0xF7)
  })

  it('passes validateRaw()', () => {
    expect(validateRaw(createSyntheticRawPreset(1))).toBe(true)
    expect(validateRaw(createSyntheticRawPreset(13))).toBe(true)
    expect(validateRaw(createSyntheticRawPreset(30))).toBe(true)
  })

  it('encodes the requested slot number at byte 7', () => {
    expect(createSyntheticRawPreset(5)[7]).toBe(5)
    expect(createSyntheticRawPreset(13)[7]).toBe(13)
    expect(createSyntheticRawPreset(30)[7]).toBe(30)
  })

  it('rejects an out-of-range or non-integer slot number', () => {
    expect(() => createSyntheticRawPreset(0)).toThrow()
    expect(() => createSyntheticRawPreset(31)).toThrow()
    expect(() => createSyntheticRawPreset(1.5)).toThrow()
  })
})
