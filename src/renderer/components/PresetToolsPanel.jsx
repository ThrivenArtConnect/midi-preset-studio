import React, { useState } from 'react'
import Tooltip from './Tooltip.jsx'

const ACCENT = '#e63946'

function fmtPad(p) {
  if (!p) return '—'
  if (p.eventType === 'PROG') {
    const bm = p.bankM === 'OFF' ? 'OFF' : p.bankM
    const bl = p.bankL === 'OFF' ? 'OFF' : p.bankL
    return `PROG ${p.program ?? p.note} M${bm} L${bl} Ch${p.channel}`
  }
  return `Note ${p.note} ${p.mode} ${p.pressure} Ch${p.channel}`
}

function fmtCtrl(c) {
  if (!c) return '—'
  return `CC${c.cc} ${c.min}–${c.max} Ch${c.ch}`
}

function collectDiffs(presetA, presetB) {
  const rows = []
  if (!presetA || !presetB) return rows

  for (const bank of ['A', 'B', 'C', 'D']) {
    const padsA = presetA.banks?.[bank] || presetA[`bank${bank}`] || []
    const padsB = presetB.banks?.[bank] || presetB[`bank${bank}`] || []
    for (let i = 0; i < 16; i++) {
      const a = fmtPad(padsA[i])
      const b = fmtPad(padsB[i])
      if (a !== b) rows.push({ element: `Pad ${i + 1} Bank ${bank}`, a, b })
    }
  }

  const knobsA = presetA.knobs || []
  const knobsB = presetB.knobs || []
  for (let i = 0; i < Math.max(knobsA.length, knobsB.length); i++) {
    const a = fmtCtrl(knobsA[i])
    const b = fmtCtrl(knobsB[i])
    if (a !== b) rows.push({ element: `Knob K${i + 1}`, a, b })
  }

  const fadersA = presetA.faders || []
  const fadersB = presetB.faders || []
  for (let i = 0; i < Math.max(fadersA.length, fadersB.length); i++) {
    const a = fmtCtrl(fadersA[i])
    const b = fmtCtrl(fadersB[i])
    if (a !== b) rows.push({ element: `Fader F${i + 1}`, a, b })
  }

  return rows
}

export default function PresetToolsPanel({
  presets,
  currentPreset,
  currentNum,
  presetTags,
  onTagsChange,
  onUndoSnapshot,
  hasSnapshot,
  snapshotCount,
}) {
  const [compareA, setCompareA] = useState(currentNum || 1)
  const [compareB, setCompareB] = useState(2)
  const [compareResult, setCompareResult] = useState(null)
  const [tagInput, setTagInput] = useState('')
  const [mappingPath, setMappingPath] = useState('')
  const [mappingResult, setMappingResult] = useState(null)
  const [mappingBusy, setMappingBusy] = useState(false)

  const presetA = presets.find(p => p.number === compareA)?.preset
  const presetB = presets.find(p => p.number === compareB)?.preset
  const tags = presetTags[currentNum] || []

  function runCompare() {
    setCompareResult(collectDiffs(presetA, presetB))
  }

  function addTag() {
    const t = tagInput.trim()
    if (!t || tags.includes(t)) return
    onTagsChange(currentNum, [...tags, t])
    setTagInput('')
  }

  function removeTag(t) {
    onTagsChange(currentNum, tags.filter(x => x !== t))
  }

  async function pickMappingFile() {
    const res = await window.mapping?.pickFile?.()
    if (res?.path) setMappingPath(res.path)
  }

  async function runMappingCheck() {
    if (!window.mapping?.validate) return
    setMappingBusy(true)
    setMappingResult(null)
    try {
      const { errors, warnings } = await window.mapping.validate(currentPreset, mappingPath)
      setMappingResult({ errors: errors || [], warnings: warnings || [] })
    } catch (err) {
      setMappingResult({ errors: [err.message || String(err)], warnings: [] })
    } finally {
      setMappingBusy(false)
    }
  }

  const selectStyle = {
    background: '#18181b', color: '#fff', border: '1px solid #3f3f46',
    borderRadius: '6px', padding: '6px 8px', fontSize: '12px',
  }

  return (
    <div style={{ padding: '16px', maxWidth: '900px' }}>
      <h2 style={{ color: ACCENT, fontSize: '15px', margin: '0 0 16px', fontWeight: 700 }}>
        Preset-Tools
      </h2>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', color: '#fff', marginBottom: '8px' }}>Snapshot / Undo</h3>
        <Tooltip text="Vor jedem Senden wird automatisch ein Snapshot gespeichert (max. 10 pro Preset).">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#71717a' }}>
              Preset {currentNum}: {snapshotCount} Snapshot(s) gespeichert
            </span>
            {hasSnapshot && (
              <button
                id="btn-snapshot"
                onClick={onUndoSnapshot}
                style={{
                  background: '#27272a', color: '#fff', border: '1px solid #3f3f46',
                  borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px',
                }}
              >
                Undo – letzten Stand wiederherstellen
              </button>
            )}
          </div>
        </Tooltip>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', color: '#fff', marginBottom: '8px' }}>Tags (Preset {currentNum})</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTag()}
            placeholder="Tag hinzufügen (kommagetrennt)…"
            title="Freitext-Tag für dieses Preset"
            style={{ ...selectStyle, flex: 1, maxWidth: '280px' }}
          />
          <button
            onClick={addTag}
            style={{
              background: ACCENT, color: '#fff', border: 'none',
              borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px',
            }}
          >
            +
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {tags.map(t => (
            <span
              key={t}
              style={{
                background: '#27272a', color: '#a1a1aa', padding: '4px 8px',
                borderRadius: '4px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {t}
              <button
                onClick={() => removeTag(t)}
                style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', color: '#fff', marginBottom: '8px' }}>
          NFC mapping.json (Preset {currentNum})
        </h3>
        <Tooltip text="Stem-Slots Bank A Pads 1–8 gegen LoopMeLiveUp mapping.json prüfen.">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={mappingPath}
              onChange={e => setMappingPath(e.target.value)}
              placeholder="Pfad zu mapping.json…"
              title="mapping.json Pfad"
              style={{ ...selectStyle, flex: '1 1 240px', minWidth: '200px' }}
            />
            <button
              type="button"
              onClick={pickMappingFile}
              style={{
                background: '#27272a', color: '#fff', border: '1px solid #3f3f46',
                borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px',
              }}
            >
              Datei wählen…
            </button>
            <button
              type="button"
              onClick={runMappingCheck}
              disabled={mappingBusy || !mappingPath.trim()}
              style={{
                background: ACCENT, color: '#fff', border: 'none',
                borderRadius: '6px', padding: '6px 14px', cursor: mappingBusy ? 'wait' : 'pointer',
                fontSize: '12px', fontWeight: 600, opacity: mappingBusy || !mappingPath.trim() ? 0.6 : 1,
              }}
            >
              {mappingBusy ? 'Prüfe…' : 'Check vs mapping.json'}
            </button>
          </div>
        </Tooltip>
        <div style={{
          background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px',
          padding: '12px', fontSize: '12px', maxHeight: '240px', overflowY: 'auto',
        }}>
          {mappingResult == null ? (
            <p style={{ color: '#52525b', margin: 0 }}>mapping.json wählen und prüfen.</p>
          ) : mappingResult.errors.length === 0 && mappingResult.warnings.length === 0 ? (
            <p style={{ color: '#22c55e', margin: 0 }}>Preset &amp; mapping.json stimmen ueberein ✓</p>
          ) : (
            <>
              {mappingResult.errors.map(msg => (
                <p key={msg} style={{ color: '#ef4444', margin: '0 0 6px' }}>{msg}</p>
              ))}
              {mappingResult.warnings.map(msg => (
                <p key={msg} style={{ color: '#f59e0b', margin: '0 0 6px' }}>{msg}</p>
              ))}
            </>
          )}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: '13px', color: '#fff', marginBottom: '8px' }}>A/B Preset-Vergleich</h3>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', color: '#a1a1aa' }}>
            Preset A{' '}
            <select value={compareA} onChange={e => setCompareA(+e.target.value)} style={selectStyle}>
              {presets.map(p => (
                <option key={p.number} value={p.number}>{p.number}: {p.preset?.name || '?'}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '12px', color: '#a1a1aa' }}>
            Preset B{' '}
            <select value={compareB} onChange={e => setCompareB(+e.target.value)} style={selectStyle}>
              {presets.map(p => (
                <option key={p.number} value={p.number}>{p.number}: {p.preset?.name || '?'}</option>
              ))}
            </select>
          </label>
          <button
            onClick={runCompare}
            style={{
              background: ACCENT, color: '#fff', border: 'none',
              borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            }}
          >
            Vergleichen
          </button>
        </div>
        <div style={{
          background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px',
          padding: '12px', fontSize: '12px', maxHeight: '360px', overflowY: 'auto',
        }}>
          {compareResult == null ? (
            <p style={{ color: '#52525b', margin: 0 }}>Presets wählen und „Vergleichen“ klicken.</p>
          ) : compareResult.length === 0 ? (
            <p style={{ color: '#22c55e', margin: 0 }}>Presets sind identisch ✓</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#71717a', textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px' }}>Element</th>
                  <th style={{ padding: '4px 8px' }}>Preset A</th>
                  <th style={{ padding: '4px 8px' }}>Preset B</th>
                </tr>
              </thead>
              <tbody>
                {compareResult.map(r => (
                  <tr key={r.element} style={{ borderTop: '1px solid #27272a' }}>
                    <td style={{ padding: '4px 8px', color: '#fff', verticalAlign: 'top' }}>{r.element}</td>
                    <td style={{ padding: '4px 8px', color: '#a1a1aa', verticalAlign: 'top' }}>{r.a}</td>
                    <td style={{ padding: '4px 8px', color: ACCENT, verticalAlign: 'top' }}>{r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
