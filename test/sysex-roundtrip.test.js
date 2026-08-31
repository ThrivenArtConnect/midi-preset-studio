import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import createSyntheticRawPreset from './fixtures/synthetic-raw-preset.js'

const require = createRequire(import.meta.url)
const { parsePreset, serializePreset } = require('../src/main/sysex-protocol.js')

describe('SysEx round-trip (505 bytes)', () => {
  const presets = [
    { number: 1, raw: createSyntheticRawPreset(1) },
  ]

  it('provides 1 synthetic raw preset', () => {
    expect(presets).toHaveLength(1)
  })

  for (const { number, raw } of presets) {
    const label = `${String(number).padStart(2, '0')} synthetic`

    it(`${label}: parse → serialize === original`, () => {
      const original = [...raw]
      expect(original).toHaveLength(505)

      const parsed = parsePreset(original)
      expect(parsed).not.toBeNull()
      expect(parsed._raw).toEqual(original)

      const roundtrip = serializePreset(parsed, original)
      expect(roundtrip).toHaveLength(505)
      expect(roundtrip).toEqual(original)
    })
  }
})
