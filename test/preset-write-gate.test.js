import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// Safety 0.2: zentraler Fail-Closed-Gate, den sendRawPreset/writePresetParsed/
// preset:importJSON im Main-Prozess vor jedem vollstaendigen Preset-Send
// aufrufen muessen (siehe src/main/index.js). Modul existiert vor dem Fix
// noch nicht - dieser Import schlaegt dann mit "Cannot find module" fehl,
// was den ungeschuetzten Ausgangszustand belegt (kein Gate vorhanden).
const { evaluatePresetWrite, describeImportBlock, FACTORY_SLOT_MAX } =
  require('../src/main/preset-write-gate.js')

// Strukturell valider 505-Byte-Puffer, nur Slot-Byte (Offset 7, siehe
// src/main/sysex-protocol.js parsePreset/savePresetSyx) gesetzt. Keine
// erfundenen MIDI-Werte - alle anderen Bytes bleiben 0 und sind fuer die
// Gate-Entscheidung irrelevant (das Gate liest ausschliesslich raw[7]).
function fakeRawForSlot(slot) {
  const raw = new Array(505).fill(0)
  raw[7] = slot
  return raw
}

describe('preset-write-gate: FACTORY_SLOT_MAX', () => {
  it('is exactly 12, matching the documented factory range (Slots 1-12)', () => {
    expect(FACTORY_SLOT_MAX).toBe(12)
  })
})

describe('preset-write-gate: permanenter Factory-Slot-Guard (Slots 1-12)', () => {
  for (const slot of [1, 12]) {
    it(`rejects Slot ${slot} with reason "factory-slot-protected"`, () => {
      const result = evaluatePresetWrite(fakeRawForSlot(slot))
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('factory-slot-protected')
      expect(result.message).toMatch(new RegExp(`\\b${slot}\\b`))
      expect(result.message).toMatch(/Factory/i)
    })
  }
})

describe('preset-write-gate: globaler Uebergangsblock (alle Slots, solange kein Backup-vor-Senden existiert)', () => {
  it('rejects a structurally valid Slot-13 (SICKFYN1) write attempt', () => {
    const result = evaluatePresetWrite(fakeRawForSlot(13))
    expect(result.allowed).toBe(false)
    expect(result.reason).not.toBe('factory-slot-protected')
    expect(result.message).toMatch(/Backup-vor-Senden/)
  })

  it('rejects every non-factory slot 13-30', () => {
    for (let slot = 13; slot <= 30; slot++) {
      const result = evaluatePresetWrite(fakeRawForSlot(slot))
      expect(result.allowed).toBe(false)
    }
  })

  it('also rejects factory slots via the factory reason, not the transitional one (guard runs first)', () => {
    for (let slot = 1; slot <= 12; slot++) {
      const result = evaluatePresetWrite(fakeRawForSlot(slot))
      expect(result.reason).toBe('factory-slot-protected')
    }
  })
})

describe('preset-write-gate: describeImportBlock() (fuer preset:importJSON)', () => {
  it('returns a machine-readable, non-misleading lock result before any file/dialog access', () => {
    const result = describeImportBlock()
    expect(result.blocked).toBe(true)
    expect(typeof result.error).toBe('string')
    expect(result.error.length).toBeGreaterThan(0)
    expect(result.sent).toBe(0)
    expect(result.total).toBe(0)
  })
})
