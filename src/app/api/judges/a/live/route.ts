import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import type { LiveStateB, PenaltyA } from '@/types/database'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

type Action =
  | { type: 'start_match'; active_match_id: string }
  | { type: 'set_ready' }
  | { type: 'start_countdown' }
  | { type: 'go_fight' }
  | { type: 'finish_run'; time_sec: number | null }
  | { type: 'add_penalty' }
  | { type: 'mark_dnf' }
  | { type: 'next_attempt' }
  | { type: 'end_match' }
  | { type: 'reset' }

// Default state returned when the DB hasn't been seeded yet. `category` must
// match the route (live_match_state has one row per category) so any UI that
// reads it doesn't misroute. `updated_at` uses current time, not epoch, so the
// public scoreboard doesn't render "Updated: 1970-01-01".
const DEFAULT_STATE = {
  category: 'a' as const,
  active_match_id: null,
  phase: 'idle' as const,
  round_number: 1,
  wins_red: 0,
  wins_white: 0,
  starting_position: null,
  last_round_winner: null,
  match_winner: null,
  countdown_started_at: null,
  fouls_red: 0,
  fouls_white: 0,
  round_history: [],
  updated_at: new Date().toISOString(),
}

export async function GET() {
  if (hasSupabase) {
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('live_match_state').select('*').eq('category', 'a').maybeSingle()
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

  const next = hasSupabase ? await applySupabase(action) : await applyMock(action)
  if (!next) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  // Persist to results_a once the match is actually decided (both attempts done OR judge
  // explicitly ended it). Triggered when match_winner is set — phase may be round_result
  // (showing the final-attempt time) or match_result.
  if (next.match_winner !== null && next.active_match_id) {
    await persistRunResult(next).catch(() => null)
  }

  return NextResponse.json(next)
}

// ── History is stored as JSONB: for category A, an array of `{ time | null }` per attempt.
type RunRecord = { time: number | null }

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
        fouls_red: 0,
        fouls_white: 0,
        round_history: [],
      }
    case 'set_ready':
      return { phase: 'positioning', countdown_started_at: null }
    case 'start_countdown':
      return { phase: 'countdown', countdown_started_at: new Date().toISOString() }
    case 'go_fight':
      return { phase: 'fighting', countdown_started_at: new Date(Date.now() - 5000).toISOString() }
    case 'finish_run': {
      const history = readHistory(c)
      history.push({ time: action.time_sec ?? null })
      const newWins = c.wins_red + 1
      // Always show "round_result" first so the audience can see this run's time.
      // For attempt 2 we also flag the match as won (final). For attempt 1 we keep
      // round_number as-is — judge UI auto-advances to next attempt after ~3.5s.
      if (c.round_number >= 2) {
        return {
          phase: 'round_result',
          wins_red: newWins,
          last_round_winner: 'red',
          match_winner: 1,
          round_history: history as unknown as LiveStateB['round_history'],
        }
      }
      return {
        phase: 'round_result',
        wins_red: newWins,
        last_round_winner: 'red',
        round_history: history as unknown as LiveStateB['round_history'],
      }
    }
    case 'add_penalty':
      return { fouls_red: c.fouls_red + 1 }
    case 'mark_dnf': {
      const history = readHistory(c)
      history.push({ time: null })
      const newWins = c.wins_red + 1
      if (c.round_number >= 2) {
        return {
          phase: 'round_result',
          wins_red: newWins,
          last_round_winner: 'draw',
          match_winner: 1,
          round_history: history as unknown as LiveStateB['round_history'],
        }
      }
      return {
        phase: 'round_result',
        wins_red: newWins,
        last_round_winner: 'draw',
        round_history: history as unknown as LiveStateB['round_history'],
      }
    }
    case 'next_attempt':
      return {
        phase: 'positioning',
        round_number: c.round_number + 1,
        last_round_winner: null,
        countdown_started_at: null,
      }
    case 'end_match':
      return { phase: 'match_result', match_winner: 1 }
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
        fouls_red: 0,
        fouls_white: 0,
        round_history: [],
      }
  }
}

async function applyMock(action: Action): Promise<LiveStateB | null> {
  const m = await import('@/lib/mock-store')
  const cur = m.getLiveA()
  const patch = buildPatch(action, cur)
  return m.setLiveA(patch)
}

async function applySupabase(action: Action): Promise<LiveStateB | null> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: cur } = await supabase
    .from('live_match_state').select('*').eq('category', 'a').maybeSingle()
  const patch = buildPatch(action, (cur as LiveStateB | null) ?? null)

  const { data, error } = await supabase
    .from('live_match_state')
    .update(patch)
    .eq('category', 'a')
    .select()
    .maybeSingle()
  if (error) return null
  return (data as LiveStateB | null) ?? null
}

// ── Persist run result to results_a so it shows up in standings/leaderboard.
// Judge can later refine the times via the Record/Edit form on /judges/a.
async function persistRunResult(state: LiveStateB) {
  if (!state.active_match_id) return
  const history = readHistory(state)
  const run1 = history[0]?.time ?? null
  const run2 = history[1]?.time ?? null

  // Derive penalty enum from fouls count + DNF detection from history.
  const allDnf = history.length > 0 && history.every((r) => r.time === null)
  const penalty: PenaltyA =
    allDnf ? 'dnf'
    : state.fouls_red >= 2 ? '40'
    : state.fouls_red === 1 ? '20'
    : '0'

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Compute total (best run + penalty seconds; null if DNF/DISQ).
    const best = [run1, run2].filter((v): v is number => v !== null).reduce((a, b) => Math.min(a, b), Infinity)
    const penaltySec = penalty === '20' ? 20 : penalty === '40' ? 40 : 0
    const total: number | null = penalty === 'dnf'
      ? null
      : isFinite(best) ? best + penaltySec : null

    await supabase.from('results_a').upsert({
      scheduled_match_id: state.active_match_id,
      // team_id is required — pull from the scheduled match
      team_id: await teamIdForScheduled(state.active_match_id),
      run1,
      run2,
      penalty,
      total,
      run_phase: 'qualification',
      notes: null,
    }, { onConflict: 'scheduled_match_id' })
    return
  }

  const { upsertResultA } = await import('@/lib/mock-store')
  const { getMatchById } = await import('@/lib/schedule-store')
  const sched = getMatchById(state.active_match_id)
  if (!sched) return
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
}

async function teamIdForScheduled(scheduledMatchId: string): Promise<string | null> {
  if (!hasSupabase) return null
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data } = await supabase
    .from('scheduled_matches').select('team1_id').eq('id', scheduledMatchId).maybeSingle()
  return ((data as { team1_id: string } | null)?.team1_id) ?? null
}
