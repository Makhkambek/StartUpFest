import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import type { LiveStateB, PenaltyA } from '@/types/database'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

type Action =
  | { type: 'start_match'; active_match_id: string }
  | { type: 'set_ready' }
  | { type: 'start_countdown' }
  | { type: 'go_fight' }
  | { type: 'finish_run'; time_sec: number | null }
  | { type: 'correct_time'; time_sec: number }
  | { type: 'add_penalty'; penalty_sec: 10 | 40 }
  | { type: 'disq_attempt' }
  | { type: 'mark_dnf' }
  | { type: 'next_attempt' }
  | { type: 'end_match' }
  | { type: 'retry_persist' }
  | { type: 'reset' }
  | { type: 'toggle_finals' }
  | { type: 'toggle_standby' }

// Default state returned when the DB hasn't been seeded yet. `category` must
// match the route (live_match_state has one row per category) so any UI that
// reads it doesn't misroute. `updated_at` uses current time, not epoch, so the
// public scoreboard doesn't render "Updated: 1970-01-01".
const DEFAULT_STATE = {
  category: 'a' as const,
  city_code: 'TSH',
  active_match_id: null,
  phase: 'idle' as const,
  round_number: 1,
  wins_red: 0,
  wins_white: 0,
  starting_position: null,
  last_round_winner: null,
  match_winner: null,
  countdown_started_at: null,
  fight_started_at: null,
  fouls_red: 0,
  fouls_white: 0,
  round_history: [],
  finals_visible: false,
  standby_mode: false,
  updated_at: new Date().toISOString(),
}

export async function GET() {
  if (hasSupabase) {
    try {
      const cityCode = await getActiveCityCode()
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('live_match_state').select('*').eq('category', 'a').eq('city_code', cityCode).maybeSingle()
      if (error || !data) return NextResponse.json({ ...DEFAULT_STATE, _migration_missing: !!error })
      return NextResponse.json(data)
    } catch {
      return NextResponse.json({ ...DEFAULT_STATE, _migration_missing: true })
    }
  }
  const { getLiveA } = await import('@/lib/mock-store')
  return NextResponse.json(getLiveA())
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && !session.categories.includes('a')) {
    return NextResponse.json({ error: 'Not assigned to category A' }, { status: 403 })
  }

  const action = (await req.json()) as Action
  if (!action?.type) return NextResponse.json({ error: 'type required' }, { status: 400 })
  if (action.type === 'start_match') {
    const { isUuid } = await import('@/lib/uuid')
    if (!isUuid(action.active_match_id)) {
      return NextResponse.json({ error: 'active_match_id must be a valid UUID' }, { status: 400 })
    }
  }

  // retry_persist: re-attempt the results_a write for the current state without
  // mutating the live phase. Backs the judge's "Retry save" banner after a silent
  // persist failure. Idempotent — results_a upsert keys on scheduled_match_id.
  if (action.type === 'retry_persist') {
    const cur = await readCurrentState()
    if (!cur || cur.match_winner === null || !cur.active_match_id) {
      return NextResponse.json({ error: 'No completed run to save', action: action.type }, { status: 400 })
    }
    const persistError = await persistRunResult(cur).catch((e) => `persist: ${(e as Error).message}`)
    return NextResponse.json({ ...cur, persistError })
  }

  // Capture active_match_id BEFORE the patch clears it (reset sets it to null).
  const activeMatchIdBeforeReset = action.type === 'reset' ? (await readCurrentState())?.active_match_id ?? null : null

  const next = hasSupabase ? await applySupabase(action) : await applyMock(action)
  if (!next) {
    // Generic "Invalid action" used to confuse judges — log the action so we can
    // diagnose from server logs without leaking internals to the browser.
    console.error(`[live/a] action returned null: ${action.type}`)
    return NextResponse.json(
      { error: 'Invalid action', action: action.type },
      { status: 400 },
    )
  }

  if (action.type === 'reset') {
    if (hasSupabase) {
      const cityCode = await getActiveCityCode()
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const supabase = createAdminClient()
      if (activeMatchIdBeforeReset) {
        // Only delete result and reset status for the one match that was active.
        await supabase.from('results_a').delete().eq('scheduled_match_id', activeMatchIdBeforeReset).eq('city_code', cityCode)
        await supabase.from('scheduled_matches').update({ status: 'pending', result_id: null }).eq('id', activeMatchIdBeforeReset)
      }
    } else {
      if (activeMatchIdBeforeReset) {
        const { setMatchStatus } = await import('@/lib/schedule-store')
        setMatchStatus(activeMatchIdBeforeReset, 'pending')
      }
    }
  }

  // Persist to results_a once the match is actually decided (both attempts done OR judge
  // explicitly ended it). Triggered when match_winner is set — phase may be round_result
  // (showing the final-attempt time) or match_result.
  if (next.match_winner !== null && next.active_match_id) {
    const persistError = await persistRunResult(next).catch((e) => `persist: ${(e as Error).message}`)
    return NextResponse.json({ ...next, persistError })
  }

  return NextResponse.json(next)
}

async function readCurrentState(): Promise<LiveStateB | null> {
  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data } = await supabase
      .from('live_match_state').select('*').eq('category', 'a').eq('city_code', cityCode).maybeSingle()
    return (data as LiveStateB | null) ?? null
  }
  const { getLiveA } = await import('@/lib/mock-store')
  return getLiveA()
}

// ── History is stored as JSONB: for category A, an array of `{ time | null, disq? }` per attempt.
type RunRecord = { time: number | null; disq?: boolean }

function readHistory(c: LiveStateB | null): RunRecord[] {
  const raw = (c?.round_history as unknown) ?? []
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => {
      if (typeof x === 'number') return { time: x }
      if (x && typeof x === 'object' && 'time' in x) return { time: typeof (x as RunRecord).time === 'number' ? (x as RunRecord).time : null }
      return null
    })
    .filter((r): r is RunRecord => r !== null)
}

function buildPatch(action: Action, cur: LiveStateB | null): Partial<LiveStateB> {
  const c = cur ?? (DEFAULT_STATE as LiveStateB)
  switch (action.type) {
    case 'start_match':
      return {
        active_match_id: action.active_match_id,
        phase: 'waiting',
        round_number: 1,
        wins_red: 0,
        wins_white: 0,
        starting_position: null,
        last_round_winner: null,
        match_winner: null,
        countdown_started_at: null,
        fight_started_at: null,
        fouls_red: 0,
        fouls_white: 0,
        round_history: [],
      }
    case 'set_ready':
      return { phase: 'positioning', countdown_started_at: null }
    case 'start_countdown':
      return { phase: 'countdown', countdown_started_at: new Date().toISOString() }
    case 'go_fight': {
      // Anchor fight_started_at to countdown_started_at + 5s (= the GO signal).
      // The field display timer is provisionally anchored to the same timestamp
      // (countdownStartedAt + 5000), so liveMs == lastRunTime — no backward jump
      // and no mismatch between the big timer and the BEST cell.
      const fightStart = c.countdown_started_at
        ? new Date(Date.parse(c.countdown_started_at) + 5000)
        : new Date()
      return {
        phase: 'fighting',
        fight_started_at: fightStart.toISOString(),
        // countdown_started_at intentionally omitted — preserve the original value
        // so useCountdown on the field display doesn't restart from 5.
      }
    }
    case 'finish_run': {
      const serverElapsed = c.fight_started_at
        ? Math.max(0, (Date.now() - Date.parse(c.fight_started_at)) / 1000)
        : null
      // Use manual time when judge provides it; fall back to server-computed elapsed.
      const elapsed = (action.time_sec !== null && action.time_sec !== undefined) ? action.time_sec : serverElapsed
      const history = readHistory(c)
      history.push({ time: elapsed })
      // Each scheduled match = exactly one run. match_winner is always set here
      // so the match completes immediately — no second attempt within the same match.
      return {
        phase: 'round_result',
        wins_red: c.wins_red + 1,
        last_round_winner: 'red',
        match_winner: 1,
        round_history: history as unknown as LiveStateB['round_history'],
      }
    }
    case 'add_penalty':
      return { fouls_red: c.fouls_red + action.penalty_sec }
    case 'mark_dnf': {
      const history = readHistory(c)
      history.push({ time: null })
      return {
        phase: 'round_result',
        wins_red: c.wins_red + 1,
        last_round_winner: 'draw',
        match_winner: 1,
        round_history: history as unknown as LiveStateB['round_history'],
      }
    }
    case 'disq_attempt': {
      const history = readHistory(c)
      history.push({ time: null, disq: true })
      return {
        phase: 'round_result',
        wins_red: c.wins_red + 1,
        last_round_winner: 'draw',
        match_winner: 1,
        round_history: history as unknown as LiveStateB['round_history'],
      }
    }
    case 'next_attempt':
      return {
        phase: 'positioning',
        round_number: c.round_number + 1,
        last_round_winner: null,
        countdown_started_at: null,
        fight_started_at: null,
      }
    case 'end_match':
      return { phase: 'match_result', match_winner: 1 }
    case 'correct_time': {
      // Overwrite the last run's time in history, then re-persist.
      const history = readHistory(c)
      if (history.length > 0) history[history.length - 1] = { time: action.time_sec }
      else history.push({ time: action.time_sec })
      return { round_history: history as unknown as LiveStateB['round_history'] }
    }
    case 'retry_persist':
      // Handled in POST before reaching here; no state mutation.
      return {}
    case 'reset':
      return {
        active_match_id: null,
        phase: 'idle',
        round_number: 1,
        wins_red: 0,
        wins_white: 0,
        starting_position: null,
        last_round_winner: null,
        match_winner: null,
        countdown_started_at: null,
        fight_started_at: null,
        fouls_red: 0,
        fouls_white: 0,
        round_history: [],
      }
    case 'toggle_standby':
      return { standby_mode: !(c.standby_mode ?? false) }
    case 'toggle_finals':
      return { finals_visible: !(c.finals_visible ?? false) }
  }
}

async function applyMock(action: Action): Promise<LiveStateB | null> {
  const m = await import('@/lib/mock-store')
  const cur = m.getLiveA()
  const patch = buildPatch(action, cur)
  return m.setLiveA(patch)
}

async function applySupabase(action: Action): Promise<LiveStateB | null> {
  const cityCode = await getActiveCityCode()
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: cur, error: readErr } = await supabase
    .from('live_match_state').select('*').eq('category', 'a').eq('city_code', cityCode).maybeSingle()
  if (readErr) {
    console.error('[live/a] select error:', readErr.message)
    return null
  }
  if (!cur) {
    const { error: insErr } = await supabase
      .from('live_match_state').insert({ category: 'a', city_code: cityCode })
    if (insErr) {
      console.error('[live/a] seed insert error:', insErr.message)
      return null
    }
  }
  const patch = buildPatch(action, (cur as LiveStateB | null) ?? null)

  const { data, error } = await supabase
    .from('live_match_state')
    .update(patch)
    .eq('category', 'a')
    .eq('city_code', cityCode)
    .select()
    .maybeSingle()
  if (error) {
    console.error('[live/a] update error:', error.message)
    return null
  }
  return (data as LiveStateB | null) ?? null
}

// ── Persist run result to results_a so it shows up in standings/leaderboard.
// Judge can later refine the times via the Record/Edit form on /judges/a.
// Returns null on success or an error string the judge UI shows as a Retry
// banner — previously the error was swallowed, silently dropping the result.
// Idempotent: results_a upsert keys on scheduled_match_id, so Retry overwrites.
async function persistRunResult(state: LiveStateB): Promise<string | null> {
  if (!state.active_match_id) return null
  const history = readHistory(state)
  const run1 = history[0]?.time ?? null
  const run2 = history[1]?.time ?? null

  // Derive penalty from history + accumulated fouls_red (= penalty seconds).
  const anyDisq = history.some((r) => r.disq)
  const allDnf = history.length > 0 && history.every((r) => r.time === null && !r.disq)
  const penaltySec = anyDisq ? 0 : Math.max(0, state.fouls_red)
  const penalty: PenaltyA =
    anyDisq ? 'disq'
    : allDnf ? 'dnf'
    : String(penaltySec) as PenaltyA

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Compute total (best run + penalty seconds; null if DNF/DISQ).
    const best = [run1, run2].filter((v): v is number => v !== null).reduce((a, b) => Math.min(a, b), Infinity)
    const total: number | null = (penalty === 'dnf' || penalty === 'disq')
      ? null
      : isFinite(best) ? best + penaltySec : null

    const { error: upsertErr } = await supabase.from('results_a').upsert({
      scheduled_match_id: state.active_match_id,
      team_id: await teamIdForScheduled(state.active_match_id),
      run1,
      run2,
      penalty,
      total,
      city_code: cityCode,
      run_phase: 'qualification',
      notes: null,
    }, { onConflict: 'scheduled_match_id' })
    if (upsertErr) return `save result: ${upsertErr.message}`
    // Mark the scheduled match as completed so it drops out of "next" suggestions.
    await supabase.from('scheduled_matches').update({ status: 'completed' }).eq('id', state.active_match_id)
    return null
  }

  const { upsertResultA } = await import('@/lib/mock-store')
  const { getMatchById } = await import('@/lib/schedule-store')
  const sched = getMatchById(state.active_match_id)
  if (!sched) return null
  upsertResultA({
    scheduled_match_id: state.active_match_id,
    team_id: sched.team1_id,
    run1,
    run2,
    penalty,
    run_phase: 'qualification',
    notes: null,
  })

  // Also flip the schedule entry to completed so it doesn't reappear in "next" lists.
  const { markComplete } = await import('@/lib/schedule-store')
  markComplete(sched.id, sched.id, null)
  return null
}

async function teamIdForScheduled(scheduledMatchId: string): Promise<string | null> {
  if (!hasSupabase) return null
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data } = await supabase
    .from('scheduled_matches').select('team1_id').eq('id', scheduledMatchId).maybeSingle()
  return ((data as { team1_id: string } | null)?.team1_id) ?? null
}
