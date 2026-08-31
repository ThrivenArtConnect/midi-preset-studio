import React from 'react'
import Tooltip from './Tooltip.jsx'
import { GLOBAL_INFO_CARDS } from '../data/globalInfo.js'

const ACCENT = '#e63946'

const cardStyle = {
  background: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '12px',
}

export default function GlobalInfoPanel() {
  return (
    <div style={{ padding: '16px', maxWidth: '720px' }}>
      <h2 style={{ color: ACCENT, fontSize: '15px', margin: '0 0 16px', fontWeight: 700 }}>
        Global & Info
      </h2>
      <p style={{ color: '#71717a', fontSize: '13px', marginBottom: '20px' }}>
        Diese Einstellungen werden primär am MPD24 unter GLOBAL MODE vorgenommen.
        Die App dokumentiert ihr Verhalten für Pads, Knobs und Fader.
      </p>
      {GLOBAL_INFO_CARDS.map(card => (
        <Tooltip key={card.id} text={card.tip} block>
          <div id={`card-${card.id}`} style={cardStyle}>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: '#fff' }}>{card.title}</h3>
            <p style={{ margin: '0 0 10px', fontSize: '13px', lineHeight: 1.5, color: '#a1a1aa' }}>
              {card.body}
            </p>
            {card.diagram && (
              <pre style={{
                margin: 0, padding: '10px', background: '#09090b', borderRadius: '6px',
                fontSize: '11px', color: '#86efac', fontFamily: 'ui-monospace, monospace',
                whiteSpace: 'pre-wrap', border: '1px solid #27272a',
              }}>
                {card.diagram}
              </pre>
            )}
          </div>
        </Tooltip>
      ))}
    </div>
  )
}
