import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import type { LiveStateB } from '@/types/database'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

type Side = 'red' | 'white'

type Action =
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
  | { type: 'toggle_finals' }
  | { type: 'toggle_standby' }

// Default state returned when the DB hasn't been seeded yet. `category` must
// match the route ('d') so UI consumers don't misroute. `updated_at` uses
// current time, not epoch, so the public scoreboard doesn't render
// "Updated: 1970-01-01" on first fetch.
const DEFAULT_STATE = {
  category: 'd' as const,
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
        .from('live_match_state').select('*').eq('category', 'd').eq('city_code', cityCode).maybeSingle()
      if (error || !data) return NextResponse.json({ ...DEFAULT_STATE, _migration_missing: !!error })
      return NextResponse.json(data)
    } catch {
      return NextResponse.json({ ...DEFAULT_STATE, _migration_missing: true })
    }
  }
  const { getLiveD } = await import('@/lib/mock-store')
  return NextResponse.json(getLiveD())
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && !session.categories.includes('d')) {
    return NextResponse.json({ error: 'Not assigned to category D' }, { status: 403 })
  }
  const action = (await req.json()) as Action
  if (!action?.type) return NextResponse.json({ error: 'type required' }, { status: 400 })

  // retry_persist: re-attempt the matches_d write for the current state without
  // mutating the live phase. Used by the judge's "Retry save" banner after a
  // silent persist failure. Idempotent — persistMatchResult skips an existing row.
  if (action.type === 'retry_persist') {
    const cur = await readCurrentState()
    if (!cur || cur.match_winner === null || !cur.active_match_id) {
      return NextResponse.json({ error: 'No completed match to save', action: action.type }, { status: 400 })
    }
    const persistError = await persistMatchResult(cur).catch((e) => `persist: ${(e as Error).message}`)
    return NextResponse.json({ ...cur, persistError })
  }

  let next: LiveStateB | null = null
  let upstreamError: string | null = null
  if (hasSupabase) {
    const result = await applySupabase(action)
    next = result.state
    upstreamError = result.error
  } else {
    next = await applyMock(action)
  }
  if (!next) {
    return NextResponse.json({ error: upstreamError ?? 'Invalid action', action: action.type }, { status: 400 })
  }

  if (action.type === 'reset') {
    if (hasSupabase) {
      const cityCode = await getActiveCityCode()
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const supabase = createAdminClient()
      await supabase.from('matches_d').delete().eq('city_code', cityCode)
      await supabase.from('scheduled_matches').update({ status: 'pending', result_id: null }).eq('category', 'd').eq('city_code', cityCode)
    } else {
      const { clearResultsForCategory } = await import('@/lib/mock-store')
      clearResultsForCategory('d')
      const { resetScheduleStatuses } = await import('@/lib/schedule-store')
      resetScheduleStatuses('d')
    }
  }

  // Only persist when the match is truly over:
  // - Non-tie winner at any round, OR
  // - Tied after round 4 (penalties — always final).
  // A tied end of round 2 (half 2) means ET follows; tied end of round 3 (ET) means penalties follow.
  // Don't persist early — it marks the scheduled match completed and breaks activeMatch lookup.
  const isTrulyDone = next.match_winner !== null && next.active_match_id &&
    (action.type === 'end_match') &&
    (next.match_winner !== 0 || (next.round_number ?? 1) >= 4)
  if (isTrulyDone) {
    const persistError = await persistMatchResult(next).catch((e) => `persist: ${(e as Error).message}`)
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
      .from('live_match_state').select('*').eq('category', 'd').eq('city_code', cityCode).maybeSingle()
    return (data as LiveStateB | null) ?? null
  }
  const { getLiveD } = await import('@/lib/mock-store')
  return getLiveD()
}

// Goal history is JSONB: array of {time:string, side:'red'|'white', half:1|2|3|4}
type GoalEvent = { time: string; side: Side; half: number }
function readHistory(c: LiveStateB | null): GoalEvent[] {
  const raw = (c?.round_history as unknown) ?? []
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is GoalEvent =>
    !!x && typeof x === 'object' && 'side' in x && (x as GoalEvent).side != null,
  )
}

function elapsedMMSS(startedAt: string | null): string {
  if (!startedAt) return '00:00'
  const sec = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000))
  const mm = Math.floor(sec / 60)
  const ss = sec % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
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
    case 'kickoff':
      return { phase: 'fighting', countdown_started_at: new Date().toISOString() }
    case 'goal': {
      const history = readHistory(c)
      history.push({ time: elapsedMMSS(c.countdown_started_at), side: action.side, half: c.round_number })
      return action.side === 'red'
        ? { wins_red: c.wins_red + 1, last_round_winner: 'red', round_history: history as unknown as LiveStateB['round_history'] }
        : { wins_white: c.wins_white + 1, last_round_winner: 'white', round_history: history as unknown as LiveStateB['round_history'] }
    }
    case 'undo_goal': {
      const history = readHistory(c)
      // Drop the most recent goal of this side
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].side === action.side) { history.splice(i, 1); break }
      }
      return action.side === 'red'
        ? { wins_red: Math.max(0, c.wins_red - 1), round_history: history as unknown as LiveStateB['round_history'] }
        : { wins_white: Math.max(0, c.wins_white - 1), round_history: history as unknown as LiveStateB['round_history'] }
    }
    case 'halftime':
      return { phase: 'round_result', countdown_started_at: null }
    case 'start_second_half':
      return { phase: 'fighting', round_number: 2, countdown_started_at: new Date().toISOString() }
    case 'start_extra_time':
      return { phase: 'fighting', round_number: 3, countdown_started_at: new Date().toISOString(), match_winner: null }
    case 'start_penalties':
      return { phase: 'fighting', round_number: 4, countdown_started_at: new Date().toISOString(), match_winner: null }
    case 'end_match': {
      const winner = c.wins_red > c.wins_white ? 1 : c.wins_white > c.wins_red ? 2 : 0
      return { phase: 'match_result', match_winner: winner }
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
  const cur = m.getLiveD()
  const patch = buildPatch(action, cur)
  return m.setLiveD(patch)
}

async function applySupabase(action: Action): Promise<{ state: LiveStateB | null; error: string | null }> {
  const cityCode = await getActiveCityCode()
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: cur, error: readErr } = await supabase
    .from('live_match_state').select('*').eq('category', 'd').eq('city_code', cityCode).maybeSingle()
  if (readErr) return { state: null, error: `select: ${readErr.message}` }
  if (!cur) {
    const { error: insErr } = await supabase.from('live_match_state').insert({ category: 'd', city_code: cityCode })
    if (insErr) return { state: null, error: `seed: ${insErr.message}` }
  }
  const patch = buildPatch(action, (cur as LiveStateB | null) ?? null)
  const { data, error } = await supabase
    .from('live_match_state').update(patch)
    .eq('category', 'd').eq('city_code', cityCode).select().maybeSingle()
  if (error) return { state: null, error: `update: ${error.message}` }
  return { state: (data as LiveStateB | null) ?? null, error: null }
}

// Persist the final score to matches_d. Returns null on success, or an error
// string the judge UI surfaces as a "saved to live but not DB · Retry" banner —
// previously errors were swallowed (.catch(() => null)), so a failed write meant
// the result silently never reached the leaderboard. Idempotent: a second call
// (Retry) reuses the existing matches_d row instead of inserting a duplicate.
async function persistMatchResult(state: LiveStateB): Promise<string | null> {
  if (!state.active_match_id) return null
  // Determine match_phase based on which half ended the match.
  const match_phase =
    state.round_number === 3 ? 'extra'
    : state.round_number === 4 ? 'penalties'
    : 'group'

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: sched, error: schedErr } = await supabase
      .from('scheduled_matches').select('*').eq('id', state.active_match_id).maybeSingle()
    if (schedErr) return `schedule lookup: ${schedErr.message}`
    if (!sched || !sched.team2_id) return null // no opponent → nothing to record (not an error)

    const { data: existing } = await supabase
      .from('matches_d').select('id').eq('scheduled_match_id', sched.id).limit(1).maybeSingle()
    let resultId = (existing as { id: string } | null)?.id ?? null

    if (!resultId) {
      const { data: created, error: insErr } = await supabase.from('matches_d').insert({
        scheduled_match_id: sched.id,
        team1_id: sched.team1_id,
        team1b_id: sched.team1b_id ?? null,
        team2_id: sched.team2_id,
        team2b_id: sched.team2b_id ?? null,
        goals1: state.wins_red,
        goals2: state.wins_white,
        city_code: cityCode,
        match_phase,
        notes: null,
      }).select('id').single()
      if (insErr) return `save result: ${insErr.message}`
      resultId = (created as { id: string } | null)?.id ?? null
    }

    if (resultId) {
      const { error: updErr } = await supabase.from('scheduled_matches')
        .update({ status: 'completed', result_id: resultId }).eq('id', sched.id)
      if (updErr) return `mark complete: ${updErr.message}`
    }
    return null
  }

  const { getMatchById, markComplete } = await import('@/lib/schedule-store')
  const sched = getMatchById(state.active_match_id)
  if (!sched || !sched.team2_id) return null
  const { addMatchD } = await import('@/lib/mock-store')
  const created = addMatchD({
    team1_id: sched.team1_id,
    team1b_id: sched.team1b_id ?? null,
    team2_id: sched.team2_id,
    team2b_id: sched.team2b_id ?? null,
    goals1: state.wins_red,
    goals2: state.wins_white,
    match_phase: match_phase as 'group' | 'extra' | 'penalties',
    notes: null,
    scheduled_match_id: sched.id,
  })
  markComplete(sched.id, created.id, null)
  return null
}
