import React from 'react'
import Tooltip from './Tooltip.jsx'

const ACCENT = '#e63946'
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

function noteToName(n) {
  if (n == null || n < 0 || n > 127) return '?'
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`
}

function buildPortTestRecommendation(hit) {
  if (!hit) return ''
  return `MPD24-Signal erkannt über: ${hit.portName} (Port ${hit.portIndex}).\n`
    + `In FL Studio nur diesen MPD24-Input-Port aktivieren und weitere MPD24-Input-Ports deaktivieren, um doppelte Trigger zu vermeiden.`
}

function formatTimestamp(ts) {
  if (!ts) return '–'
  return new Date(ts).toLocaleTimeString('de-DE', { hour12: false })
}

function PortTestPanel({ active, lastHit, startResult, onStart, onStop, showToast }) {
  const recommendation = buildPortTestRecommendation(lastHit)

  const copyRecommendation = async () => {
    if (!recommendation) return
    try {
      await navigator.clipboard.writeText(recommendation)
      showToast?.('✓ Empfehlung kopiert')
    } catch (err) {
      showToast?.(`✗ Kopieren fehlgeschlagen: ${err.message}`, false, 4000)
    }
  }

  return (
    <div style={{
      background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px',
      padding: '12px', marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ margin: 0, color: ACCENT, fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Port-Test
        </h3>
        <Tooltip text="Ermittelt, über welchen konkreten MIDI-Input-Port ein Pad-Schlag tatsächlich eingeht. Sperrt währenddessen MIDI-Learn.">
          <button
            id="btn-port-test"
            onClick={active ? onStop : onStart}
            style={{
              background: active ? '#1d4ed8' : '#27272a', color: '#fff',
              border: '1px solid #3f3f46', borderRadius: '6px', padding: '6px 12px',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            }}
          >
            {active ? 'Port-Test stoppen' : 'Port-Test starten'}
          </button>
        </Tooltip>
      </div>

      <p style={{ color: '#71717a', fontSize: '12px', margin: '0 0 8px' }}>
        Ein Pad am MPD24 drücken – die App zeigt, über welchen der ggf. mehreren
        „Akai MPD24 [...]“-Ports das Signal ankommt.
      </p>

      {active && (
        <p style={{ color: '#93c5fd', fontSize: '12px', margin: '0 0 8px' }}>
          🔌 Port-Test läuft – MIDI-Learn ist währenddessen gesperrt. Jetzt ein Pad drücken.
        </p>
      )}

      {startResult && !startResult.ok && (
        <p style={{ color: '#fca5a5', fontSize: '12px', margin: '0 0 8px' }}>
          ⚠ {startResult.error || 'Port-Test konnte nicht gestartet werden.'}
        </p>
      )}

      {lastHit ? (
        <div style={{ background: '#09090b', border: '1px solid #3f3f46', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
          <div style={{ color: '#86efac', fontWeight: 700, fontSize: '12px', marginBottom: '4px' }}>✓ MPD24-Signal erkannt</div>
          <div style={{ color: '#fafafa', fontSize: '12px', lineHeight: 1.6 }}>
            Port: <strong>{lastHit.portName}</strong> (Index {lastHit.portIndex})<br />
            Note: {lastHit.note} ({noteToName(lastHit.note)}) · Velocity: {lastHit.velocity} · Channel: {lastHit.channel}<br />
            Zeitpunkt: {formatTimestamp(lastHit.timestamp)}
          </div>
        </div>
      ) : active && (
        <p style={{ color: '#52525b', fontSize: '12px', margin: '0 0 8px' }}>Warte auf Pad-Schlag…</p>
      )}

      <Tooltip text="Kopiert einen deutschen Empfehlungstext in die Zwischenablage, welcher MPD24-Port in FL Studio aktiv bleiben soll.">
        <button
          id="btn-copy-recommendation"
          onClick={copyRecommendation}
          disabled={!lastHit}
          style={{
            background: '#27272a', color: '#fff', border: '1px solid #3f3f46',
            borderRadius: '6px', padding: '6px 12px', cursor: lastHit ? 'pointer' : 'not-allowed',
            fontSize: '12px', fontWeight: 600, opacity: lastHit ? 1 : 0.5,
          }}
        >
          Empfehlung kopieren
        </button>
      </Tooltip>
    </div>
  )
}

function Bar({ value, max = 127 }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div style={{ height: '6px', background: '#27272a', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: ACCENT, transition: 'width 0.1s' }} />
    </div>
  )
}

function EventRow({ evt }) {
  if (evt.type === 'note') {
    return (
      <div style={{ padding: '8px 0', borderBottom: '1px solid #27272a', fontSize: '12px' }}>
        <div style={{ color: ACCENT, fontWeight: 600 }}>NOTE ON</div>
        <div style={{ color: '#a1a1aa' }}>
          {evt.note} ({noteToName(evt.note)}) · Ch {evt.channel} · Vel {evt.velocity}
        </div>
        <Bar value={evt.velocity} />
      </div>
    )
  }
  if (evt.type === 'cc') {
    return (
      <div style={{ padding: '8px 0', borderBottom: '1px solid #27272a', fontSize: '12px' }}>
        <div style={{ color: '#93c5fd', fontWeight: 600 }}>CC</div>
        <div style={{ color: '#a1a1aa' }}>
          CC {evt.cc} · Wert {evt.value} · Ch {evt.channel}
        </div>
        <Bar value={evt.value} />
      </div>
    )
  }
  if (evt.type === 'aftertouch' || evt.type === 'polyAftertouch') {
    return (
      <div style={{ padding: '8px 0', borderBottom: '1px solid #27272a', fontSize: '12px' }}>
        <div style={{ color: '#fde047', fontWeight: 600 }}>AFTERTOUCH</div>
        <div style={{ color: '#a1a1aa' }}>
          {evt.note != null ? `Note ${evt.note} · ` : ''}Wert {evt.value} · Ch {evt.channel}
        </div>
        <Bar value={evt.value} />
      </div>
    )
  }
  if (evt.type === 'programChange') {
    return (
      <div style={{ padding: '8px 0', borderBottom: '1px solid #27272a', fontSize: '12px' }}>
        <div style={{ color: '#c4b5fd', fontWeight: 600 }}>PROGRAM CHANGE</div>
        <div style={{ color: '#a1a1aa' }}>Prog {evt.program} · Ch {evt.channel}</div>
      </div>
    )
  }
  return null
}

export default function MonitorPanel({
  events, onClear,
  portTestActive, portTestLastHit, portTestStartResult, onStartPortTest, onStopPortTest, showToast,
}) {
  return (
    <div style={{ padding: '16px', flex: 1, minWidth: '320px' }}>
      <PortTestPanel
        active={portTestActive}
        lastHit={portTestLastHit}
        startResult={portTestStartResult}
        onStart={onStartPortTest}
        onStop={onStopPortTest}
        showToast={showToast}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ color: ACCENT, fontSize: '15px', margin: 0, fontWeight: 700 }}>Monitor</h2>
        <Tooltip text="Löscht die Event-Historie im Monitor.">
          <button
            onClick={onClear}
            style={{
              background: '#27272a', color: '#fff', border: '1px solid #3f3f46',
              borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px',
            }}
          >
            Leeren
          </button>
        </Tooltip>
      </div>
      <p style={{ color: '#71717a', fontSize: '12px', marginBottom: '12px' }}>
        Live-Mirror der letzten MIDI-Events vom MPD24 (Note, CC, Aftertouch).
      </p>
      <div style={{
        background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px',
        padding: '12px', maxHeight: '480px', overflowY: 'auto',
      }}>
        {!events.length ? (
          <p style={{ color: '#52525b', fontSize: '13px', textAlign: 'center', margin: '24px 0' }}>
            Warte auf MIDI-Events…
          </p>
        ) : (
          events.map((evt, i) => <EventRow key={`${evt.ts}-${i}`} evt={evt} />)
        )}
      </div>
    </div>
  )
}
