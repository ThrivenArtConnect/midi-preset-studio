import React, { useState, useEffect } from 'react'
import Tooltip from './Tooltip.jsx'
import { TUTORIALS } from '../data/tutorials.js'

const ACCENT = '#e63946'

const TAB_LABELS = { editor: 'Editor', global: 'Global & Info', tools: 'Preset-Tools', monitor: 'Monitor' }

export default function TutorialPanel({ onRequestTab }) {
  const [selectedId, setSelectedId] = useState(TUTORIALS[0]?.id ?? '')
  const [stepIdx, setStepIdx] = useState(0)
  const [highlightId, setHighlightId] = useState(null)

  const tutorial = TUTORIALS.find(t => t.id === selectedId) || TUTORIALS[0]
  const step = tutorial?.steps?.[stepIdx]
  const stepCount = tutorial?.steps?.length ?? 0
  const isLast = stepIdx >= stepCount - 1

  useEffect(() => {
    if (!step?.highlightElementId) {
      setHighlightId(null)
      return
    }
    setHighlightId(step.highlightElementId)
    const t = setTimeout(() => {
      document.getElementById(step.highlightElementId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
    return () => {
      clearTimeout(t)
      setHighlightId(null)
    }
  }, [step, selectedId, stepIdx])

  useEffect(() => {
    if (!highlightId) return
    const el = document.getElementById(highlightId)
    if (!el) return
    el.style.outline = `2px solid ${ACCENT}`
    el.style.outlineOffset = '2px'
    return () => {
      el.style.outline = ''
      el.style.outlineOffset = ''
    }
  }, [highlightId])

  function selectTutorial(id) {
    setSelectedId(id)
    setStepIdx(0)
  }

  function openTargetTab() {
    if (step?.targetTab) onRequestTab?.(step.targetTab)
  }

  if (!tutorial || !step) {
    return <p style={{ color: '#71717a', padding: '20px' }}>Kein Tutorial geladen.</p>
  }

  return (
    <div style={{ display: 'flex', minHeight: '420px' }}>
      <aside style={{
        width: '240px', borderRight: '1px solid #27272a', padding: '12px',
        overflowY: 'auto', flexShrink: 0,
      }}>
        <h2 style={{ color: ACCENT, fontSize: '14px', margin: '0 0 12px', fontWeight: 700 }}>Tutorials</h2>
        {TUTORIALS.map(t => (
          <button
            key={t.id}
            title={t.title}
            onClick={() => selectTutorial(t.id)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: selectedId === t.id ? '#27272a' : 'transparent',
              border: selectedId === t.id ? `1px solid ${ACCENT}` : '1px solid transparent',
              color: selectedId === t.id ? '#fff' : '#a1a1aa',
              padding: '10px', borderRadius: '6px', cursor: 'pointer',
              fontSize: '12px', marginBottom: '6px',
            }}
          >
            {t.title}
          </button>
        ))}
      </aside>
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: '#fff' }}>{tutorial.title}</h3>
        <p style={{ color: '#71717a', fontSize: '12px', marginBottom: '20px' }}>
          Schritt {stepIdx + 1} von {stepCount}
        </p>
        <div style={{
          background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px',
          padding: '20px', marginBottom: '16px', minHeight: '120px',
        }}>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#e4e4e7' }}>{step.text}</p>
          {step.actionHint && (
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: ACCENT }}>
              → {step.actionHint}
            </p>
          )}
          {step.targetTab && (
            <button
              type="button"
              onClick={openTargetTab}
              style={{
                marginTop: '12px', background: '#27272a', color: '#fff',
                border: `1px solid ${ACCENT}`, borderRadius: '6px',
                padding: '6px 12px', cursor: 'pointer', fontSize: '12px',
              }}
            >
              → {TAB_LABELS[step.targetTab] || step.targetTab}-Tab öffnen
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Tooltip text="Zurück zum vorherigen Schritt.">
            <button
              disabled={stepIdx === 0}
              onClick={() => setStepIdx(i => i - 1)}
              style={{
                background: '#27272a', color: '#fff', border: '1px solid #3f3f46',
                borderRadius: '6px', padding: '8px 16px', cursor: stepIdx === 0 ? 'default' : 'pointer',
                opacity: stepIdx === 0 ? 0.4 : 1, fontSize: '13px',
              }}
            >
              Zurück
            </button>
          </Tooltip>
          <Tooltip text={isLast ? 'Tutorial abgeschlossen.' : 'Nächster Schritt.'}>
            <button
              onClick={() => !isLast && setStepIdx(i => i + 1)}
              style={{
                background: ACCENT, color: '#fff', border: 'none',
                borderRadius: '6px', padding: '8px 20px', cursor: 'pointer', fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {isLast ? 'Fertig ✓' : 'Weiter →'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
