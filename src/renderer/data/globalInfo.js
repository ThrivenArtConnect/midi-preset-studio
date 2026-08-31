export const GLOBAL_INFO_CARDS = [
  {
    id: 'common-channel',
    title: 'MIDI Common Channel',
    body: 'Der Common Channel (CC) ist ein globaler MIDI-Kanal, der in GLOBAL MODE am MPD24 festgelegt wird. Pads, Knobs und Fader mit Kanal „CC“ nutzen diesen gemeinsamen Kanal – praktisch, wenn alle Elemente an dieselbe Spur in der DAW gehen sollen.',
    diagram: 'GLOBAL MODE → Common Channel = 3\n→ Pad/Knob/Fader mit „CC“ → alles auf Kanal 3',
    tip: 'Common Channel gilt für alle Elemente mit Kanal-Einstellung „CC“. In der DAW eine Spur auf diesen Kanal filtern.',
  },
  {
    id: 'pad-sensitivity',
    title: 'Pad-Sensitivity (Empfindlichkeit)',
    body: 'Die Pad-Empfindlichkeit wird am Gerät unter GLOBAL MODE eingestellt. Niedrige Werte erfordern härteres Anschlagen, hohe Werte reagieren schon auf leichte Berührungen. Sie beeinflusst die Velocity, nicht die zugewiesene Note oder den Kanal.',
    diagram: 'Niedrig ●───────○ Hoch\nLeicht = sanfter, Hart = lauter',
    tip: 'Bei Finger-Drumming: mittlere bis hohe Empfindlichkeit. Bei bewusstem Akzent-Spiel: niedriger.',
  },
  {
    id: 'velocity-curves',
    title: 'Velocity-Kurven A–D',
    body: 'Die Velocity-Kurve bestimmt, wie Anschlagstärke in MIDI-Velocity (1–127) übersetzt wird. Am MPD24 in GLOBAL MODE wählbar.',
    diagram: 'A: Linear – 1:1\nB: Soft – leise Anschläge verstärkt\nC: Hard – laute Anschläge betont\nD: S-Kurve – Mitte hervorgehoben',
    tip: 'Kurve B für leises Spiel / Sampling. Kurve C für Punch in Drum-Machines.',
  },
  {
    id: 'kill-midi',
    title: 'Kill MIDI (All Notes Off)',
    body: '„Kill MIDI“ sendet All Notes Off und Reset Controllers – nützlich wenn hängende Noten oder offene Hüllkurven in der DAW auftreten. Am MPD24 über GLOBAL MODE erreichbar.',
    diagram: 'Kill MIDI → CC123 (All Notes Off)\n         → CC121 (Reset Controllers)',
    tip: 'Bei hängenden Sounds zuerst Kill MIDI, dann Preset erneut testen.',
  },
  {
    id: 'sysex-tx',
    title: 'SysEx Tx (Preset-Dump vom Gerät)',
    body: 'Im GLOBAL MODE: mit [>] zu „SysEx Tx“ blättern, mit dem VALUE-Dial (Push-to-Enter) das Preset wählen und ENTER drücken. Der MPD24 sendet dann einen 505-Byte-SysEx-Dump. Die App empfängt dies automatisch.',
    diagram: 'GLOBAL → SysEx Tx → VALUE wählen → ENTER\n→ 505 Bytes SysEx → App',
    tip: '„↓ Vom Gerät laden“ sendet einen Preset-Request (ACK). Den vollen Dump löst ENTER in SysEx Tx aus.',
  },
  {
    id: 'full-16-levels',
    title: 'FULL LEVEL & 16 LEVELS',
    body: 'FULL LEVEL: Jedes Pad sendet die volle Velocity (127). 16 LEVELS: Velocity wird über die Pad-Position in der 4×4-Matrix gesteuert – oben leise, unten laut (Akai-Standard-Layout).',
    diagram: 'FULL LEVEL: alle Pads → Vel 127\n16 LEVELS: Zeile 1 → niedrig … Zeile 4 → hoch',
    tip: '16 LEVELS eignet sich für expressives Finger-Drumming ohne Aftertouch.',
  },
]
