/**
 * Safety 0.2 - zentraler Fail-Closed-Gate fuer vollstaendige MPD24-Preset-
 * Writes (505 Byte SysEx). Muss von sendRawPreset() als allererste Pruefung
 * aufgerufen werden, bevor output.sendMessage()/savePresetSyx() erreicht
 * werden - das sichert gleichzeitig midi:writePreset, writePresetParsed
 * (preset:importJSON) und jeden direkten window.midi.writePreset(raw)-Aufruf
 * ab, da alle denselben sendRawPreset()-Endpunkt durchlaufen.
 *
 * Zwei unabhaengige, in dieser Reihenfolge geprueften Regeln:
 *  1) FACTORY_SLOT_MAX (1-12): dauerhafter Schutz, bleibt auch nach einer
 *     spaeteren Backup-vor-Senden-Implementierung bestehen.
 *  2) Globaler Uebergangsblock: aktuell ALLE Slots (auch 13-30), solange
 *     kein Backup-vor-Senden-Gate existiert. Wird erst in einem separaten,
 *     ausdruecklich freizugebenden Ticket entfernt/ersetzt.
 */

const FACTORY_SLOT_MAX = 12

// Safety 0.2: bleibt true, bis "Backup-vor-Senden" in einem eigenen Ticket
// implementiert, getestet und ausdruecklich freigegeben ist.
const PRESET_WRITE_TRANSITIONAL_BLOCK = true

function evaluatePresetWrite(raw) {
  const slot = Array.isArray(raw) ? raw[7] : undefined

  if (typeof slot === 'number' && slot >= 1 && slot <= FACTORY_SLOT_MAX) {
    return {
      allowed: false,
      reason: 'factory-slot-protected',
      message: `Preset-Write gesperrt: Slot ${slot} ist ein geschützter Factory-Slot (1–${FACTORY_SLOT_MAX}).`,
    }
  }

  if (PRESET_WRITE_TRANSITIONAL_BLOCK) {
    return {
      allowed: false,
      reason: 'no-backup-before-send-gate',
      message: 'Preset-Write gesperrt: Backup-vor-Senden ist noch nicht implementiert.',
    }
  }

  return { allowed: true }
}

/**
 * Sperrantwort fuer preset:importJSON. Ein Import wuerde aktuell fuer jeden
 * Eintrag einen echten Hardware-Preset-Write ausloesen (writePresetParsed ->
 * sendRawPreset) - deshalb wird hier bewusst KEIN alternativer, nur-lokaler
 * Import implementiert, sondern der gesamte Vorgang vor jedem Datei-/
 * Dialogzugriff abgebrochen. Form entspricht dem bestehenden Rueckgabeformat
 * von preset:importJSON ({error, sent, total}), ergaenzt um maschinenlesbare
 * Felder.
 */
function describeImportBlock() {
  return {
    error: 'Import gesperrt: Ein Import würde derzeit einen Hardware-Preset-Write auslösen. Backup-vor-Senden ist noch nicht implementiert.',
    sent: 0,
    total: 0,
    blocked: true,
    reason: 'no-backup-before-send-gate',
  }
}

module.exports = {
  FACTORY_SLOT_MAX,
  evaluatePresetWrite,
  describeImportBlock,
}
