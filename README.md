# MIDI Preset Studio

Offline-first Desktop-App (macOS) zum Lesen, Bearbeiten und Schreiben von Hardware-MIDI-Controller-Presets über SysEx. Erster Controller-Adapter: **AKAI MPD24**. Weitere Adapter (z. B. Yamaha CS1x) sind vorbereitet, aber noch nicht implementiert.

**Autor:** SiCKaRiM · **Version:** 1.0.0 · **Lizenz:** MIT (siehe [LICENSE](LICENSE))

---

## ⚠️ Safety 0.2 — Hardware-Preset-Write ist derzeit gesperrt

Alle Hardware-Preset-Writes sind **fail-closed blockiert** (`src/main/preset-write-gate.js`, UI-Containment in `src/renderer/preset-write-lock.js`):

- **Factory-Slots 1–12** sind dauerhaft Main-Process-seitig gesperrt — unabhängig von jedem zukünftigen Schritt.
- **Alle Slots (1–30)** sind zusätzlich übergangsweise gesperrt, solange ein Backup-vor-Senden-Mechanismus fehlt. Weder Einzel-Send noch „Alle 30 Presets senden" noch JSON-Import lösen aktuell einen echten Hardware-Write aus.
- Die Sperre wird erst in einem eigenen, ausdrücklich freizugebenden Ticket gelockert, sobald ein automatisches Backup vor jedem Senden implementiert und getestet ist.

## Was die App kann

### Preset-Editor (Tab „Editor")

- **30 Preset-Slots** (01–30), Name bis 8 Zeichen (MPD24-Display)
- **4 Pad-Banks** (A–D) à 16 Pads in 4×4-Matrix
- Pro Pad: **MIDI-Note** (0–127), **Kanal** (1–16 oder Common Channel „CC"), **Spielmodus** MTY/TGL, **Aftertouch** OFF/CPR/PPR
- Bank A zusätzlich: **Program Change** mit optional Bank M (MSB) / Bank L (LSB)
- **8 Knobs** und **6 Fader**: CC-Nummer, Kanal, Min/Max-Range
- **MIDI-Learn**: Note am Gerät spielen → automatisch ins Pad übernehmen
- Ungespeicherte Änderungen werden mit `●` markiert (*unsaved*)

### Geräte-Kommunikation

| Aktion | Beschreibung |
|---|---|
| **Verbinden** | MIDI-Input + Output wählen (MPD24 per USB) |
| **Zum Gerät senden** | Aktuelles Preset als 505-Byte-SysEx an MPD24 (aktuell gesperrt, siehe Safety 0.2) |
| **Alle 30 Presets senden** | Bulk-Transfer (~3–5 s) (aktuell gesperrt, siehe Safety 0.2) |
| **↓ Vom Gerät laden** | Passiver Empfang: am MPD24 `GLOBAL → [>] SysEx Tx → VALUE → ENTER` |
| **Alle Presets sichern** | JSON-Backup nach `~/Downloads/presets_backup.json` |
| **Preset importieren** | JSON laden (aktuell gesperrt, siehe Safety 0.2) |

**MIDI-Ports (macOS):**

- **Input:** bevorzugt „MPD24 Anschluss 3" (SysEx-Dumps) — zusätzlicher Listener wird automatisch geöffnet
- **Output:** „MPD24" (ohne DLS-Virtual-Port)

### Weitere Tabs

| Tab | Inhalt |
|---|---|
| **Global & Info** | Erklärungen zu Common Channel, Pad Sensitivity, Velocity Curves, SysEx-Workflow |
| **Monitor** | Live-Anzeige der letzten MIDI-Events (Note On/Off, CC, Aftertouch, Program Change) |
| **Preset-Tools** | A/B-Vergleich zweier Presets, Tags pro Preset, Snapshot/Undo (max. 10 pro Preset) |
| **Tutorials** | Schritt-für-Schritt-Anleitungen mit UI-Highlights |

---

## SysEx-Protokoll

Reverse-engineered aus eigenen Live-MIDI-Captures (23.05.2026). Byte-Offsets sind **Capture-basiert**, nicht aus Hersteller-Doku übernommen.

```
Preset-Dump:  505 Bytes
Header:       F0 47 00 68 10 03 71 [preset 01–1E] ... F7
Dump-Request: F0 47 00 68 10 03 71 [preset] F7
```

Wichtige Byte-Offsets im 505-Byte-Dump:

| Bereich | Offset | Inhalt |
|---|---|---|
| Name | 8–15 | 8 ASCII-Zeichen |
| Bank A Noten | 52–67 | Pad 1–16 |
| Bank B Noten | 68–83 | Pad 1–16 |
| Bank C Noten | 84–99 | Pad 1–16 |
| Bank D Noten | 132–147 | Pad 1–16 |
| Modi (MTY/TGL) | 100+ | 0x00 = MTY, 0x02 = TGL |
| Kanäle | 116+ | stored as ch−1 |
| Knobs CC | 180+ | 8× CC-Nummer |
| Fader CC | 212+ | 6× CC-Nummer |

Implementierung: `src/main/sysex-protocol.js` (Runtime) · Referenz: `resources/sysex-protocol.js`

---

## Presets

Diese öffentliche Version enthält **keine eingebetteten Factory-Presets**. Die App startet mit einer leeren Preset-Liste; Presets kommen ausschließlich über einen echten Geräte-Dump (`↓ Vom Gerät laden`) hinzu.

**SICKFYN1** (`src/shared/presets/sickfyn1.json`) ist eine eigene, lokale User-Vorlage für Slot 13 — kein Werks-Preset, kein Hardware-Write. Der Button „Preset aus Vorlage laden" funktioniert unabhängig von einem vorhandenen Geräte-Dump: fehlt ein bekannter Rohdump für den Ziel-Slot, wird automatisch ein synthetischer, minimaler 505-Byte-Rahmen (`src/shared/blank-raw-preset.js`) als Basis verwendet — die eigentlichen Pad-/Knob-/Fader-Werte stammen ausschließlich aus der Vorlage.

> Falls du eine ältere Version dieses Projekts kennst: dort enthaltene Werks-Preset-Namen (Produktbezeichnungen Dritter wie DAW- oder Sampler-Namen) stammten aus eigenen Hardware-Captures und wurden für dieses öffentliche Repository bewusst nicht übernommen, um keine Aussage über deren Rechtsstatus treffen zu müssen.

Empfangene oder gesendete Presets werden lokal gecacht:

```
~/Library/Application Support/MIDI Preset Studio/presets/preset_XX.syx
```

---

## Tech-Stack

| Layer | Technologie |
|---|---|
| Desktop | Electron 30 (Universal macOS .dmg) |
| UI | React 18, Tailwind CSS 3 |
| Build | electron-vite 2, Vite 5 |
| MIDI | `midi` (native Node/RtMidi), `jzz` |
| IPC | Preload-Bridge `window.midi` → Main-Prozess |
| Tests | Vitest, synthetische Fixtures (`test/fixtures/`) — keine echten Hardware-Captures |

---

## Projektstruktur

```
midi-preset-studio/
├── src/
│   ├── main/
│   │   ├── index.js              # Electron Main, MIDI I/O, IPC, Preset-Cache
│   │   ├── preset-write-gate.js  # Safety 0.2: fail-closed Preset-Write-Sperre
│   │   └── sysex-protocol.js     # SysEx Parser/Serializer (vollständig)
│   ├── preload/index.js          # contextBridge → window.midi
│   ├── renderer/
│   │   ├── App.jsx               # Haupt-UI
│   │   ├── raw-patch.js          # Byte-Level-Patching im 505-Byte-Raw
│   │   ├── preset-storage.js     # Tags, Snapshots (localStorage)
│   │   └── components/           # Editor-Panels, Monitor, Tutorials, Tools
│   └── shared/
│       ├── preset-generator.js   # Vorlagen → vollständiges Preset (z.B. SICKFYN1)
│       ├── blank-raw-preset.js   # Synthetischer 505-Byte-Rahmen ohne Geräte-Dump
│       └── presets/sickfyn1.json # Lokale User-Vorlage (Slot 13)
├── resources/sysex-protocol.js   # Protokoll-Referenz (Captures)
├── assets/                       # icon.icns (Build)
├── entitlements.plist            # macOS Hardened Runtime
└── test/                         # Vitest-Suite inkl. synthetischer Fixtures
```

---

## Setup & Build

**Voraussetzungen:** Node.js 18+, macOS, MPD24 per USB (optional — die App läuft auch ohne angeschlossenes Gerät)

```bash
cd midi-preset-studio
npm install

# Native MIDI-Modul für Electron neu bauen (falls nötig)
npm run rebuild

# Entwicklung (Hot-Reload + DevTools)
npm run dev

# Tests
npm run test

# Production-Build
npm run build

# macOS Universal .dmg
npm run build:mac
```

Output: `dist/mac-universal/MIDI Preset Studio.app` bzw. `.dmg`

> **Icon:** `assets/icon.icns` für den Build hinterlegen (siehe `assets/README.md`). Ohne Icon nutzt electron-builder das Standard-Electron-Icon.

---

## Typischer Workflow

1. MPD24 per USB verbinden → App starten → Input/Output wählen → **Verbinden**
2. Preset vom Gerät laden (`↓ Vom Gerät laden`) oder Vorlage laden (`Preset aus Vorlage laden`)
3. Pads/Knobs/Fader bearbeiten
4. Senden ans Gerät ist aktuell gesperrt (Safety 0.2, siehe oben)
5. Vor Änderungen: **Alle Presets sichern** (JSON) oder Snapshot in Preset-Tools

**Preset vom Gerät lesen:**

```
MPD24:  GLOBAL → [>] SysEx Tx → VALUE-Dial (Preset-Nr.) → ENTER
App:    „↓ Vom Gerät laden" (wartet 30 s auf 505-Byte-Dump)
```

---

## Lizenz

MIT — siehe [LICENSE](LICENSE). Ausgenommen: das Akai-Bedienungshandbuch ist **nicht** Teil dieses Repositories (Drittanbieter-Copyright).
