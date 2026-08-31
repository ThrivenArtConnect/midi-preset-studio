/**
 * Safety 0.2 - UI-Containment fuer vollstaendige MPD24-Preset-Writes.
 * Inhaltlich muss dies mit der main-process-seitigen Durchsetzung in
 * src/main/preset-write-gate.js uebereinstimmen (dort liegt die eigentliche
 * fail-closed Absicherung; diese Datei steuert nur die UI-Anzeige/-Sperre).
 *
 * PRESET_WRITE_LOCKED bleibt true, bis "Backup-vor-Senden" in einem eigenen,
 * separat freizugebenden Ticket implementiert, getestet und freigegeben ist.
 */
export const PRESET_WRITE_LOCKED = true

export const PRESET_WRITE_LOCK_NOTICE =
  'Hardware-Preset-Write ist derzeit gesperrt. Ein automatisches Backup des aktuellen MPD24-Gerätestands vor dem Senden ist noch nicht implementiert.'
