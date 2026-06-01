import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import type { LiveStateB } from '@/types/database'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

type Method = 'KO' | 'IMM' | 'JD' | 'DRAW'
type Side = 'red' | 'white'

type Action =
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
  | { type: 'toggle_finals' }
  | { type: 'toggle_standby' }

// Default state returned when the DB hasn't been seeded yet. `category` must
// match the route ('c' for this file) so UI consumers don't misroute. We seed
// `updated_at` with the current time, not the epoch, so the public scoreboard
// doesn't render "Updated: 1970-01-01" on the first fetch.
const DEFAULT_STATE = {
  category: 'c' as const,
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
        .from('live_match_state').select('*').eq('category', 'c').eq('city_code', cityCode).maybeSingle()
      if (error || !data) return NextResponse.json({ ...DEFAULT_STATE, _migration_missing: !!error })
      return NextResponse.json(data)
    } catch {
      return NextResponse.json({ ...DEFAULT_STATE, _migration_missing: true })
    }
  }
  const { getLiveC } = await import('@/lib/mock-store')
  return NextResponse.json(getLiveC())
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && !session.categories.includes('c')) {
    return NextResponse.json({ error: 'Not assigned to category C' }, { status: 403 })
  }
  const action = (await req.json()) as Action
  if (!action?.type) return NextResponse.json({ error: 'type required' }, { status: 400 })

  const activeMatchIdBeforeReset = action.type === 'reset' ? (await readCurrentState())?.active_match_id ?? null : null

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
    return NextResponse.json(
      { error: upstreamError ?? 'Invalid action', action: action.type },
      { status: 400 },
    )
  }

  if (action.type === 'reset') {
    if (hasSupabase) {
      const cityCode = await getActiveCityCode()
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const supabase = createAdminClient()
      if (activeMatchIdBeforeReset) {
        await supabase.from('fights_c').delete().eq('scheduled_match_id', activeMatchIdBeforeReset).eq('city_code', cityCode)
        await supabase.from('scheduled_matches').update({ status: 'pending', result_id: null }).eq('id', activeMatchIdBeforeReset)
      }
    } else {
      if (activeMatchIdBeforeReset) {
        const { setMatchStatus } = await import('@/lib/schedule-store')
        setMatchStatus(activeMatchIdBeforeReset, 'pending')
      }
    }
  }

  // Persist to fights_c when match_winner is set.
  if (next.match_winner !== null && next.active_match_id) {
    await persistFightResult(next).catch(() => null)
  }
  return NextResponse.json(next)
}

async function readCurrentState(): Promise<LiveStateB | null> {
  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data } = await supabase
      .from('live_match_state').select('*').eq('category', 'c').eq('city_code', cityCode).maybeSingle()
    return (data as LiveStateB | null) ?? null
  }
  const { getLiveC } = await import('@/lib/mock-store')
  return getLiveC()
}

function clampScore(n: number): number {
  return Math.min(100, Math.round(n))
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
      return { phase: 'fighting', countdown_started_at: new Date().toISOString() }
    case 'add_score':
      return action.side === 'red'
        ? { wins_red: clampScore(c.wins_red + action.delta) }
        : { wins_white: clampScore(c.wins_white + action.delta) }
    case 'win_ko': {
      // KO · Red means "Red was knocked out" → Red is the LOSER, opposite side wins.
      // Per rulebook, judge scores apply only to JD — winner gets 100, loser gets 0.
      const winner: Side = action.side === 'red' ? 'white' : 'red'
      const winsRed   = winner === 'red'   ? 100 : 0
      const winsWhite = winner === 'white' ? 100 : 0
      return {
        phase: 'round_result',
        wins_red: winsRed,
        wins_white: winsWhite,
        match_winner: winner === 'red' ? 1 : 2,
        last_round_winner: winner,
        starting_position: 'face' as const,  // re-used to flag KO method
        round_history: [{ method: 'KO', winner, score_a: winsRed, score_b: winsWhite }] as unknown as LiveStateB['round_history'],
      }
    }
    case 'win_imm': {
      // IMM · Red means "Red was immobilized" → Red is the LOSER, opposite side wins.
      const winner: Side = action.side === 'red' ? 'white' : 'red'
      const winsRed   = winner === 'red'   ? 100 : 0
      const winsWhite = winner === 'white' ? 100 : 0
      return {
        phase: 'round_result',
        wins_red: winsRed,
        wins_white: winsWhite,
        match_winner: winner === 'red' ? 1 : 2,
        last_round_winner: winner,
        starting_position: 'side' as const,  // = IMM
        round_history: [{ method: 'IMM', winner, score_a: winsRed, score_b: winsWhite }] as unknown as LiveStateB['round_history'],
      }
    }
    case 'win_jd': {
      const winner: Side | 'draw' =
        c.wins_red > c.wins_white ? 'red'
        : c.wins_white > c.wins_red ? 'white'
        : 'draw'
      const mw = winner === 'red' ? 1 : winner === 'white' ? 2 : 0
      return {
        phase: 'round_result',
        match_winner: mw,
        last_round_winner: winner,
        starting_position: 'back' as const,  // = JD
        round_history: [{ method: 'JD', winner, score_a: c.wins_red, score_b: c.wins_white }] as unknown as LiveStateB['round_history'],
      }
    }
    case 'end_match':
      return { phase: 'match_result', match_winner: c.wins_red > c.wins_white ? 1 : c.wins_white > c.wins_red ? 2 : 0 }
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
  const cur = m.getLiveC()
  const patch = buildPatch(action, cur)
  return m.setLiveC(patch)
}

async function applySupabase(action: Action): Promise<{ state: LiveStateB | null; error: string | null }> {
  const cityCode = await getActiveCityCode()
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: cur, error: readErr } = await supabase
    .from('live_match_state').select('*').eq('category', 'c').eq('city_code', cityCode).maybeSingle()
  if (readErr) {
    console.error('[live/c] select error:', readErr.message)
    return { state: null, error: `select: ${readErr.message}` }
  }

  if (!cur) {
    const { error: insErr } = await supabase
      .from('live_match_state')
      .insert({ category: 'c', city_code: cityCode })
    if (insErr) {
      console.error('[live/c] seed insert error:', insErr.message)
      return { state: null, error: `seed: ${insErr.message}` }
    }
  }

  const patch = buildPatch(action, (cur as LiveStateB | null) ?? null)

  const { data, error } = await supabase
    .from('live_match_state')
    .update(patch)
    .eq('category', 'c')
    .eq('city_code', cityCode)
    .select()
    .maybeSingle()
  if (error) {
    console.error('[live/c] update error:', error.message)
    return { state: null, error: `update: ${error.message}` }
  }
  return { state: (data as LiveStateB | null) ?? null, error: null }
}

async function persistFightResult(state: LiveStateB) {
  if (!state.active_match_id) return

  // Read method from starting_position hack (face=KO, side=IMM, back=JD, null=DRAW).
  const winner: 0 | 1 | 2 = state.match_winner === 1 ? 1 : state.match_winner === 2 ? 2 : 0
  const method: Method =
    winner === 0 ? 'DRAW'
    : state.starting_position === 'face' ? 'KO'
    : state.starting_position === 'side' ? 'IMM'
    : 'JD'

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: sched } = await supabase
      .from('scheduled_matches').select('*').eq('id', state.active_match_id).maybeSingle()
    if (!sched || !sched.team2_id) return

    const { data: fight } = await supabase.from('fights_c').insert({
      scheduled_match_id: sched.id,
      team1_id: sched.team1_id,
      team2_id: sched.team2_id,
      winner,
      method,
      judge_score1: state.wins_red,
      judge_score2: state.wins_white,
      city_code: cityCode,
      notes: null,
    }).select().single()
    if (fight?.id) {
      await supabase.from('scheduled_matches').update({ status: 'completed', result_id: fight.id }).eq('id', sched.id)
    }
    return
  }

  const { getMatchById, markComplete } = await import('@/lib/schedule-store')
  const sched = getMatchById(state.active_match_id)
  if (!sched || !sched.team2_id) return
  const { addFightC } = await import('@/lib/mock-store')
  const fight = addFightC({
    team1_id: sched.team1_id,
    team2_id: sched.team2_id,
    winner,
    method,
    judge_score1: state.wins_red,
    judge_score2: state.wins_white,
    notes: null,
    scheduled_match_id: sched.id,
  })
  markComplete(sched.id, fight.id, null)
}
