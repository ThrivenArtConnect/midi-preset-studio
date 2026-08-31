// MPD24 SysEx – aus Live MIDI Monitor Captures (23.05.2026)
// Antwort-Format: F0 47 00 68 10 03 71 [num] [8-byte-name] ... F7
// Preset-Nummern: 01–1E (1–30)

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

function noteToName(n) {
  if (n == null || n < 0 || n > 127) return '?'
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`
}

function parsePreset(d) {
  const num  = d[7]
  const name = d.slice(8, 16).filter(b => b > 31 && b < 127)
                .map(b => String.fromCharCode(b)).join('').trim() || `Preset ${num}`

  // Byte-Offsets aus Live-Captures bestätigt
  // BankA Pads: bytes 52–65 (14 pads sichtbar in Capture)
  const bankA = Array.from({length:16}, (_,i) => ({
    pad: i+1, note: d[52+i] ?? 0, noteName: noteToName(d[52+i])
  }))
  const bankB = Array.from({length:16}, (_,i) => ({
    pad: i+1, note: d[68+i] ?? 0, noteName: noteToName(d[68+i])
  }))

  // Modes bei Offset 100 (02=Toggle, 00=Momentary aus Captures)
  const modes = Array.from({length:16}, (_,i) => d[100+i] === 0x02 ? 'TGL' : 'MTY')

  // Channels: alle 02 in captures = CH3, stored as ch-1
  const channels = Array.from({length:16}, (_,i) => (d[116+i] ?? 0) + 1)

  // Knobs ab 180, Faders ab 244 (aus langen Presets)
  const knobs  = Array.from({length:8}, (_,i) => ({knob:i+1, cc:d[180+i]??0, ch:(d[196+i]??0)+1}))
  const faders = Array.from({length:6}, (_,i) => ({fader:i+1, cc:d[212+i]??0, ch:(d[228+i]??0)+1}))

  return { number: num, name, bankA, bankB, modes, channels, knobs, faders }
}

// Request: aus Live-Capture abgelesen – F0 47 00 68 10 03 71 [preset] F7
// preset = 0x01–0x1E (1–30)
function buildDumpRequest(num) {
  const p = Math.max(1, Math.min(30, num))
  return [0xF0, 0x47, 0x00, 0x68, 0x10, 0x03, 0x71, p, 0xF7]
}

function serializePreset(preset, orig) {
  const d = [...orig]
  if (preset.name) {
    const n = (preset.name + '        ').slice(0, 8)
    for (let i = 0; i < 8; i++) d[8+i] = n.charCodeAt(i)
  }
  preset.bankA?.forEach((p,i) => { d[52+i] = p.note })
  preset.modes?.forEach((m,i) => { d[100+i] = m==='TGL' ? 0x02 : 0x00 })
  preset.channels?.forEach((c,i) => { d[116+i] = c-1 })
  return d
}

module.exports = { parsePreset, buildDumpRequest, serializePreset, noteToName }
