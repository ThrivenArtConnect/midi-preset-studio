const BANKS = ['A', 'B', 'C', 'D']

export const BANK_SELECT_CCS = [0, 32]

export const CS1X_CONTROLLER_CCS = [
  1, 5, 7, 10, 11, 16, 64, 65, 66, 67, 71, 72, 73, 74, 84, 91, 93, 94, 96, 97,
]

// Nur Namen, die in der Aufgabenstellung ausdrücklich bestätigt sind. Fürs
// übrige CS1x-CCs in CS1X_CONTROLLER_CCS wird bewusst kein Name erfunden.
export const CS1X_CONTROLLER_NAMES = {
  1: 'Modulation',
  7: 'Main Volume',
  10: 'Panpot',
  11: 'Expression',
  16: 'Foot Controller',
  71: 'Harmonic Content',
  72: 'Release Time',
  73: 'Attack Time',
  74: 'Brightness',
  91: 'Reverb',
  93: 'Chorus',
  94: 'Variation Depth',
}

export const SAMPLER_NOTE_MIN = 12
export const SAMPLER_NOTE_MAX = 108

function getBanks(preset) {
  return preset.banks || { A: preset.bankA, B: preset.bankB, C: preset.bankC, D: preset.bankD }
}

function padsOf(banks, bank) {
  return banks[bank] || []
}

function controlList(preset) {
  const knobs = (preset.knobs || []).map((k, i) => ({
    kind: 'knob', id: `K${k.knob ?? i + 1}`, label: `Knob K${k.knob ?? i + 1}`, cc: k.cc,
  }))
  const faders = (preset.faders || []).map((f, i) => ({
    kind: 'fader', id: `F${f.fader ?? i + 1}`, label: `Fader F${f.fader ?? i + 1}`, cc: f.cc,
  }))
  return [...knobs, ...faders]
}

function validateBankSelect(controls) {
  const warnings = []
  for (const c of controls) {
    if (BANK_SELECT_CCS.includes(c.cc)) {
      const part = c.cc === 0 ? 'MSB' : 'LSB'
      warnings.push({
        id: `bank-select:${c.id}:${c.cc}`,
        type: 'bank-select',
        severity: 'warning',
        message: `${c.label} (CC ${c.cc}): Bank Select ${part}, kein freier Regler.`,
        controlIds: [c.id],
        cc: c.cc,
      })
    }
  }
  return warnings
}

function validateDuplicateCc(controls) {
  const byCc = new Map()
  for (const c of controls) {
    if (!byCc.has(c.cc)) byCc.set(c.cc, [])
    byCc.get(c.cc).push(c)
  }
  const warnings = []
  for (const [cc, group] of byCc) {
    if (group.length > 1) {
      warnings.push({
        id: `duplicate-cc:${cc}`,
        type: 'duplicate-cc',
        severity: 'warning',
        message: `Mehrere Regler mit CC ${cc}: steuern alle dasselbe Ziel (${group.map(g => g.label).join(', ')}).`,
        controlIds: group.map(g => g.id),
        cc,
      })
    }
  }
  return warnings
}

function validateCs1xCollision(controls) {
  const warnings = []
  for (const c of controls) {
    if (CS1X_CONTROLLER_CCS.includes(c.cc)) {
      const name = CS1X_CONTROLLER_NAMES[c.cc]
      const message = name
        ? `${c.label} (CC ${c.cc}) kollidiert mit Yamaha CS1x: ${name}.`
        : `${c.label}: CC ${c.cc} ist für den Yamaha CS1x reserviert.`
      warnings.push({
        id: `cs1x-collision:${c.id}:${c.cc}`,
        type: 'cs1x-collision',
        severity: 'warning',
        message,
        controlIds: [c.id],
        cc: c.cc,
      })
    }
  }
  return warnings
}

/**
 * Play Mode fuer Pad-Index 8-15 (Pad 9-16) in Bank B/C/D liegt auf denselben
 * Rohbytes wie das Event-Type-Flag von Bank A Pad 1-8 - bestaetigt per
 * Roundtrip-Test in test/preset-generator.test.js und dokumentiert in
 * src/shared/preset-generator.js. Zuordnung: B/C/D Pad-Index i (8-15) ->
 * Bank A Pad (i-7), d.h. Pad 9->A1 ... Pad16->A8.
 */
function validateTglAndByteCollision(banks) {
  const warnings = []

  for (const bank of BANKS) {
    padsOf(banks, bank).forEach((pad, i) => {
      if (!pad || pad.eventType === 'PROG') return
      if (pad.mode !== 'TGL') return
      const padNum = pad.pad ?? i + 1
      warnings.push({
        id: `tgl-mode:${bank}:${padNum}`,
        type: 'tgl-mode',
        severity: 'warning',
        message: `Bank ${bank} Pad ${padNum}: Toggle - Note bleibt an, für Drums MTY wählen.`,
        padRefs: [{ bank, padIndex: i, note: pad.note }],
      })
    })
  }

  for (let i = 8; i < 16; i++) {
    const padNum = i + 1
    const aPadNum = i - 7
    const affectedBanks = ['B', 'C', 'D'].filter(bank => padsOf(banks, bank)[i]?.mode === 'TGL')
    if (!affectedBanks.length) continue

    const aPad = padsOf(banks, 'A')[aPadNum - 1]
    warnings.push({
      id: `byte-collision:${padNum}`,
      type: 'byte-collision',
      severity: 'warning',
      message: `Hardware-Byte-Kollision: TGL für Pad ${padNum} in Bank ${affectedBanks.join('/')} beeinflusst Bank A Pad ${aPadNum}. Für das SICKFYN1-Drumkit alle betroffenen Pads auf MTY lassen.`,
      padRefs: [
        ...affectedBanks.map(bank => ({ bank, padIndex: i, note: padsOf(banks, bank)[i]?.note })),
        { bank: 'A', padIndex: aPadNum - 1, note: aPad?.note },
      ],
    })
  }

  return warnings
}

function validateNotes(banks) {
  const warnings = []
  const noteMap = new Map()

  for (const bank of BANKS) {
    padsOf(banks, bank).forEach((pad, i) => {
      if (!pad || pad.eventType === 'PROG' || pad.note == null) return
      const padNum = pad.pad ?? i + 1

      if (pad.note < SAMPLER_NOTE_MIN || pad.note > SAMPLER_NOTE_MAX) {
        warnings.push({
          id: `note-range:${bank}:${padNum}`,
          type: 'note-range',
          severity: 'info',
          message: `Bank ${bank} Pad ${padNum}: Note ${pad.note} liegt außerhalb der typischen Sampler-Range 12–108.`,
          padRefs: [{ bank, padIndex: i, note: pad.note }],
          note: pad.note,
        })
      }

      if (!noteMap.has(pad.note)) noteMap.set(pad.note, [])
      noteMap.get(pad.note).push({ bank, padIndex: i, padNum, note: pad.note })
    })
  }

  for (const [note, refs] of noteMap) {
    const banksInvolved = new Set(refs.map(r => r.bank))
    if (banksInvolved.size <= 1) continue
    const label = refs.map(r => `Bank ${r.bank} Pad ${r.padNum}`).join(' und ')
    warnings.push({
      id: `note-overlap:${note}`,
      type: 'note-overlap',
      severity: 'warning',
      message: `Notenüberschneidung: Note ${note} wird in ${label} verwendet.`,
      padRefs: refs.map(r => ({ bank: r.bank, padIndex: r.padIndex, note: r.note })),
      note,
    })
  }

  return warnings
}

/**
 * Prüft ein Preset (Form wie editPreset/normalizePreset in App.jsx: banks{A,B,C,D}
 * mit Pad-Objekten, knobs[], faders[]) auf bekannte, nicht blockierende
 * Auffälligkeiten. Liest preset nur, mutiert es nie. IDs sind rein aus dem
 * jeweils betroffenen Feld (Bank/Pad, Control, CC, Note) abgeleitet, damit
 * dieselbe Auffälligkeit bei erneuter Validierung dieselbe id ergibt.
 * @param {object} preset
 * @returns {Array<object>} Warnungsobjekte, siehe preset-validator.test.js
 */
export function validatePreset(preset) {
  if (!preset) return []
  const banks = getBanks(preset)
  const controls = controlList(preset)

  return [
    ...validateBankSelect(controls),
    ...validateDuplicateCc(controls),
    ...validateCs1xCollision(controls),
    ...validateTglAndByteCollision(banks),
    ...validateNotes(banks),
  ]
}
