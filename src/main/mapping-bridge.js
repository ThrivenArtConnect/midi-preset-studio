const fs = require('fs')

const STEM_PAD_COUNT = 8

function parseStemSlot(raw) {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Bank A pads 0..7 are stem triggers (slots 1..8).
 * @param {{ banks: { A: Array<{ note: number, channel: number }> } }} parsed
 * @returns {Array<{ slot: number, note: number, channel: number }>}
 */
function bankAStems(parsed) {
  const pads = parsed?.banks?.A
  if (!pads || pads.length < STEM_PAD_COUNT) {
    throw new Error('parsed preset missing banks.A with at least 8 pads')
  }

  return pads.slice(0, STEM_PAD_COUNT).map((pad, i) => ({
    slot: i + 1,
    note: pad.note,
    channel: pad.channel,
  }))
}

/**
 * Cross-check NFC mapping tags against Bank A stem pads.
 * @param {ReturnType<typeof import('./sysex-protocol.js').parsePreset>} parsed
 * @param {Record<string, { note?: number, channel?: number, stem_slot?: string|number }>} mapping
 * @returns {{ errors: string[], warnings: string[] }}
 */
function validateAgainstMapping(parsed, mapping) {
  const errors = []
  const warnings = []
  const stems = bankAStems(parsed)
  const padNotes = stems.map(s => s.note)
  const padNoteList = padNotes.join(', ')
  const referencedSlots = new Set()

  for (const [tag, entry] of Object.entries(mapping ?? {})) {
    const slot = parseStemSlot(entry?.stem_slot)

    if (slot == null) {
      errors.push(`${tag}: stem_slot missing or invalid (got ${JSON.stringify(entry?.stem_slot)})`)
      continue
    }

    if (slot < 1 || slot > STEM_PAD_COUNT) {
      errors.push(`${tag}: stem_slot ${slot} not in 1..${STEM_PAD_COUNT}`)
      continue
    }

    referencedSlots.add(slot)

    const tagNote = entry.note
    if (tagNote == null || !padNotes.includes(tagNote)) {
      errors.push(
        `${tag}: note ${tagNote} not sent by any Bank A pad 1..${STEM_PAD_COUNT} (pads send: ${padNoteList})`
      )
    }

    const pad = stems[slot - 1]
    if (tagNote != null && pad.note !== tagNote) {
      errors.push(
        `${tag}: slot ${slot} note mismatch (mapping note ${tagNote}, pad note ${pad.note})`
      )
    }

    const tagChannel = entry.channel
    if (tagChannel != null && pad.channel !== tagChannel) {
      warnings.push(
        `${tag}: slot ${slot} channel mismatch (mapping channel ${tagChannel}, pad channel ${pad.channel})`
      )
    }
  }

  for (const stem of stems) {
    if (!referencedSlots.has(stem.slot)) {
      warnings.push(
        `orphan stem slot ${stem.slot}: no tag references this slot (pad note ${stem.note}, channel ${stem.channel})`
      )
    }
  }

  return { errors, warnings }
}

/**
 * @param {string} path
 * @returns {Record<string, unknown>}
 */
function loadMapping(path) {
  const text = fs.readFileSync(path, 'utf8')
  return JSON.parse(text)
}

module.exports = {
  bankAStems,
  validateAgainstMapping,
  loadMapping,
}
