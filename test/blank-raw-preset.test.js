import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { createBlankRawPreset } from '../src/shared/blank-raw-preset.js'
import { buildPresetFromTemplate } from '../src/shared/preset-generator.js'
import { validatePreset } from '../src/shared/preset-validator.js'
import sickfyn1 from '../src/shared/presets/sickfyn1.json'

const require = createRequire(import.meta.url)
const { validateRaw } = require('../src/main/raw-patch.js')

describe('createBlankRawPreset', () => {
  it('produces a 505-byte buffer', () => {
    expect(createBlankRawPreset(13)).toHaveLength(505)
  })

  it('has the correct SysEx header and terminator', () => {
    const raw = createBlankRawPreset(13)
    expect(raw.slice(0, 8)).toEqual([0xF0, 0x47, 0x00, 0x68, 0x10, 0x03, 0x71, 13])
    expect(raw[504]).toBe(0xF7)
  })

  it('passes validateRaw()', () => {
    expect(validateRaw(createBlankRawPreset(13))).toBe(true)
  })

  it('rejects an out-of-range or non-integer slot number', () => {
    expect(() => createBlankRawPreset(0)).toThrow()
    expect(() => createBlankRawPreset(31)).toThrow()
    expect(() => createBlankRawPreset(1.5)).toThrow()
  })
})

describe('SICKFYN1 via createBlankRawPreset (no device dump, no presets-data.js)', () => {
  const { preset, raw } = buildPresetFromTemplate(sickfyn1, createBlankRawPreset(13))

  it('produces a valid 505-byte SysEx buffer', () => {
    expect(raw).toHaveLength(505)
    expect(validateRaw(raw)).toBe(true)
  })

  it('targets slot 13 with the correct name', () => {
    expect(preset.number).toBe(13)
    expect(preset.name).toBe('SICKFYN1')
  })

  it('produces zero validator warnings, same as with a real device dump', () => {
    expect(validatePreset(preset)).toEqual([])
  })
})
