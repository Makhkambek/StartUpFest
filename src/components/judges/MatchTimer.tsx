'use client'
import { useEffect, useRef, useState } from 'react'

interface MatchTimerProps {
  duration: number
  warnAt?: number
  onEnd?: () => void
}

export function MatchTimer({ duration, warnAt = 10, onEnd }: MatchTimerProps) {
  const [remaining, setRemaining] = useState(duration)
  const [running, setRunning] = useState(false)
  const [muted, setMuted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endedRef = useRef(false)

  function playBeep(freq = 880, ms = 200) {
    if (muted) return
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain); gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000)
      osc.start(); osc.stop(ctx.currentTime + ms / 1000)
    } catch { /* AudioContext not available */ }
  }

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        const next = r - 1
        if (next === warnAt) playBeep(660, 150)
        if (next <= 0) {
          if (!endedRef.current) {
            endedRef.current = true
            playBeep(440, 500)
            setTimeout(() => playBeep(440, 500), 600)
            onEnd?.()
          }
          setRunning(false)
          return 0
        }
        return next
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, warnAt])

  function reset() {
    setRunning(false)
    setRemaining(duration)
    endedRef.current = false
  }

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const isEnded = remaining === 0
  const isWarning = remaining > 0 && remaining <= warnAt

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm p-5 transition-colors ${
      isEnded ? 'border-red-500 bg-red-50' : isWarning ? 'border-amber-500 bg-amber-50' : 'border-gray-100'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Match Timer</span>
        <button onClick={() => setMuted(m => !m)}
          className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">
          {muted ? '🔇 Muted' : '🔊 Sound on'}
        </button>
      </div>
      <div className={`text-center font-mono font-black text-6xl mb-4 tabular-nums transition-colors ${
        isEnded ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-900'
      }`}>
        {mins}:{secs.toString().padStart(2, '0')}
      </div>
      <div className="flex gap-2">
        {!running ? (
          <button onClick={() => setRunning(true)} disabled={isEnded}
            className="flex-1 bg-green-600 text-white font-black py-4 rounded-xl text-base hover:bg-green-700 disabled:opacity-30 disabled:hover:bg-green-600">
            ▶ Start
          </button>
        ) : (
          <button onClick={() => setRunning(false)}
            className="flex-1 bg-amber-600 text-white font-black py-4 rounded-xl text-base hover:bg-amber-700">
            ⏸ Pause
          </button>
        )}
        <button onClick={reset}
          className="px-6 bg-gray-200 text-gray-700 font-bold py-4 rounded-xl text-base hover:bg-gray-300">
          ↻ Reset
        </button>
      </div>
    </div>
  )
}
