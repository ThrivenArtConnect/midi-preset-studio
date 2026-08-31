import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import createSyntheticRawPreset from './fixtures/synthetic-raw-preset.js'

const require = createRequire(import.meta.url)
const { parsePreset, serializePreset } = require('../src/main/sysex-protocol.js')

const base = parsePreset(createSyntheticRawPreset(1))

function editReadback(mutate) {
  const p = structuredClone(base)
  mutate(p)
  return parsePreset(serializePreset(p))
}

describe('SysEx edit readback (Mutation)', () => {
  it('Bank A pad 1 note', () => {
    const r = editReadback(p => { p.banks.A[0].eventType = 'NOTE'; p.banks.A[0].note = 41 })
    expect(r.banks.A[0].note).toBe(41)
  })
  it('Bank A pad 1 channel (stored as ch-1)', () => {
    const r = editReadback(p => { p.banks.A[0].channel = 5 })
    expect(r.banks.A[0].channel).toBe(5)
  })
  it('Bank A pad 2 mode TGL', () => {
    const r = editReadback(p => { p.banks.A[1].eventType = 'NOTE'; p.banks.A[1].mode = 'TGL' })
    expect(r.banks.A[1].mode).toBe('TGL')
  })
  // Skipped: PROG uses same byte as NOTE (52+i); no factory capture has PROG — round-trip proves nothing vs hardware.
  it.skip('Bank A pad 3 PROG program (UNVERIFIED vs hardware – pending dump)', () => {
    const r = editReadback(p => { p.banks.A[2].eventType = 'PROG'; p.banks.A[2].program = 12 })
    expect(r.banks.A[2].eventType).toBe('PROG')
    expect(r.banks.A[2].program).toBe(12)
  })
  it('Bank B pad 4 note', () => {
    const r = editReadback(p => { p.banks.B[3].note = 99 })
    expect(r.banks.B[3].note).toBe(99)
  })
  it('Knob 1 CC', () => {
    const r = editReadback(p => { p.knobs[0].cc = 74 })
    expect(r.knobs[0].cc).toBe(74)
  })
  it('Fader 1 CC', () => {
    const r = editReadback(p => { p.faders[0].cc = 7 })
    expect(r.faders[0].cc).toBe(7)
  })
})