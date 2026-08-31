import React from 'react'

const ACCENT = '#e63946'

const SEVERITY = {
  warning: { icon: '⚠', color: '#facc15', label: 'Warnung' },
  info: { icon: 'ℹ', color: '#93c5fd', label: 'Hinweis' },
}

function refLabel(w) {
  const parts = []
  if (w.controlIds?.length) parts.push(w.controlIds.join(', '))
  if (w.padRefs?.length) {
    parts.push(w.padRefs.map(r => `Bank ${r.bank} Pad ${r.padIndex + 1}`).join(', '))
  }
  return parts.join(' · ')
}

export default function WarningsPanel({ warnings, onDismiss }) {
  if (!warnings?.length) return null

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #27272a' }}>
      <h2 style={{ color: ACCENT, fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>
        Preset-Warnungen
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {warnings.map(w => {
          const sev = SEVERITY[w.severity] || SEVERITY.warning
          const ref = refLabel(w)
          return (
            <div
              key={w.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px',
                padding: '8px 12px',
              }}
            >
              <span title={sev.label} style={{ color: sev.color, fontSize: '15px', lineHeight: '20px' }}>{sev.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fafafa', fontSize: '13px', lineHeight: 1.4 }}>{w.message}</div>
                {ref && <div style={{ color: '#71717a', fontSize: '11px', marginTop: '2px' }}>Betrifft: {ref}</div>}
              </div>
              <button
                onClick={() => onDismiss(w.id)}
                style={{
                  background: '#27272a', color: '#fff', border: '1px solid #3f3f46',
                  borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                Quittieren
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
