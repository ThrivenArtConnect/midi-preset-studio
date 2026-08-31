export const TUTORIALS = [
  {
    id: 'connect',
    title: 'Grundlagen – MPD24 & Editor verbinden',
    steps: [
      { text: 'Verbinde den MPD24 per USB mit dem Mac. Das Gerät sollte als MIDI-Gerät erscheinen.', highlightElementId: 'conn-status' },
      { text: 'Wähle im Editor den MIDI-Input (Anschluss 3) und den MIDI-Output (MPD24).', highlightElementId: 'midi-ports' },
      { text: 'Klicke auf „Verbinden“. Der Status wechselt zu 🟢 MPD24 verbunden.', actionHint: 'Verbinden', highlightElementId: 'btn-connect' },
      { text: 'Presets laden: JSON-Daten sind bereits eingebaut. Vom Gerät: GLOBAL → SysEx Tx → VALUE-Dial → ENTER.', highlightElementId: 'preset-select' },
    ],
  },
  {
    id: 'pads',
    title: 'Pads – Noten, Kanäle & Spielmodi',
    steps: [
      { text: 'Wähle ein Preset und eine Bank (A–D). Klicke ein Pad in der 4×4-Matrix.', highlightElementId: 'pad-grid', targetTab: 'editor' },
      { text: 'Ändere die Note (0–127) – der Notenname wird live angezeigt (z.B. 36 = C2).', highlightElementId: 'pad-note', targetTab: 'editor' },
      { text: 'Setze den MIDI-Kanal (1–16) oder „CC“ für Common Channel.', highlightElementId: 'pad-channel', targetTab: 'editor' },
      { text: 'Wähle MTY (Momentary) oder TGL (Toggle) als Spielmodus.', highlightElementId: 'pad-mode', targetTab: 'editor' },
      { text: 'FULL LEVEL sendet immer Velocity 127; 16 LEVELS steuert Velocity über die Pad-Zeile (am Gerät in GLOBAL MODE).', highlightElementId: 'tab-global' },
    ],
  },
  {
    id: 'knobs-faders',
    title: 'Knobs & Fader – CC & Ranges',
    steps: [
      { text: 'Klicke einen Knob-Chip (K1–K8) oder Fader-Chip (F1–F6).', highlightElementId: 'knob-row', targetTab: 'editor' },
      { text: 'Setze die CC-Nummer passend zu deiner DAW (z.B. CC1 = Modulation).', highlightElementId: 'knob-cc', targetTab: 'editor' },
      { text: 'Min/Max begrenzen den Wertebereich – ein kleinerer Bereich (z.B. 0–30) gibt feinere Kontrolle.', highlightElementId: 'knob-range', targetTab: 'editor' },
      { text: 'Kanal auf Ziel-Spur in der DAW abstimmen.', highlightElementId: 'knob-channel', targetTab: 'editor' },
    ],
  },
  {
    id: 'global-feel',
    title: 'Global Feel – Pad Sensitivity & Velocity Curves',
    steps: [
      { text: 'Am MPD24: GLOBAL MODE drücken → Pad Sensitivity einstellen.', highlightElementId: 'tab-global' },
      { text: 'Velocity Curve A–D wählen: A=linear, B=soft, C=hard, D=S-Kurve.', highlightElementId: 'card-velocity-curves', targetTab: 'global' },
      { text: 'Common Channel in GLOBAL MODE setzen – betrifft alle Elemente mit Kanal „CC“ in der App.', highlightElementId: 'card-common-channel', targetTab: 'global' },
      { text: 'Teste verschiedene Kurven mit denselben Preset-Pads in deiner DAW.', actionHint: 'Monitor-Tab öffnen', targetTab: 'monitor' },
    ],
  },
  {
    id: 'program-change',
    title: 'Program Change – Kits und Sounds umschalten',
    steps: [
      { text: 'Wähle ein Pad und stelle den Event-Typ auf „Program Change“.', highlightElementId: 'pad-event-type', targetTab: 'editor' },
      { text: 'Program (0–127) = Patch-Nummer im Ziel-Synth.', highlightElementId: 'pad-program', targetTab: 'editor' },
      { text: 'Bank M (MSB) und Bank L (LSB): „OFF“ = nur Program Change. Beide gesetzt = Bank Select + Program Change.', highlightElementId: 'pad-bank', targetTab: 'editor' },
      { text: 'Sende das Preset zum Gerät und teste mit externem Synth oder DAW.', actionHint: 'Zum Gerät senden', highlightElementId: 'btn-send' },
    ],
  },
  {
    id: 'sysex-backup',
    title: 'SysEx & Backup – Sicherer Workflow',
    steps: [
      { text: 'Am MPD24: GLOBAL → [>] SysEx Tx → VALUE-Dial Preset wählen → ENTER. App empfängt 505 Bytes.', highlightElementId: 'card-sysex-tx', targetTab: 'global' },
      { text: 'In der App: „Alle Presets sichern“ → JSON in Downloads.', highlightElementId: 'btn-export' },
      { text: 'Vor dem Senden: „Snapshot“ erstellen für Undo.', highlightElementId: 'btn-snapshot', targetTab: 'tools' },
      { text: 'Presets zurückspielen: „Zum Gerät senden“ (einzeln) oder „Alle 30 Presets senden“.', highlightElementId: 'btn-send-all' },
    ],
  },
]
