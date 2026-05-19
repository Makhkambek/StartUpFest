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
  | { type: 'kickoff' }
  | { type: 'goal'; side: Side }
  | { type: 'undo_goal'; side: Side }
  | { type: 'halftime' }
  | { type: 'start_second_half' }
  | { type: 'start_extra_time' }
  | { type: 'start_penalties' }
  | { type: 'end_match' }
  | { type: 'reset' }

const PHASE_LABEL: Record<LivePhaseB, string> = {
  idle: 'Idle',
  waiting: 'Pre-match',
  positioning: 'Robots on pitch',
  countdown: 'Countdown',
  fighting: 'Live',
  round_result: 'Halftime',
  match_result: 'Full-time',
}

const HALF_NAME = ['', '1st half', '2nd half', 'Extra time', 'Penalties']

export default function LiveControlsD({ schedule, teamName, onChange }: Props) {
  const [state, setState] = useState<LiveStateB | null>(null)
  const [picked, setPicked] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [migrationMissing, setMigrationMissing] = useState(false)
  const [authExpired, setAuthExpired] = useState(false)
  const autoGoFightRef = useRef(false)
  const autoEndRef = useRef(false)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/judges/d/live', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setMigrationMissing(!!json?._migration_missing)
        setAuthExpired(false)
        setState(json)
      } else if (res.status === 401) {
        setAuthExpired(true)
      }
    } catch {}
  }, [])

  useEffect(() => { refetch() }, [refetch])
  useEffect(() => {
    const id = setInterval(refetch, 1500)
    return () => clearInterval(id)
  }, [refetch])
  useEffect(() => { if (state?.active_match_id) setPicked(state.active_match_id) }, [state?.active_match_id])
  useEffect(() => { if (state?.phase !== 'countdown') autoGoFightRef.current = false }, [state?.phase])
  // Reset auto-end guard whenever fighting phase ENTERS afresh (new half kickoff resets countdown_started_at).
  useEffect(() => { autoEndRef.current = false }, [state?.phase, state?.countdown_started_at])

  const dispatch = useCallback(async (body: ActionBody) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/judges/d/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        if (json) setState(json)
        onChange?.()
      } else if (res.status === 401) {
        setAuthExpired(true)
      } else {
        setError(`${body.type}: ${json?.error ?? `HTTP ${res.status}`}`)
        console.error('[LiveControlsD]', body.type, res.status, json)
      }
    } catch (e) {
      setError(`${body.type}: ${(e as Error).message ?? 'network error'}`)
    } finally {
      setBusy(false)
    }
  }, [onChange])

  // Optimistic goal: bump local state immediately, fire-and-forget to server.
  const goal = useCallback((side: Side) => {
    setState((prev) => {
      if (!prev) return prev
      return side === 'red'
        ? { ...prev, wins_red: prev.wins_red + 1, last_round_winner: 'red' }
        : { ...prev, wins_white: prev.wins_white + 1, last_round_winner: 'white' }
    })
    fetch('/api/judges/d/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'goal', side }),
    }).then(async (res) => {
      if (res.status === 401) {
        setAuthExpired(true)
        return
      }
      if (res.ok) {
        try { setState(await res.json()) } catch {}
        onChange?.()
      } else {
        const json = await res.json().catch(() => null)
        setError(`goal: ${json?.error ?? `HTTP ${res.status}`}`)
      }
    }).catch(() => null)
  }, [onChange])

  // Auto kickoff after 5s countdown
  useEffect(() => {
    if (state?.phase !== 'countdown' || !state.countdown_started_at) return
    const started = Date.parse(state.countdown_started_at)
    const remaining = 5000 - (Date.now() - started)
    if (remaining <= 0) {
      if (!autoGoFightRef.current) { autoGoFightRef.current = true; dispatch({ type: 'kickoff' }) }
      return
    }
    const id = setTimeout(() => {
      if (!autoGoFightRef.current) { autoGoFightRef.current = true; dispatch({ type: 'kickoff' }) }
    }, remaining + 50)
    return () => clearTimeout(id)
  }, [state?.phase, state?.countdown_started_at, dispatch])

  // Auto end half/match when 2-minute half timer hits 0.
  // kickoff sets countdown_started_at to the half's start, so we compute elapsed from that.
  useEffect(() => {
    const HALF_MS = 120_000
    if (state?.phase !== 'fighting' || !state.countdown_started_at) return
    const started = Date.parse(state.countdown_started_at)
    const remaining = HALF_MS - (Date.now() - started)
    const round = state.round_number ?? 1
    const fire = () => {
      if (autoEndRef.current) return
      autoEndRef.current = true
      // Half 1 → halftime break. Half 2 or later (extra/pens) → full-time.
      dispatch({ type: round === 1 ? 'halftime' : 'end_match' })
    }
    if (remaining <= 0) { fire(); return }
    const id = setTimeout(fire, remaining + 50)
    return () => clearTimeout(id)
  }, [state?.phase, state?.countdown_started_at, state?.round_number, dispatch])

  if (authExpired) return (
    <div className="bg-red-50 rounded-lg p-4 border-2 border-red-300 text-sm">
      <div className="font-black text-red-700 mb-1">⚠ Session expired</div>
      <div className="text-red-600 text-xs mb-2">Your login has expired. Please sign in again to continue.</div>
      <a href="/judges/login" className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded">
        → Sign in
      </a>
    </div>
  )

  if (!state) return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 text-sm text-gray-400">
      Loading live controls…
    </div>
  )

  const eligible = schedule.filter((m) => m.status !== 'completed' && m.team2_id)
  const activeMatch = schedule.find((m) => m.id === state.active_match_id) ?? null
  const isMatchOver = state.phase === 'match_result'
  const isHalftime = state.phase === 'round_result'
  const isLive = state.phase === 'fighting'
  const tieAtFullTime = isMatchOver && state.wins_red === state.wins_white

  return (
    <div className="bg-white rounded-lg border-2 border-emerald-400 shadow-sm">
      <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-emerald-700">
            ⚽ Live field control · Robo Football
          </span>
        </div>
        <div className="text-[11px] text-gray-500">
          Field display: <a className="text-blue-600 underline" href="/field/d" target="_blank" rel="noopener">/field/d</a>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {migrationMissing && (
          <div className="rounded-md bg-red-50 border border-red-300 text-red-800 px-3 py-2 text-xs">
            <div className="font-bold">⚠ Supabase migration 012 not applied</div>
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 border-2 border-red-400 text-red-800 px-3 py-2 text-xs flex items-center justify-between gap-2">
            <div><span className="font-black">⚠ Action failed:</span> <code className="font-mono">{error}</code></div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-bold">✕</button>
          </div>
        )}

        {/* Match completed banner */}
        {isMatchOver && (
          <div className="rounded-md bg-emerald-50 border-2 border-emerald-300 p-3">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-700">🏁 Match complete</div>
              <button disabled={busy} onClick={() => dispatch({ type: 'reset' })}
                className="text-xs font-bold text-gray-500 hover:text-gray-700 underline">Close / idle</button>
            </div>
            <div className="text-sm font-mono font-black mb-2">
              {state.wins_red} − {state.wins_white}
            </div>
            {tieAtFullTime && (
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => dispatch({ type: 'start_extra_time' })}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3 py-1.5 rounded">
                  ▶ Start Extra Time
                </button>
                <button disabled={busy} onClick={() => dispatch({ type: 'start_penalties' })}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded">
                  ▶ Penalties
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active match */}
        {activeMatch && !isMatchOver ? (
          <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Active match</div>
            <div className="font-mono text-sm text-gray-800">
              <div>#{activeMatch.match_id}</div>
              <div className="text-rose-700">
                🔴 RED: {teamName(activeMatch.team1_id)}{activeMatch.team1b_id ? ` + ${teamName(activeMatch.team1b_id)}` : ''}
              </div>
              <div className="text-blue-700">
                🔵 BLUE: {teamName(activeMatch.team2_id)}{activeMatch.team2b_id ? ` + ${teamName(activeMatch.team2b_id)}` : ''}
              </div>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Phase: <span className="font-semibold text-gray-700">{PHASE_LABEL[state.phase]}</span>
              {' · '}<span>{HALF_NAME[state.round_number] ?? `Half ${state.round_number}`}</span>
              {' · '}🔴 {state.wins_red} − {state.wins_white} 🔵
            </div>
          </div>
        ) : !activeMatch ? (
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <select value={picked} onChange={(e) => setPicked(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="">Pick a match…</option>
              {eligible.map((m) => {
                const redLabel = m.team1b_id
                  ? `${teamName(m.team1_id)} + ${teamName(m.team1b_id)}`
                  : teamName(m.team1_id)
                const blueLabel = m.team2b_id
                  ? `${teamName(m.team2_id)} + ${teamName(m.team2b_id)}`
                  : teamName(m.team2_id)
                return (
                  <option key={m.id} value={m.id}>
                    #{m.match_id} · {redLabel} vs {blueLabel}
                  </option>
                )
              })}
            </select>
            <button disabled={busy || !picked} onClick={() => dispatch({ type: 'start_match', active_match_id: picked })}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm px-4 py-1.5 rounded">
              Start match
            </button>
          </div>
        ) : null}

        {activeMatch && !isMatchOver && (
          <>
            {/* Phase controls */}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy || state.phase === 'positioning'} onClick={() => dispatch({ type: 'set_ready' })}
                className={btn(state.phase === 'positioning')}>
                🤖 Robots on pitch
              </button>
              <button disabled={busy || state.phase !== 'positioning'} onClick={() => dispatch({ type: 'start_countdown' })}
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-30 text-white font-bold text-sm px-3 py-1.5 rounded">
                ⏱ Start 5s countdown
              </button>
              <button disabled={busy || (state.phase !== 'countdown' && state.phase !== 'positioning')} onClick={() => dispatch({ type: 'kickoff' })}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-30 text-white font-bold text-sm px-3 py-1.5 rounded">
                ▶ KICK-OFF
              </button>
            </div>

            {/* Goal buttons */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Goals</div>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={busy || !isLive} onClick={() => goal('red')}
                  className="bg-rose-600 hover:bg-rose-700 disabled:opacity-30 text-white font-bold text-lg py-3 rounded">
                  ⚽ GOAL · 🔴 RED  ({state.wins_red})
                </button>
                <button disabled={busy || !isLive} onClick={() => goal('white')}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white font-bold text-lg py-3 rounded">
                  ⚽ GOAL · 🔵 BLUE  ({state.wins_white})
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button disabled={busy || state.wins_red === 0} onClick={() => dispatch({ type: 'undo_goal', side: 'red' })}
                  className="text-rose-700 border border-rose-300 hover:bg-rose-50 text-[10px] font-bold py-1 rounded">
                  ↶ Undo red
                </button>
                <button disabled={busy || state.wins_white === 0} onClick={() => dispatch({ type: 'undo_goal', side: 'white' })}
                  className="text-blue-700 border border-blue-300 hover:bg-blue-50 text-[10px] font-bold py-1 rounded">
                  ↶ Undo blue
                </button>
              </div>
            </div>

            {/* Half navigation */}
            <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-100">
              {state.round_number === 1 && isLive && (
                <button disabled={busy} onClick={() => dispatch({ type: 'halftime' })}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3 py-1.5 rounded">
                  ⏸ Half-time
                </button>
              )}
              {isHalftime && state.round_number === 1 && (
                <button disabled={busy} onClick={() => dispatch({ type: 'start_second_half' })}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-3 py-1.5 rounded">
                  ▶ Start 2nd half
                </button>
              )}
              <button disabled={busy} onClick={() => dispatch({ type: 'end_match' })}
                className="bg-gray-900 hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded ml-auto">
                🏁 End match
              </button>
              <button disabled={busy} onClick={() => dispatch({ type: 'reset' })}
                className="text-xs font-bold text-red-600 hover:text-red-700 border border-red-300 hover:border-red-500 rounded px-2 py-1.5">
                Reset
              </button>
            </div>

            <div className="text-[10px] text-gray-400 italic">
              Tip: Press <kbd className="bg-gray-100 px-1 rounded font-mono">R</kbd> for red goal, <kbd className="bg-gray-100 px-1 rounded font-mono">B</kbd> for blue (only during Live).
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function btn(active: boolean) {
  return `text-sm font-bold py-1.5 px-3 rounded border-2 transition-colors ${
    active ? 'bg-emerald-100 border-emerald-500 text-emerald-800' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
  }`
}
