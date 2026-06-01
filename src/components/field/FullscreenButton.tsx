'use client'
import { useEffect, useState, useCallback } from 'react'

export default function FullscreenButton() {
  const [isFs, setIsFs] = useState(false)
  const [show, setShow] = useState(true)
  const timerRef = { current: null as ReturnType<typeof setTimeout> | null }

  const scheduleHide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setShow(false), 3000)
  }, [])

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    scheduleHide()
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [scheduleHide])

  const handleMouseMove = useCallback(() => {
    setShow(true)
    scheduleHide()
  }, [scheduleHide])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

  return (
    <button
      onClick={toggle}
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 99999,
        opacity: show ? 0.75 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: show ? 'auto' : 'none',
        background: 'rgba(0,0,0,0.6)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 10,
        color: 'rgba(255,255,255,0.9)',
        padding: '7px 13px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        letterSpacing: '0.03em',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 15 }}>{isFs ? '⊠' : '⛶'}</span>
      {isFs ? 'Exit' : 'Fullscreen'}
    </button>
  )
}
