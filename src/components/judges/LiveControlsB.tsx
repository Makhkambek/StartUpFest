'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import type { LiveStateB, StartingPosition, RoundOutcome, LivePhaseB } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'

interface Props {
  schedule: ScheduledMatch[]
  teamName: (id: string | null) => string
  onChange?: () => void
}

type ActionBody =
  | { type: 'start_match'; active_match_id: string }
  | { type: 'set_position'; position: StartingPosition }
  | { type: 'start_countdown' }
  | { type: 'cancel_countdown' }
  | { type: 'go_fight' }
  | { type: 'round_result'; outcome: RoundOutcome }
  | { type: 'next_round' }
  | { type: 'end_match'; winner: 0 | 1 | 2 }
  | { type: 'foul'; side: 'red' | 'white' }
  | { type: 'set_phase'; phase: LivePhaseB }
  | { type: 'reset' }
  | { type: 'close_match' }

const PHASE_LABEL: Record<LivePhaseB, string> = {
  idle: 'Idle',
  waiting: 'Waiting',
  positioning: 'Positioning',
  countdown: 'Countdown',
  fighting: 'Fighting',
  round_result: 'Round result',
  match_result: 'Match result',
}

export default function LiveControlsB({ schedule, teamName, onChange }: Props) {
  const [state, setState] = useState<LiveStateB | null>(null)
  const [picked, setPicked] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [migrationMissing, setMigrationMissing] = useState(false)
  const autoGoFightRef = useRef(false)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/judges/b/live', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setMigrationMissing(!!json?._migration_missing)
        setState(json)
      }
    } catch {}
  }, [])

  useEffect(() => { refetch() }, [refetch])
  useEffect(() => {
    if (state?.active_match_id) setPicked(state.active_match_id)
  }, [state?.active_match_id])

  // Reset auto-go-fight guard whenever we leave countdown.
  useEffect(() => {
    if (state?.phase !== 'countdown') autoGoFightRef.current = false
  }, [state?.phase])

  const dispatch = useCallback(async (body: ActionBody) => {
    setBusy(true)
    try {
      const res = await fetch('/api/judges/b/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setState(await res.json())
        onChange?.()
      }
    } finally {
      setBusy(false)
    }
  }, [onChange])

  const startNext = useCallback(async (id: string) => {
    await dispatch({ type: 'start_match', active_match_id: id })
  }, [dispatch])

  // Derived values used by both render and effects (state may be null on first render).
  // Sort by match_id so "next up" is the next sequential bout (Q-1 → Q-2 → ...).
  // Finals use round-priority ordering so 3rd-place is always played before the Final.
  const ROUND_PRIORITY: Record<string, number> = { r1: 1, r2: 2, quarter: 3, semi: 4, third_place: 5, final: 6, triangle: 6, round_robin: 6 }
  const eligible = state ? schedule.filter((m) => m.status !== 'completed' && m.team2_id) : []
  const sortedEligible = [...eligible].sort((a, b) => {
    const ra = a.round ? (ROUND_PRIORITY[a.round] ?? 0) : 0
    const rb = b.round ? (ROUND_PRIORITY[b.round] ?? 0) : 0
    if (ra !== rb) return ra - rb
    const na = parseInt(a.match_id.match(/(\d+)/)?.[1] ?? '0')
    const nb = parseInt(b.match_id.match(/(\d+)/)?.[1] ?? '0')
    if (na !== nb) return na - nb
    return a.match_id.localeCompare(b.match_id)
  })
  // If the active match was replayed (reset to pending), eligible includes it.
  // In that case, include it as the next suggestion instead of skipping it.
  const activeMatchReplayed = state ? eligible.some(m => m.id === state.active_match_id) : false
  const nextPending = state
    ? (activeMatchReplayed ? sortedEligible[0] : sortedEligible.find(m => m.id !== state.active_match_id)) ?? null
    : null
  const isMatchOver = state?.phase === 'match_result'

  // Auto-dispatch go_fight once the 5-second countdown finishes — so judge doesn't have to.
  useEffect(() => {
    if (state?.phase !== 'countdown' || !state.countdown_started_at) return
    const started = Date.parse(state.countdown_started_at)
    const remaining = 5000 - (Date.now() - started)
    if (remaining <= 0) {
      if (!autoGoFightRef.current) {
        autoGoFightRef.current = true
        dispatch({ type: 'go_fight' })
      }
      return
    }
    const id = setTimeout(() => {
      if (!autoGoFightRef.current) {
        autoGoFightRef.current = true
        dispatch({ type: 'go_fight' })
      }
    }, remaining + 50)
    return () => clearTimeout(id)
  }, [state?.phase, state?.countdown_started_at, dispatch])

  if (!state) return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-gray-200 dark:border-zinc-700 text-sm text-gray-400 dark:text-zinc-400">
      Loading live controls…
    </div>
  )

  const activeMatch = schedule.find((m) => m.id === state.active_match_id && m.status !== 'completed') ?? null

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border-2 border-amber-300 dark:border-amber-800 shadow-sm dark:shadow-lg dark:shadow-amber-950/20">
      {/* Header */}
      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
            Live field control
          </span>
        </div>
        <div className="text-[11px] text-gray-500 dark:text-zinc-400">
          Field display: <a className="text-blue-600 underline" href="/field/b" target="_blank" rel="noopener">/field/b</a>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {migrationMissing && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-400 px-3 py-2 text-xs">
            <div className="font-bold">⚠ Supabase migration 012 not applied yet</div>
            <div className="mt-0.5">Run <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">supabase/migrations/012_live_match_state.sql</code> in Supabase SQL Editor to enable live state.</div>
          </div>
        )}

        {/* Match-over banner with auto-advance to next */}
        {isMatchOver && (
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-800 p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                🏆 Match ended
                <span className="text-emerald-600 font-mono normal-case tracking-normal">
                  ({state.wins_red}−{state.wins_white}, winner: {state.match_winner === 1 ? '🔴 Red' : state.match_winner === 2 ? '🔵 Blue' : '🟰 Draw'})
                </span>
              </div>
              <button disabled={busy} onClick={() => dispatch({ type: 'close_match' })}
                className="text-xs font-bold text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-50 underline">
                Close / idle
              </button>
            </div>

            {nextPending ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 text-sm">
                    <span className="text-gray-500 dark:text-zinc-400 text-[11px] font-bold uppercase tracking-widest mr-2">Next:</span>
                    <span className="font-mono font-black text-gray-900 dark:text-zinc-100">#{nextPending.match_id}</span>
                    <span className="text-gray-500 dark:text-zinc-400 mx-1.5">·</span>
                    <span className="text-gray-700 dark:text-zinc-300">🔴 {teamName(nextPending.team1_id)}</span>
                    <span className="text-gray-400 dark:text-zinc-400 mx-1.5">vs</span>
                    <span className="text-gray-700 dark:text-zinc-300">🔵 {teamName(nextPending.team2_id)}</span>
                  </div>
                  <button disabled={busy} onClick={() => startNext(nextPending.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-1.5 rounded">
                    ▶ Start next match
                  </button>
                </div>
                {sortedEligible.filter(m => (activeMatchReplayed || m.id !== state.active_match_id) && m.id !== nextPending?.id).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-50">
                      Or choose a different match…
                    </summary>
                    <div className="flex gap-2 mt-2">
                      <select value={picked} onChange={e => setPicked(e.target.value)}
                        className="flex-1 border border-gray-300 dark:border-zinc-700 rounded px-2 py-1.5 text-sm dark:bg-zinc-800 dark:text-zinc-100">
                        <option value="">Choose a match…</option>
                        {sortedEligible.filter(m => (activeMatchReplayed || m.id !== state.active_match_id) && m.id !== nextPending?.id).map(m => (
                          <option key={m.id} value={m.id}>#{m.match_id} · {teamName(m.team1_id)} vs {teamName(m.team2_id)}</option>
                        ))}
                      </select>
                      <button disabled={busy || !picked}
                        onClick={() => dispatch({ type: 'start_match', active_match_id: picked })}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm px-3 py-1.5 rounded">
                        Start
                      </button>
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-zinc-400 italic">All matches completed 🎉</div>
            )}
          </div>
        )}

        {/* Active match indicator (hidden during match_result — we show the ended banner instead) */}
        {activeMatch && !isMatchOver ? (
          <div className="rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-400 mb-0.5">Active match</div>
              <div className="font-mono text-sm text-gray-800 dark:text-zinc-200 truncate">
                #{activeMatch.match_id} · 🔴 {teamName(activeMatch.team1_id)} vs 🔵 {teamName(activeMatch.team2_id)}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                Phase: <span className="font-semibold text-gray-700 dark:text-zinc-300">{PHASE_LABEL[state.phase]}</span>
                {' · '}Round {state.round_number} · 🔴 {state.wins_red} − {state.wins_white} 🔵
              </div>
            </div>
            <button
              disabled={busy}
              onClick={() => dispatch({ type: 'reset' })}
              className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 border border-red-300 hover:border-red-500 dark:border-red-700 rounded px-2 py-1"
            >
              End / reset
            </button>
          </div>
        ) : (!activeMatch && !isMatchOver) ? (
          <div className="space-y-2">
            {/* Hero: auto-suggested next match — one-click start */}
            {nextPending && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-800 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1">
                  ⏭ Next up · auto-picked
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
                  className="bg-amber-500 hover:bg-amber-600 text-white font-black text-sm px-4 py-2 rounded shadow-sm">
                  ▶ Start #{nextPending.match_id}
                </button>
              </div>
            )}

            {/* Manual picker collapsed by default */}
            {eligible.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-50">
                  {nextPending ? 'Or choose a different match…' : 'Pick a match to start…'}
                </summary>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mt-2">
                  <select value={picked} onChange={(e) => setPicked(e.target.value)}
                    className="flex-1 border border-gray-300 dark:border-zinc-700 rounded px-2 py-1.5 text-sm dark:bg-zinc-800 dark:text-zinc-100">
                    <option value="">Pick a match…</option>
                    {sortedEligible.map((m) => (
                      <option key={m.id} value={m.id}>
                        #{m.match_id} · {teamName(m.team1_id)} vs {teamName(m.team2_id)}
                      </option>
                    ))}
                  </select>
                  <button disabled={busy || !picked}
                    onClick={() => dispatch({ type: 'start_match', active_match_id: picked })}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold text-sm px-4 py-1.5 rounded">
                    Start
                  </button>
                </div>
              </details>
            )}

            {eligible.length === 0 && (
              <div className="rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-3 text-xs text-gray-600 dark:text-zinc-400">
                No scheduled matches available. Generate a schedule below or add a match manually.
              </div>
            )}
          </div>
        ) : null}

        {activeMatch && !isMatchOver && (
          <>
            {/* Phase controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button disabled={busy} onClick={() => dispatch({ type: 'set_position', position: 'face' })}
                className={btn(state.starting_position === 'face' && state.phase === 'positioning')}>
                🎯 Face-to-Face
              </button>
              <button disabled={busy} onClick={() => dispatch({ type: 'set_position', position: 'side' })}
                className={btn(state.starting_position === 'side' && state.phase === 'positioning')}>
                ↔ Side-by-Side
              </button>
              <button disabled={busy} onClick={() => dispatch({ type: 'set_position', position: 'back' })}
                className={btn(state.starting_position === 'back' && state.phase === 'positioning')}>
                🔄 Back-to-Back
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button disabled={busy || state.phase !== 'positioning'}
                onClick={() => dispatch({ type: 'start_countdown' })}
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-30 text-white font-bold text-sm px-3 py-1.5 rounded">
                ⏱ Start 5s countdown
              </button>
              <button disabled={busy || state.phase !== 'countdown'}
                onClick={() => dispatch({ type: 'cancel_countdown' })}
                className="border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30 text-sm font-bold px-3 py-1.5 rounded dark:text-zinc-300">
                Cancel countdown
              </button>
              <button disabled={busy || (state.phase !== 'countdown' && state.phase !== 'positioning')}
                onClick={() => dispatch({ type: 'go_fight' })}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-30 text-white font-bold text-sm px-3 py-1.5 rounded">
                ▶ Fight (go now)
              </button>
            </div>

            {/* Round result */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-400 mb-1">Round result</div>
              <div className="grid grid-cols-3 gap-2">
                <button disabled={busy || state.phase !== 'fighting'}
                  onClick={() => dispatch({ type: 'round_result', outcome: 'red' })}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white font-bold text-sm py-2 rounded">
                  🔴 Red won
                </button>
                <button disabled={busy || state.phase !== 'fighting'}
                  onClick={() => dispatch({ type: 'round_result', outcome: 'white' })}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white font-bold text-sm py-2 rounded">
                  🔵 Blue won
                </button>
                <button disabled={busy || state.phase !== 'fighting'}
                  onClick={() => dispatch({ type: 'round_result', outcome: 'draw' })}
                  className="bg-amber-100 dark:bg-amber-950/30 hover:bg-amber-200 disabled:opacity-30 text-amber-800 dark:text-amber-400 font-bold text-sm py-2 rounded border border-amber-300 dark:border-amber-800">
                  🟰 Draw
                </button>
              </div>
            </div>

            {/* Next round / end match */}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy || state.phase !== 'round_result'}
                onClick={() => dispatch({ type: 'next_round' })}
                className="border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30 text-sm font-bold px-3 py-1.5 rounded dark:text-zinc-300">
                → Next round
              </button>
              <button disabled={busy}
                onClick={() => dispatch({ type: 'end_match', winner: state.wins_red > state.wins_white ? 1 : state.wins_white > state.wins_red ? 2 : 0 })}
                className="bg-gray-900 hover:bg-black disabled:opacity-30 text-white font-bold text-sm px-3 py-1.5 rounded">
                🏆 End match
              </button>
            </div>

            {/* Fouls */}
            <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-100 dark:border-zinc-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-400">Foul:</span>
              <button disabled={busy} onClick={() => dispatch({ type: 'foul', side: 'red' })}
                className="border border-red-300 dark:border-red-800 hover:bg-red-50 dark:bg-red-950/30 dark:hover:bg-red-950/20 text-red-700 dark:text-red-400 text-xs font-bold px-2 py-1 rounded">
                🔴 Red foul ({state.fouls_red})
              </button>
              <button disabled={busy} onClick={() => dispatch({ type: 'foul', side: 'white' })}
                className="border border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:bg-blue-950/30 dark:hover:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded">
                🔵 Blue foul ({state.fouls_white})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function btn(active: boolean) {
  return `text-sm font-bold py-2 rounded border-2 transition-colors ${
    active
      ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-500 dark:border-amber-600 text-amber-800 dark:text-amber-200'
      : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300'
  }`
}
