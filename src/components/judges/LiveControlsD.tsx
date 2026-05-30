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
  | { type: 'retry_persist' }
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
  // Sticky banner: result was written to live state but the DB write (matches_d)
  // failed. Stays until a retry succeeds — not tied to the polled state, so a 4s
  // refetch doesn't clear it while the result is still unsaved.
  const [persistError, setPersistError] = useState<string | null>(null)
  const [migrationMissing, setMigrationMissing] = useState(false)
  const [authExpired, setAuthExpired] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState<number | null>(null) // seconds until retry
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false)
  const autoGoFightRef = useRef(false)
  const autoEndRef = useRef(false)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/judges/d/live', { cache: 'no-store' })
      setHasFetchedOnce(true)
      if (res.ok) {
        const json = await res.json()
        setMigrationMissing(!!json?._migration_missing)
        setAuthExpired(false)
        setLoadError(null)
        setRateLimited(null)
        setState(json)
      } else if (res.status === 401) {
        setAuthExpired(true)
        setLoadError(null)
      } else if (res.status === 429) {
        // Rate-limit hit. Show countdown to next allowed request — judge friendly.
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10)
        setRateLimited(Math.max(1, retryAfter))
        setLoadError(null)
      } else {
        const body = await res.text().catch(() => '')
        setLoadError(`HTTP ${res.status}${body ? ` · ${body.slice(0, 120)}` : ''}`)
      }
    } catch (e) {
      setHasFetchedOnce(true)
      setLoadError(`network: ${(e as Error).message ?? 'unknown'}`)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])
  useEffect(() => {
    // 4s polling — Supabase Realtime is the primary signal, this is just a
    // safety net. 1.5s was too aggressive and tripped the rate limiter when
    // combined with team/schedule/match parallel fetches on the same page.
    const id = setInterval(refetch, 4000)
    return () => clearInterval(id)
  }, [refetch])
  useEffect(() => { if (state?.active_match_id) setPicked(state.active_match_id) }, [state?.active_match_id])
  useEffect(() => { if (state?.phase !== 'countdown') autoGoFightRef.current = false }, [state?.phase])
  // Reset auto-end guard whenever fighting phase ENTERS afresh (new half kickoff resets countdown_started_at).
  useEffect(() => { autoEndRef.current = false }, [state?.phase, state?.countdown_started_at])

  // Rate-limit countdown — ticks down `rateLimited` seconds, auto-retries when it hits 0.
  useEffect(() => {
    if (rateLimited === null) return
    const id = setInterval(() => {
      setRateLimited((cur) => {
        if (cur === null) return null
        if (cur <= 1) {
          // Trigger one refetch after a tick — clearing the state so the effect
          // doesn't re-fire while the fetch is in flight.
          refetch()
          return null
        }
        return cur - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [rateLimited, refetch])

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
        // persistError is only present on responses that attempted a DB write
        // (end_match, retry_persist). Update the sticky banner accordingly.
        if (json && typeof json === 'object' && 'persistError' in json) {
          setPersistError(json.persistError ?? null)
        }
        onChange?.()
      } else if (res.status === 401) {
        setAuthExpired(true)
      } else if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10)
        // Judge-friendly wording — no "HTTP 429" in the toast.
        setError(`Слишком быстро — подожди ${Math.max(1, retryAfter)}с и попробуй снова. Изменения не потеряны.`)
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
  // If the POST fails (expired session, network, server error) the optimistic +1
  // must be rolled back — otherwise the judge sees a phantom goal that never
  // reached the DB and assumes it counted.
  const goal = useCallback((side: Side) => {
    setState((prev) => {
      if (!prev) return prev
      return side === 'red'
        ? { ...prev, wins_red: prev.wins_red + 1, last_round_winner: 'red' }
        : { ...prev, wins_white: prev.wins_white + 1, last_round_winner: 'white' }
    })
    let reverted = false
    const revert = () => setState((prev) => {
      if (!prev || reverted) return prev
      reverted = true
      return side === 'red'
        ? { ...prev, wins_red: Math.max(0, prev.wins_red - 1) }
        : { ...prev, wins_white: Math.max(0, prev.wins_white - 1) }
    })
    fetch('/api/judges/d/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'goal', side }),
    }).then(async (res) => {
      if (res.status === 401) {
        revert()
        setAuthExpired(true)
        return
      }
      if (res.ok) {
        try { setState(await res.json()) } catch {}
        onChange?.()
      } else {
        revert()
        const json = await res.json().catch(() => null)
        setError(`goal: ${json?.error ?? `HTTP ${res.status}`}`)
      }
    }).catch(() => {
      revert()
      setError('goal: network error — гол не засчитан, попробуй снова')
    })
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

  if (!state) {
    if (rateLimited !== null) {
      return <RateLimitBanner seconds={rateLimited} onRetryNow={() => { setRateLimited(null); refetch() }} />
    }
    if (loadError) {
      return (
        <div className="bg-amber-50 rounded-lg p-4 border-2 border-amber-300 text-sm">
          <div className="font-black text-amber-800 mb-1">⚠ Live controls unavailable</div>
          <div className="text-amber-700 text-xs font-mono mb-2 break-all">{loadError}</div>
          <button onClick={refetch} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded">
            Retry
          </button>
        </div>
      )
    }
    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200 text-sm text-gray-400 flex items-center gap-2">
        <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        Loading live controls{hasFetchedOnce ? ' (retrying)' : ''}…
      </div>
    )
  }

  const eligible = schedule.filter((m) => m.status !== 'completed' && m.team2_id)
  const activeMatch = schedule.find((m) => m.id === state.active_match_id && m.status !== 'completed') ?? null
  const isMatchOver = state.phase === 'match_result'
  const isHalftime = state.phase === 'round_result'
  const isLive = state.phase === 'fighting'
  const tieAtFullTime = isMatchOver && state.wins_red === state.wins_white

  // Auto-pick next match: lowest match_id among eligible, excluding the one
  // that just finished. Judges don't have to manually scan the schedule —
  // when end_match fires we surface the next one as a one-click action.
  const sortedEligible = [...eligible].sort((a, b) =>
    a.match_id.localeCompare(b.match_id, undefined, { numeric: true }),
  )
  const nextSuggested = sortedEligible.find((m) => m.id !== state.active_match_id) ?? null
  function matchLabel(m: ScheduledMatch): string {
    const red = m.team1b_id
      ? `${teamName(m.team1_id)} + ${teamName(m.team1b_id)}`
      : teamName(m.team1_id)
    const blue = m.team2b_id
      ? `${teamName(m.team2_id)} + ${teamName(m.team2b_id)}`
      : teamName(m.team2_id)
    return `${red} vs ${blue}`
  }

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

        {persistError && (
          <div className="rounded-md bg-amber-50 border-2 border-amber-400 text-amber-900 px-3 py-2.5 text-xs">
            <div className="font-black mb-1">⚠ Результат показан на табло, но НЕ записан в базу</div>
            <div className="text-amber-800 mb-2">
              Матч завершён в live, но запись в таблицу результатов не прошла. Без неё команда не попадёт в leaderboard.
              {' '}<code className="font-mono text-[10px] break-all">{persistError}</code>
            </div>
            <button disabled={busy} onClick={() => dispatch({ type: 'retry_persist' })}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs px-3 py-1.5 rounded">
              ⟳ Повторить запись
            </button>
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
            <div className="text-sm font-mono font-black mb-3">
              {state.wins_red} − {state.wins_white}
            </div>

            {tieAtFullTime && (
              <div className="flex flex-wrap gap-2 mb-3">
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

            {/* Auto-suggest NEXT MATCH — one-click start without dropdown */}
            {!tieAtFullTime && nextSuggested && (
              <div className="rounded-md bg-white border border-emerald-300 p-3 mt-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">
                  ⏭ Next up
                </div>
                <div className="font-mono text-sm text-gray-800 mb-2">
                  <div className="font-bold">#{nextSuggested.match_id}</div>
                  <div className="text-rose-700">
                    🔴 {teamName(nextSuggested.team1_id)}{nextSuggested.team1b_id ? ` + ${teamName(nextSuggested.team1b_id)}` : ''}
                  </div>
                  <div className="text-blue-700">
                    🔵 {teamName(nextSuggested.team2_id)}{nextSuggested.team2b_id ? ` + ${teamName(nextSuggested.team2b_id)}` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy}
                    onClick={() => dispatch({ type: 'start_match', active_match_id: nextSuggested.id })}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-4 py-2 rounded shadow-sm">
                    ▶ Start #{nextSuggested.match_id}
                  </button>
                  <button disabled={busy} onClick={() => dispatch({ type: 'reset' })}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs px-3 py-2 rounded">
                    Choose another…
                  </button>
                </div>
              </div>
            )}

            {/* All matches done — suggest finals */}
            {!tieAtFullTime && !nextSuggested && (
              <div className="rounded-md bg-amber-50 border border-amber-300 p-3 mt-2 text-xs text-amber-800">
                <div className="font-black mb-1">🏆 All scheduled matches are complete</div>
                <div>Generate finals bracket below to continue, or close to idle.</div>
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
          <div className="space-y-2">
            {/* Hero: auto-suggested next match — one-click start */}
            {nextSuggested && (
              <div className="rounded-md bg-emerald-50 border-2 border-emerald-300 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-1">
                  ⏭ Next up · auto-picked
                </div>
                <div className="font-mono text-sm text-gray-800 mb-2">
                  <div className="font-bold">#{nextSuggested.match_id}</div>
                  <div className="text-rose-700">
                    🔴 {teamName(nextSuggested.team1_id)}{nextSuggested.team1b_id ? ` + ${teamName(nextSuggested.team1b_id)}` : ''}
                  </div>
                  <div className="text-blue-700">
                    🔵 {teamName(nextSuggested.team2_id)}{nextSuggested.team2b_id ? ` + ${teamName(nextSuggested.team2b_id)}` : ''}
                  </div>
                </div>
                <button disabled={busy}
                  onClick={() => dispatch({ type: 'start_match', active_match_id: nextSuggested.id })}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-4 py-2 rounded shadow-sm">
                  ▶ Start #{nextSuggested.match_id}
                </button>
              </div>
            )}

            {/* Fallback: manual picker — collapsed by default into a small "or pick another" row */}
            {eligible.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-800">
                  {nextSuggested ? 'Or choose a different match…' : 'Pick a match…'}
                </summary>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mt-2">
                  <select value={picked} onChange={(e) => setPicked(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="">Pick a match…</option>
                    {sortedEligible.map((m) => (
                      <option key={m.id} value={m.id}>
                        #{m.match_id} · {matchLabel(m)}
                      </option>
                    ))}
                  </select>
                  <button disabled={busy || !picked}
                    onClick={() => dispatch({ type: 'start_match', active_match_id: picked })}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm px-4 py-1.5 rounded">
                    Start
                  </button>
                </div>
              </details>
            )}

            {/* No eligible matches — guide judge to generate */}
            {eligible.length === 0 && (
              <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
                No scheduled matches available. Generate a schedule below or add a match manually.
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

// Judge-friendly rate-limit message. Shows what happened, why, what to do.
// Avoids leaking "HTTP 429" / "Too many requests" — those are meaningless on
// the floor and look like a system bug.
function RateLimitBanner({ seconds, onRetryNow }: { seconds: number; onRetryNow: () => void }) {
  return (
    <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-300 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-3 h-3 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin" />
        <div className="font-black text-blue-800">Слишком быстро · ждём {seconds}с</div>
      </div>
      <div className="text-blue-700 text-xs mb-2">
        Сервер защищает себя от спама. Подожди — экран обновится автоматически.
        Это <b>не ошибка</b>: твои предыдущие действия сохранены.
      </div>
      <button onClick={onRetryNow}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded">
        Попробовать сейчас
      </button>
    </div>
  )
}
