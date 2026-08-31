import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

const TIP_STYLE = {
  position: 'fixed',
  zIndex: 9999,
  maxWidth: '280px',
  padding: '8px 12px',
  background: '#1a1a1a',
  color: '#fff',
  fontSize: '12px',
  lineHeight: 1.45,
  borderRadius: '6px',
  border: '1px solid #3f3f46',
  boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
  pointerEvents: 'none',
  whiteSpace: 'normal',
  wordWrap: 'break-word',
}

function TipContent({ text }) {
  const lines = text.split('\n')
  return lines.map((line, i) => (
    <React.Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </React.Fragment>
  ))
}

export default function Tooltip({ text, children, block = false }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, transform: 'translate(-50%, 0)' })
  const wrapRef = useRef(null)
  const timerRef = useRef(null)
  const tipRef = useRef(null)

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setVisible(false)
  }, [])

  const show = useCallback(() => {
    if (!text) return
    hide()
    timerRef.current = setTimeout(() => {
      const el = wrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const gap = 8
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const preferTop = spaceBelow < 100 && spaceAbove > spaceBelow

      let top = preferTop ? rect.top - gap : rect.bottom + gap
      let transform = preferTop ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
      let left = rect.left + rect.width / 2

      setPos({ top, left, transform })
      setVisible(true)
    }, 400)
  }, [text, hide])

  useEffect(() => {
    if (!visible || !tipRef.current || !wrapRef.current) return
    const tip = tipRef.current.getBoundingClientRect()
    const wrap = wrapRef.current.getBoundingClientRect()
    let left = wrap.left + wrap.width / 2
    const margin = 8
    if (left - tip.width / 2 < margin) left = tip.width / 2 + margin
    if (left + tip.width / 2 > window.innerWidth - margin) {
      left = window.innerWidth - tip.width / 2 - margin
    }
    setPos(prev => ({ ...prev, left }))
  }, [visible])

  useEffect(() => () => hide(), [hide])

  return (
    <>
      <span
        ref={wrapRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{
          display: block ? 'block' : 'inline-flex',
          width: block ? '100%' : undefined,
          alignItems: 'center',
        }}
      >
        {children}
      </span>
      {visible && text && createPortal(
        <div ref={tipRef} style={{ ...TIP_STYLE, ...pos }}>
          <TipContent text={text} />
        </div>,
        document.body,
      )}
    </>
  )
}

export function TipField({ label, tip, children }) {
  return (
    <div>
      <Tooltip text={tip}>
        <label style={{
          display: 'block', color: '#71717a', fontSize: '11px', marginBottom: '4px',
          textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'help',
        }}>
          {label}
        </label>
      </Tooltip>
      {children}
    </div>
  )
}
