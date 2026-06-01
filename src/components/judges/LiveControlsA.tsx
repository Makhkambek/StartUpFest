'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import type { LiveStateB, LivePhaseB } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'

interface Props {
  schedule: ScheduledMatch[]
  teamName: (id: string | null) => string
  onChange?: () => void
}

type ActionBody =
  | { type: 'start_match'; active_match_id: string }
  | { type: 'set_ready' }
  | { type: 'start_countdown' }
  | { type: 'go_fight' }
  | { type: 'finish_run'; time_sec: number | null }
  | { type: 'add_penalty' }
  | { type: 'mark_dnf' }
  | { type: 'next_attempt' }
  | { type: 'end_match' }
  | { type: 'retry_persist' }
  | { type: 'reset' }

const PHASE_LABEL: Record<LivePhaseB, string> = {
  idle: 'Idle',
  waiting: 'Waiting',
  positioning: 'Ready on track',
  countdown: 'Countdown',
  fighting: 'Running',
  round_result: 'Finished',
  match_result: 'Match done',
}

export default function LiveControlsA({ schedule, teamName, onChange }: Props) {
  const [state, setState] = useState<LiveStateB | null>(null)
  const [picked, setPicked] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Sticky banner: run was written to live state but the DB write (results_a)
  // failed. Stays until a retry succeeds — not tied to the polled state.
  const [persistError, setPersistError] = useState<string | null>(null)
  const [migrationMissing, setMigrationMissing] = useState(false)
  const autoGoFightRef = useRef(false)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/judges/a/live', { cache: 'no-store' })
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

  useEffect(() => {
    if (state?.phase !== 'countdown') autoGoFightRef.current = false
  }, [state?.phase])


  const dispatch = useCallback(async (body: ActionBody) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/judges/a/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        if (json) setState(json)
        // persistError is only present on responses that attempted a DB write
        // (finish_run/mark_dnf on the final attempt, end_match, retry_persist).
        if (json && typeof json === 'object' && 'persistError' in json) {
          setPersistError(json.persistError ?? null)
        }
        onChange?.()
      } else {
        const msg = json?.error ?? `HTTP ${res.status}`
        setError(`${body.type}: ${msg}`)
        console.error('[LiveControlsA]', body.type, res.status, json)
      }
    } catch (e) {
      setError(`${body.type}: ${(e as Error).message ?? 'network error'}`)
    } finally {
      setBusy(false)
    }
  }, [onChange])

  // Derived
  const eligible = state ? schedule.filter((m) => m.status !== 'completed') : []
  const sortedEligible = [...eligible].sort((a, b) =>
    a.match_id.localeCompare(b.match_id, undefined, { numeric: true }),
  )
  const nextPending = state ? sortedEligible.find((m) => m.id !== state.active_match_id) ?? null : null
  // Match is "over" when phase is match_result OR round_result with a final winner (attempt 2 done).
  const isMatchOver = state?.phase === 'match_result' || (state?.phase === 'round_result' && state?.match_winner !== null)

  // Auto-dispatch go_fight when 5s countdown finishes.
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

  const activeMatch = schedule.find((m) => m.id === state.active_match_id && m.status !== 'completed') ?? null

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border-2 border-cyan-300 dark:border-cyan-800 shadow-sm dark:shadow-lg dark:shadow-cyan-950/20">
      {/* Header */}
      <div className="px-4 py-3 bg-cyan-50 dark:bg-cyan-950/30 border-b border-cyan-200 dark:border-cyan-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-cyan-700 dark:text-cyan-300">
            Live field control
          </span>
        </div>
        <div className="text-[11px] text-gray-500 dark:text-zinc-400">
          Field display: <a className="text-blue-600 underline" href="/field/a" target="_blank" rel="noopener">/field/a</a>
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

        {persistError && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-400 dark:border-amber-800 text-amber-900 px-3 py-2.5 text-xs">
            <div className="font-black mb-1">⚠ Результат показан на табло, но НЕ записан в базу</div>
            <div className="text-amber-800 dark:text-amber-400 mb-2">
              Заезд завершён в live, но запись в таблицу результатов не прошла. Без неё команда не попадёт в leaderboard.
              {' '}<code className="font-mono text-[10px] break-all">{persistError}</code>
            </div>
            <button disabled={busy} onClick={() => dispatch({ type: 'retry_persist' })}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs px-3 py-1.5 rounded">
              ⟳ Повторить запись
            </button>
          </div>
        )}

        {/* Match-over banner */}
        {isMatchOver && (
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-800 p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                🏁 Match completed
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
                  <span className="text-gray-700 dark:text-zinc-300">🏎️ {teamName(nextPending.team1_id)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button disabled={busy} onClick={() => dispatch({ type: 'start_match', active_match_id: nextPending.id })}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded">
                    ▶ Start now
                  </button>
                  {false && (
                    <button
                      className="border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-xs font-bold px-2 py-1.5 rounded dark:text-zinc-300">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-zinc-400 italic">All matches completed 🎉</div>
            )}
          </div>
        )}

        {/* Active match indicator */}
        {activeMatch && !isMatchOver ? (
          <div className="rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-400 mb-0.5">Active runner</div>
              <div className="font-mono text-sm text-gray-800 dark:text-zinc-200 truncate">
                #{activeMatch.match_id} · 🏎️ {teamName(activeMatch.team1_id)}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                Phase: <span className="font-semibold text-gray-700 dark:text-zinc-300">{PHASE_LABEL[state.phase]}</span>
                {state.fouls_red > 0 && <> · <span className="text-amber-700 dark:text-amber-400">+{state.fouls_red === 1 ? 20 : 40}s penalty</span></>}
              </div>
            </div>
            <button disabled={busy} onClick={() => dispatch({ type: 'reset' })}
              className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 border border-red-300 hover:border-red-500 dark:border-red-700 rounded px-2 py-1">
              Reset
            </button>
          </div>
        ) : !activeMatch && !isMatchOver ? (
          <div className="space-y-2">
            {nextPending && (
              <div className="rounded-md bg-cyan-50 dark:bg-cyan-950/30 border-2 border-cyan-300 dark:border-cyan-800 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-cyan-700 dark:text-cyan-300 mb-1">
                  ⏭ Next run · auto-picked
                </div>
                <div className="font-mono text-sm text-gray-800 dark:text-zinc-200 mb-2">
                  <span className="font-bold">#{nextPending.match_id}</span>
                  <span className="text-gray-400 dark:text-zinc-400 mx-2">·</span>
                  🏎️ {teamName(nextPending.team1_id)}
                </div>
                <button disabled={busy}
                  onClick={() => dispatch({ type: 'start_match', active_match_id: nextPending.id })}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-black text-sm px-4 py-2 rounded shadow-sm">
                  ▶ Start #{nextPending.match_id}
                </button>
              </div>
            )}

            {eligible.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-50">
                  {nextPending ? 'Or choose a different run…' : 'Pick a run to start…'}
                </summary>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mt-2">
                  <select value={picked} onChange={(e) => setPicked(e.target.value)}
                    className="flex-1 border border-gray-300 dark:border-zinc-700 rounded px-2 py-1.5 text-sm dark:bg-zinc-800 dark:text-zinc-100">
                    <option value="">Pick a run…</option>
                    {sortedEligible.map((m) => (
                      <option key={m.id} value={m.id}>
                        #{m.match_id} · {teamName(m.team1_id)}
                      </option>
                    ))}
                  </select>
                  <button disabled={busy || !picked}
                    onClick={() => dispatch({ type: 'start_match', active_match_id: picked })}
                    className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white font-bold text-sm px-4 py-1.5 rounded">
                    Start
                  </button>
                </div>
              </details>
            )}

            {eligible.length === 0 && (
              <div className="rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-3 text-xs text-gray-600 dark:text-zinc-400">
                No scheduled runs available. Generate a schedule below or add a run manually.
              </div>
            )}
          </div>
        ) : null}

        {activeMatch && !isMatchOver && (
          <>
            {/* Stage controls — different from B because we have no two sides */}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy || state.phase === 'positioning'}
                onClick={() => dispatch({ type: 'set_ready' })}
                className={btn(state.phase === 'positioning')}>
                🏎️ Ready on track
              </button>
              <button disabled={busy || state.phase !== 'positioning'}
                onClick={() => dispatch({ type: 'start_countdown' })}
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-30 text-white font-bold text-sm px-3 py-1.5 rounded">
                ⏱ Start 5s countdown
              </button>
              <button disabled={busy || (state.phase !== 'countdown' && state.phase !== 'positioning')}
                onClick={() => dispatch({ type: 'go_fight' })}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-30 text-white font-bold text-sm px-3 py-1.5 rounded">
                ▶ GO (start now)
              </button>
            </div>

            {/* Run result */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-400 mb-1">Run result</div>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={busy || state.phase !== 'fighting'}
                  onClick={() => dispatch({ type: 'finish_run', time_sec: null })}
                  className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-30 text-white font-bold text-sm py-2 rounded">
                  🏁 Finish (record time)
                </button>
                <button disabled={busy || state.phase !== 'fighting'}
                  onClick={() => dispatch({ type: 'mark_dnf' })}
                  className="bg-gray-700 hover:bg-gray-800 disabled:opacity-30 text-white font-bold text-sm py-2 rounded">
                  ✕ DNF
                </button>
              </div>
            </div>

            {/* Penalty + end match */}
            <div className="flex flex-wrap gap-2 items-center">
              <button disabled={busy} onClick={() => dispatch({ type: 'add_penalty' })}
                className="border border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:bg-amber-950/30 dark:hover:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs font-bold px-3 py-1.5 rounded">
                ⚠ Add penalty ({state.fouls_red === 0 ? '+20s' : state.fouls_red === 1 ? '+40s' : 'DSQ'})
              </button>
              <button disabled={busy} onClick={() => dispatch({ type: 'end_match' })}
                className="bg-gray-900 hover:bg-black text-white text-sm font-bold px-3 py-1.5 rounded ml-auto">
                🏆 End match
              </button>
            </div>

            <div className="text-[10px] text-gray-400 dark:text-zinc-400 italic mt-2">
              After {`"Finish"`} the run is recorded and the match completes.
              Use End match only if the team withdraws or is DSQ.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function btn(active: boolean) {
  return `text-sm font-bold py-1.5 px-3 rounded border-2 transition-colors ${
    active
      ? 'bg-cyan-100 dark:bg-cyan-900/40 border-cyan-500 dark:border-cyan-600 text-cyan-800 dark:text-cyan-200'
      : 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300'
  }`
}
