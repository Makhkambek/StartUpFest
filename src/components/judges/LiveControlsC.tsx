'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import type { LiveStateB, LivePhaseB } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'

interface Props {
  schedule: ScheduledMatch[]
  teamName: (id: string | null) => string
  onChange?: () => void
}

type Side = 'red' | 'white'
type ActionBody =
  | { type: 'start_match'; active_match_id: string }
  | { type: 'set_ready' }
  | { type: 'start_countdown' }
  | { type: 'go_fight' }
  | { type: 'add_score'; side: Side; delta: number }
  | { type: 'win_ko'; side: Side }
  | { type: 'win_imm'; side: Side }
  | { type: 'win_jd' }
  | { type: 'end_match' }
  | { type: 'reset' }

const PHASE_LABEL: Record<LivePhaseB, string> = {
  idle: 'Idle',
  waiting: 'Waiting',
  positioning: 'Robots in arena',
  countdown: 'Countdown',
  fighting: 'Fighting',
  round_result: 'Bout over',
  match_result: 'Match over',
}

export default function LiveControlsC({ schedule, teamName, onChange }: Props) {
  const [state, setState] = useState<LiveStateB | null>(null)
  const [picked, setPicked] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [migrationMissing, setMigrationMissing] = useState(false)
  const autoGoFightRef = useRef(false)
  const pendingDelta = useRef<{ red: number; white: number }>({ red: 0, white: 0 })
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refetch = useCallback(async () => {
    // Skip while score flush is pending — don't overwrite optimistic state.
    if (flushTimer.current !== null) return
    try {
      const res = await fetch('/api/judges/c/live', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setMigrationMissing(!!json?._migration_missing)
        setState(json)
      }
    } catch {}
  }, [])

  useEffect(() => { refetch() }, [refetch])

  // Polling fallback (5s) — state updates arrive via dispatch responses; this just
  // catches anything that slips through (e.g. another tab, page reload).
  useEffect(() => {
    const id = setInterval(refetch, 5000)
    return () => clearInterval(id)
  }, [refetch])
  useEffect(() => { if (state?.active_match_id) setPicked(state.active_match_id) }, [state?.active_match_id])
  useEffect(() => { if (state?.phase !== 'countdown') autoGoFightRef.current = false }, [state?.phase])

  const dispatch = useCallback(async (body: ActionBody) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/judges/c/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        if (json) setState(json)
        onChange?.()
      } else {
        const msg = json?.error ?? `HTTP ${res.status}`
        setError(`${body.type}: ${msg}`)
        console.error('[LiveControlsC]', body.type, res.status, json)
      }
    } catch (e) {
      setError(`${body.type}: ${(e as Error).message ?? 'network error'}`)
    } finally {
      setBusy(false)
    }
  }, [onChange])

  // ── Fast score updates: optimistic UI + debounced server flush.
  // Judge can mash +/− freely — state updates instantly, one request fires
  // 600ms after the last tap instead of one per tap.
  const addScore = useCallback((side: 'red' | 'white', delta: number) => {
    setState((prev) => {
      if (!prev) return prev
      const clamp = (n: number) => Math.max(0, Math.min(100, n))
      return side === 'red'
        ? { ...prev, wins_red: clamp(prev.wins_red + delta) }
        : { ...prev, wins_white: clamp(prev.wins_white + delta) }
    })

    if (side === 'red') pendingDelta.current.red += delta
    else pendingDelta.current.white += delta

    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(async () => {
      const { red, white } = pendingDelta.current
      pendingDelta.current = { red: 0, white: 0 }
      const sends: Promise<Response>[] = []
      if (red !== 0) sends.push(fetch('/api/judges/c/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'add_score', side: 'red', delta: red }) }))
      if (white !== 0) sends.push(fetch('/api/judges/c/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'add_score', side: 'white', delta: white }) }))
      const results = await Promise.all(sends)
      const last = results[results.length - 1]
      if (last?.ok) {
        try { setState(await last.json()) } catch {}
        onChange?.()
      }
    }, 600)
  }, [onChange])

  // Keyboard shortcuts for fast score input (only while a match is active and not over).
  useEffect(() => {
    const matchActive = state?.phase === 'fighting' || state?.phase === 'positioning' || state?.phase === 'waiting'
    if (!matchActive) return
    const onKey = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      const k = e.key.toLowerCase()
      const map: Record<string, { side: 'red' | 'white'; delta: number }> = {
        q: { side: 'red',   delta: -5 },
        w: { side: 'red',   delta: -1 },
        e: { side: 'red',   delta:  1 },
        r: { side: 'red',   delta:  5 },
        a: { side: 'white', delta: -5 },
        s: { side: 'white', delta: -1 },
        d: { side: 'white', delta:  1 },
        f: { side: 'white', delta:  5 },
      }
      const m = map[k]
      if (m) {
        e.preventDefault()
        addScore(m.side, m.delta)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state?.phase, addScore])

  // Auto judges' decision when 3-minute fight timer expires (rulebook v1.0: 3 min)
  useEffect(() => {
    if (state?.phase !== 'fighting' || !state.countdown_started_at) return
    const elapsed = (Date.now() - Date.parse(state.countdown_started_at)) / 1000
    const remaining = 180 - elapsed
    if (remaining <= 0) { dispatch({ type: 'win_jd' }); return }
    const id = setTimeout(() => dispatch({ type: 'win_jd' }), remaining * 1000)
    return () => clearTimeout(id)
  }, [state?.phase, state?.countdown_started_at, dispatch])

  // Auto-go-fight after 5s countdown
  useEffect(() => {
    if (state?.phase !== 'countdown' || !state.countdown_started_at) return
    const started = Date.parse(state.countdown_started_at)
    const remaining = 5000 - (Date.now() - started)
    if (remaining <= 0) {
      if (!autoGoFightRef.current) { autoGoFightRef.current = true; dispatch({ type: 'go_fight' }) }
      return
    }
    const id = setTimeout(() => {
      if (!autoGoFightRef.current) { autoGoFightRef.current = true; dispatch({ type: 'go_fight' }) }
    }, remaining + 50)
    return () => clearTimeout(id)
  }, [state?.phase, state?.countdown_started_at, dispatch])

  if (!state) return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-gray-200 dark:border-zinc-700 text-sm text-gray-400 dark:text-zinc-400">
      Loading live controls…
    </div>
  )

  const eligible = schedule.filter((m) => m.status !== 'completed' && m.team2_id)
  const sortedEligible = [...eligible].sort((a, b) =>
    a.match_id.localeCompare(b.match_id, undefined, { numeric: true }),
  )
  const activeMatch = schedule.find((m) => m.id === state.active_match_id && m.status !== 'completed') ?? null
  const isMatchOver = state.phase === 'match_result' || (state.phase === 'round_result' && state.match_winner !== null)
  const nextPending = sortedEligible.find((m) => m.id !== state.active_match_id) ?? null

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border-2 border-rose-300 dark:border-rose-800 shadow-sm dark:shadow-lg dark:shadow-rose-950/20">
      <div className="px-4 py-3 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-rose-700 dark:text-rose-300">
            Live field control · MiniRoboWar
          </span>
        </div>
        <div className="text-[11px] text-gray-500 dark:text-zinc-400">
          Field display: <a className="text-blue-600 underline" href="/field/c" target="_blank" rel="noopener">/field/c</a>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {migrationMissing && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-400 px-3 py-2 text-xs">
            <div className="font-bold">⚠ Supabase migration 012 not applied</div>
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/20 border-2 border-red-400 text-red-800 dark:text-red-400 px-3 py-2 text-xs flex items-center justify-between gap-2">
            <div><span className="font-black">⚠ Action failed:</span> <code className="font-mono">{error}</code></div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-bold">✕</button>
          </div>
        )}

        {isMatchOver && (
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-800 p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                🏁 Bout result recorded
              </div>
              <button disabled={busy} onClick={() => dispatch({ type: 'reset' })}
                className="text-xs font-bold text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-50 underline">
                Close / idle
              </button>
            </div>
            {nextPending ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 text-sm">
                  <span className="text-gray-500 dark:text-zinc-400 text-[11px] font-bold uppercase tracking-widest mr-2">Next:</span>
                  <span className="font-mono font-black text-gray-900 dark:text-zinc-100">#{nextPending.match_id}</span>
                  <span className="text-gray-500 dark:text-zinc-400 mx-1.5">·</span>
                  <span className="text-gray-700 dark:text-zinc-300">🔴 {teamName(nextPending.team1_id)}</span>
                  <span className="text-gray-400 dark:text-zinc-400 mx-1.5">vs</span>
                  <span className="text-gray-700 dark:text-zinc-300">🔵 {teamName(nextPending.team2_id)}</span>
                </div>
                <button disabled={busy} onClick={() => dispatch({ type: 'start_match', active_match_id: nextPending.id })}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-1.5 rounded">
                  ▶ Start next bout
                </button>
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-zinc-400 italic">All bouts completed 🎉</div>
            )}
          </div>
        )}

        {activeMatch && !isMatchOver ? (
          <div className="rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-400 mb-0.5">Active bout</div>
            <div className="font-mono text-sm text-gray-800 dark:text-zinc-200 truncate">
              #{activeMatch.match_id} · 🔴 {teamName(activeMatch.team1_id)} vs 🔵 {teamName(activeMatch.team2_id)}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
              Phase: <span className="font-semibold text-gray-700 dark:text-zinc-300">{PHASE_LABEL[state.phase]}</span>
              {' · '}🔴 {state.wins_red}/100 — {state.wins_white}/100 🔵
            </div>
          </div>
        ) : (!activeMatch && !isMatchOver) ? (
          <div className="space-y-2">
            {nextPending && (
              <div className="rounded-md bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-300 dark:border-rose-800 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300 mb-1">
                  ⏭ Next bout · auto-picked
                </div>
                <div className="font-mono text-sm text-gray-800 dark:text-zinc-200 mb-2">
                  <span className="font-bold">#{nextPending.match_id}</span>
                  <span className="text-gray-400 dark:text-zinc-400 mx-2">·</span>
                  🔴 {teamName(nextPending.team1_id)}
                  <span className="text-gray-400 dark:text-zinc-400 mx-2">vs</span>
                  🔵 {teamName(nextPending.team2_id)}
                </div>
                <button disabled={busy}
                  onClick={() => dispatch({ type: 'start_match', active_match_id: nextPending.id })}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black text-sm px-4 py-2 rounded shadow-sm">
                  ▶ Start #{nextPending.match_id}
                </button>
              </div>
            )}

            {eligible.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-50">
                  {nextPending ? 'Or choose a different bout…' : 'Pick a bout…'}
                </summary>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mt-2">
                  <select value={picked} onChange={(e) => setPicked(e.target.value)}
                    className="flex-1 border border-gray-300 dark:border-zinc-700 rounded px-2 py-1.5 text-sm dark:bg-zinc-800 dark:text-zinc-100">
                    <option value="">Pick a bout…</option>
                    {sortedEligible.map((m) => (
                      <option key={m.id} value={m.id}>
                        #{m.match_id} · {teamName(m.team1_id)} vs {teamName(m.team2_id)}
                      </option>
                    ))}
                  </select>
                  <button disabled={busy || !picked}
                    onClick={() => dispatch({ type: 'start_match', active_match_id: picked })}
                    className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-sm px-4 py-1.5 rounded">
                    Start
                  </button>
                </div>
              </details>
            )}

            {eligible.length === 0 && (
              <div className="rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-3 text-xs text-gray-600 dark:text-zinc-400">
                No scheduled bouts available. Generate a schedule below or add a bout manually.
              </div>
            )}
          </div>
        ) : null}

        {activeMatch && !isMatchOver && (
          <>
            {/* Phase controls */}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy || state.phase === 'positioning'} onClick={() => dispatch({ type: 'set_ready' })}
                className={btn(state.phase === 'positioning')}>
                🤖 Robots in arena
              </button>
              <button disabled={busy || state.phase !== 'positioning'} onClick={() => dispatch({ type: 'start_countdown' })}
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-30 text-white font-bold text-sm px-3 py-1.5 rounded">
                ⏱ Start 5s countdown
              </button>
              <button disabled={busy || (state.phase !== 'countdown' && state.phase !== 'positioning')} onClick={() => dispatch({ type: 'go_fight' })}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-30 text-white font-bold text-sm px-3 py-1.5 rounded">
                ▶ FIGHT (start now)
              </button>
              <button disabled={busy || state.phase !== 'fighting'} onClick={() => dispatch({ type: 'win_jd' })}
                className="bg-red-700 hover:bg-red-800 disabled:opacity-30 text-white font-bold text-sm px-3 py-1.5 rounded">
                ⏹ End bout
              </button>
            </div>

            {/* Judge scoring */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
              <ScoreColumn side="red" label="🔴 RED" score={state.wins_red} addScore={addScore} />
              <ScoreColumn side="white" label="🔵 BLUE" score={state.wins_white} addScore={addScore} />
            </div>
            <div className="text-[10px] text-gray-400 dark:text-zinc-400 italic">
              Tip: tap fast or hold (200ms accelerator). Keys: Q/W/E/R for red −5/−1/+1/+5 · A/S/D/F for blue.
            </div>

            {/* Win conditions */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-400 mb-1">Bout result</div>
              <div className="grid grid-cols-2 gap-2 mb-1">
                <button disabled={busy} onClick={() => dispatch({ type: 'win_ko', side: 'red' })}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 rounded flex flex-col items-center leading-tight">
                  <span>🥊 KO · Red</span>
                  <span className="text-[10px] font-normal opacity-70">Knockout</span>
                </button>
                <button disabled={busy} onClick={() => dispatch({ type: 'win_ko', side: 'white' })}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded flex flex-col items-center leading-tight">
                  <span>🥊 KO · Blue</span>
                  <span className="text-[10px] font-normal opacity-70">Knockout</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-1">
                <button disabled={busy} onClick={() => dispatch({ type: 'win_imm', side: 'red' })}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 rounded flex flex-col items-center leading-tight">
                  <span>🧊 IMM · Red</span>
                  <span className="text-[10px] font-normal opacity-70">Immobilized</span>
                </button>
                <button disabled={busy} onClick={() => dispatch({ type: 'win_imm', side: 'white' })}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 rounded flex flex-col items-center leading-tight">
                  <span>🧊 IMM · Blue</span>
                  <span className="text-[10px] font-normal opacity-70">Immobilized</span>
                </button>
              </div>
              <button disabled={busy} onClick={() => dispatch({ type: 'win_jd' })}
                className="w-full bg-gray-700 hover:bg-gray-800 text-white font-bold text-xs py-2 rounded">
                ⚖ Judges' decision (by current scores)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ScoreColumn({
  side, label, score, addScore,
}: {
  side: 'red' | 'white'
  label: string
  score: number
  addScore: (side: 'red' | 'white', delta: number) => void
}) {
  const color = side === 'red' ? 'border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400' : 'border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400'
  return (
    <div className={`border ${color} rounded p-2`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-black tracking-widest uppercase">{label}</span>
        <span className="font-mono font-black text-lg">{score}/100</span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        <HoldButton onTrigger={() => addScore(side, -1)} className="bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-900 dark:text-zinc-100 text-xs font-bold py-1 rounded select-none">−1</HoldButton>
        <HoldButton onTrigger={() => addScore(side, -5)} className="bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-900 dark:text-zinc-100 text-xs font-bold py-1 rounded select-none">−5</HoldButton>
        <HoldButton onTrigger={() => addScore(side, 5)}  className="bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-900 dark:text-zinc-100 text-xs font-bold py-1 rounded select-none">+5</HoldButton>
        <HoldButton onTrigger={() => addScore(side, 1)}  className="bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-900 dark:text-zinc-100 text-xs font-bold py-1 rounded select-none">+1</HoldButton>
      </div>
    </div>
  )
}

// Click-or-hold button: 1 trigger on tap, then auto-repeat every 120ms while held.
// First repeat after a 350ms delay (so a single tap stays a single increment).
function HoldButton({
  onTrigger, className, children,
}: {
  onTrigger: () => void
  className?: string
  children: React.ReactNode
}) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  const start = () => {
    onTrigger()
    // After 350ms delay, start repeating every 120ms (accelerator).
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => onTrigger(), 120)
    }, 350)
  }

  return (
    <button
      type="button"
      className={className}
      onPointerDown={(e) => { e.preventDefault(); start() }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      {children}
    </button>
  )
}

function btn(active: boolean) {
  return `text-sm font-bold py-1.5 px-3 rounded border-2 transition-colors ${
    active ? 'bg-rose-100 dark:bg-rose-900/40 border-rose-500 dark:border-rose-600 text-rose-800 dark:text-rose-200' : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300'
  }`
}
