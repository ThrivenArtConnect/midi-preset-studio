# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier festgehalten.

## Unreleased

### Hinzugefügt

- **MPD24-Port-Test** (Monitor-Tab, „Port-Test starten“/„-stoppen“): ermittelt bei einem
  Pad-Hit den tatsächlichen macOS-MIDI-Input-Port, über den die Note eingeht – relevant, weil
  das MPD24 mehrfach als Input erscheinen kann („Akai MPD24 [2]“, „[3]“, „Anschluss 3 [4]“).
  Neues Modul `src/main/port-test.js`: erkennt passende Ports rein per `"MPD24"`-Namensmuster
  (keine festen Indizes/Suffixe), nutzt bereits offene Ports (Hauptinput/sysexInput) weiter und
  öffnet nur die übrigen passenden Ports temporär; schließt beim Stop ausschließlich diese
  temporären Ports. Zeigt Portname, Portindex, Note, Velocity, Channel und Zeitpunkt; Button
  „Empfehlung kopieren“ legt einen deutschen FL-Studio-Hinweistext („MPD24-Signal erkannt
  über: … In FL Studio nur diesen Port aktivieren …“) über `navigator.clipboard.writeText`
  in die Zwischenablage (keine neue Dependency).
- **MIDI-Learn während Port-Test vollständig gesperrt**: sowohl der `midi:learnStart`-IPC-Handler
  im Main-Prozess (weist die Aktivierung strukturiert zurück) als auch der Renderer-Handler und
  der Button selbst verhindern MIDI-Learn, solange ein Port-Test läuft – ein Pad-Hit wird während
  des Tests ausschließlich als Port-Test-Ereignis verarbeitet. Port-Test stoppt automatisch beim
  Verlassen des Monitor-Tabs, beim Unmount und bei `disconnectMidi()`.
  Kein SysEx, kein Senden, kein Geräte-/Preset-Write im Port-Test.

- **Preset-Validator** (`src/shared/preset-validator.js`, `validatePreset(preset)`): prüft ein
  Preset rein lesend (mutiert nie) auf sieben nicht blockierende Auffälligkeiten – Regler auf
  Bank-Select-CC (0/32), mehrere Regler auf derselben CC, Kollision mit den 20 bestätigten
  Yamaha-CS1x-Controllern (benannt nur, wo die Aufgabenstellung den Namen bestätigt hat; sonst
  neutraler Hinweis „ist für den Yamaha CS1x reserviert“), Play Mode TGL je Pad, die kritische
  MPD24-Rohbyte-Kollision (TGL auf Bank B/C/D Pad 9–16 beeinflusst Bank A Pad 1–8, siehe
  `preset-generator.js`), Notenüberschneidung zwischen Bänken sowie Noten außerhalb der typischen
  Sampler-Range 12–108. Jede Warnung trägt eine aus dem betroffenen Feld abgeleitete, stabile `id`.

- **WarningsPanel** (`src/renderer/components/WarningsPanel.jsx`): zeigt „Preset-Warnungen“
  unterhalb der Statuszeile, unabhängig vom aktiven Tab. Jede Warnung einzeln mit „Quittieren“
  ausblendbar (blendet nur aus, ändert keine Presetdaten); Quittierungen werden beim Wechsel auf
  ein anderes Preset zurückgesetzt. Blockiert weder Laden noch Bearbeiten noch „Zum Gerät senden“.

- **Validierung eingebunden** (`src/renderer/App.jsx`): läuft reaktiv bei jeder Änderung des
  aktuell bearbeiteten Presets – deckt normales Laden, „Preset aus Vorlage laden“ und laufende
  Bearbeitung ab, ist damit auch vor „Zum Gerät senden“ stets aktuell sichtbar. SICKFYN1 erzeugt
  keine Warnungen; Slot 1 (Werks-Preset „BFD Lite“) erzeugt reale Warnungen für alle sieben Regeln.

- **Preset-Generator „SICKFYN1“**: `src/shared/presets/sickfyn1.json` (versionierte Vorlage) +
  `src/shared/preset-generator.js` (`buildPresetFromTemplate`). Erzeugt aus der Vorlage ein
  vollständiges MPD24-Preset für Slot 13 (Notenblöcke A 36–51, B 52–67, C 68–83, D 84–99;
  Event-Typ NOTE, Play Mode MTY, Pressure OFF, Channel = Common Channel; Knobs K1–K8 auf
  CC 20–27, Fader F1–F6 auf CC 28–31/102/103, jeweils Channel 11, Min 0, Max 127) und patcht es
  über die bestehende `raw-patch.js`-Logik in einen 505-Byte-SysEx-Rohdump. SICKFYN1 ist als
  eigenes User-Preset für Slot 13 vorgesehen.

- **Button „Preset aus Vorlage laden"** (`src/renderer/App.jsx`): erzeugt SICKFYN1 aus der Vorlage
  und lädt es als lokalen Entwurf für Slot 13 – markiert als `unsaved`, sendet nichts ans Gerät.
  Der zuvor geladene/bekannte Rohdump von Slot 13 dient dabei nur als Basis fürs Patchen (Header,
  unbelegte Bytes), sein bisheriger Inhalt wird dadurch weder stillschweigend als SICKFYN1
  bezeichnet noch ohne diesen expliziten Klick ersetzt.

- **Slot-Sperre 1–12**: Alle Bearbeitungsfelder (Name, Pad-Note/-Channel/-Mode/-Pressure/-Event-Typ,
  Knob-/Fader-CC/-Channel/-Min/-Max, MIDI-Learn, „Zum Gerät senden") sind für Slot 1–12 (Werksbereich)
  deaktiviert; ein 🔒-Hinweis erscheint neben dem Namensfeld und im Preset-Dropdown. Slots 13–30
  (User-Bereich, inkl. Slot 13/14) bleiben uneingeschränkt editierbar. „Alle 30 Presets senden"
  bleibt unverändert (sendet weiterhin alle geladenen Slots) – automatisches Backup vor dem Senden
  folgt in einem späteren Schritt.

### Korrigiert

- **TGL-Ausnahme für Pad 13–16 gestrichen (war ursprünglich für Bank D, dann B/C/D geplant).**
  Ein Roundtrip-Test (Vorlage → Generator → Raw-Preset → Parser, `test/preset-generator.test.js`)
  zeigte: Das Play-Mode-Byte für Pad-Index 9–16 in Bank B/C/D liegt auf denselben Rohbytes
  (108–115) wie das Event-Type-Flag von Bank A Pad 1–8. TGL auf Pad 13–16 (Index 12–15) hätte
  beim Serialisieren ungewollt das Event-Type-Flag von Bank A Pad 5–8 (Perc1, Perc2, Ride, Crash)
  auf TGL gesetzt und damit das Kern-Drumkit für Finger-Drumming unbrauchbar gemacht.
  SICKFYN1 verwendet deshalb durchgängig Play Mode MTY auf allen 64 Pads. Details und Byte-Analyse
  als Kommentar in `src/shared/preset-generator.js` und im `source`-Feld der Vorlage.

### Bekannte Einschränkung (nicht neu eingeführt)

- „Channel = Common Channel“ (CC) und echter „Channel 1“ landen laut `raw-patch.js` auf demselben
  Rohbyte (0). Kein Werks-Capture hat je Common Channel verwendet, es gibt also keinen Beleg für den
  tatsächlichen Hardware-Sentinelwert. Direkt nach dem Laden der Vorlage zeigt der Editor korrekt
  „CC“; nach einem echten Geräte-Roundtrip (Senden + „Vom Gerät laden“) liest die App „Channel 1“.
  Manuell mit echter Hardware verifizieren, ob Pads dem globalen Common-Channel-Setting folgen.
