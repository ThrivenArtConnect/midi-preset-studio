import { describe, it, expect } from 'vitest'
// Safety 0.2: extrahierte, JSX-freie Sperrlogik fuer den Renderer (App.jsx
// importiert dieselben Werte fuer disabled={...} an btn-send/btn-send-all/
// "Preset importieren" und fuer den sichtbaren deutschen Hinweistext). Diese
// Datei existiert vor dem Fix noch nicht - der Import schlaegt dann mit
// "Cannot find module" fehl, was den ungeschuetzten UI-Ausgangszustand belegt.
import { PRESET_WRITE_LOCKED, PRESET_WRITE_LOCK_NOTICE } from '../src/renderer/preset-write-lock.js'

describe('preset-write-lock (Renderer-UI-Containment, Safety 0.2)', () => {
  it('PRESET_WRITE_LOCKED is true (Einzel-Send/Bulk-Send/Import bleiben deaktiviert)', () => {
    expect(PRESET_WRITE_LOCKED).toBe(true)
  })

  it('PRESET_WRITE_LOCK_NOTICE is a non-empty German notice mentioning the missing backup-before-send gate', () => {
    expect(typeof PRESET_WRITE_LOCK_NOTICE).toBe('string')
    expect(PRESET_WRITE_LOCK_NOTICE.length).toBeGreaterThan(0)
    expect(PRESET_WRITE_LOCK_NOTICE).toMatch(/gesperrt/i)
    expect(PRESET_WRITE_LOCK_NOTICE).toMatch(/Backup/i)
  })

  it('PRESET_WRITE_LOCK_NOTICE never falsely claims a device backup was already made or checked', () => {
    expect(PRESET_WRITE_LOCK_NOTICE).not.toMatch(/Backup (wurde|ist) (erstellt|erfolgt|geprüft|durchgeführt)/i)
    expect(PRESET_WRITE_LOCK_NOTICE).toMatch(/noch nicht implementiert/)
  })
})
