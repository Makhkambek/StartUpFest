import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import type { LivePhaseB, LiveStateB, RoundOutcome, StartingPosition } from '@/types/database'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

type Action =
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

const DEFAULT_STATE_B = {
  category: 'b' as const,
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
  updated_at: new Date(0).toISOString(),
}

export async function GET() {
  if (hasSupabase) {
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data, error } = await supabase.from('live_match_state').select('*').eq('category', 'b').maybeSingle()
      if (error || !data) {
        return NextResponse.json({ ...DEFAULT_STATE_B, _migration_missing: !!error })
      }
      return NextResponse.json(data)
    } catch {
      return NextResponse.json({ ...DEFAULT_STATE_B, _migration_missing: true })
    }
  }
  const { getLiveB } = await import('@/lib/mock-store')
  return NextResponse.json(getLiveB())
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin' && !session.categories.includes('b')) {
    return NextResponse.json({ error: 'Not assigned to category B' }, { status: 403 })
  }

  const action = (await req.json()) as Action
  if (!action?.type) return NextResponse.json({ error: 'type required' }, { status: 400 })

  if (hasSupabase) {
    const next = await applySupabase(action)
    if (!next) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    if (action.type === 'end_match') await persistMatchSupabase(next)
    return NextResponse.json(next)
  }

  const next = await applyMock(action)
  if (!next) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  if (action.type === 'end_match') await persistMatchMock(next)
  return NextResponse.json(next)
}

// ── Persist final result to matches_b so standings see it ─────────────

async function persistMatchMock(state: LiveStateB) {
  if (!state.active_match_id) return
  const { getMatchById, markComplete } = await import('@/lib/schedule-store')
  const sched = getMatchById(state.active_match_id)
  if (!sched || !sched.team2_id) return
  const { addMatchB } = await import('@/lib/mock-store')
  const created = addMatchB({
    team1_id: sched.team1_id,
    team2_id: sched.team2_id,
    winner: (state.match_winner ?? 0) as 0 | 1 | 2,
    rounds1: state.wins_red,
    rounds2: state.wins_white,
    starting_position: state.starting_position ?? 'face',
    notes: null,
  })
  markComplete(sched.id, created.id, null)
}

async function persistMatchSupabase(state: LiveStateB) {
  if (!state.active_match_id) return
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: sched } = await supabase
    .from('scheduled_matches').select('*').eq('id', state.active_match_id).maybeSingle()
  if (!sched || !sched.team2_id) return

  const { data: created } = await supabase.from('matches_b').insert({
    scheduled_match_id: sched.id,
    team1_id: sched.team1_id,
    team2_id: sched.team2_id,
    winner: state.match_winner ?? 0,
    rounds1: state.wins_red,
    rounds2: state.wins_white,
    starting_position: state.starting_position ?? 'face',
    notes: null,
  }).select().single()

  if (created?.id) {
    await supabase
      .from('scheduled_matches')
      .update({ status: 'completed', result_id: created.id })
      .eq('id', sched.id)
  }
}

async function applyMock(action: Action): Promise<LiveStateB | null> {
  const m = await import('@/lib/mock-store')
  switch (action.type) {
    case 'start_match': return m.liveB_startMatch(action.active_match_id)
    case 'set_position': return m.liveB_setPosition(action.position)
    case 'start_countdown': return m.liveB_startCountdown()
    case 'cancel_countdown': return m.liveB_cancelCountdown()
    case 'go_fight': return m.liveB_goFight()
    case 'round_result': return m.liveB_roundResult(action.outcome)
    case 'next_round': return m.liveB_nextRound()
    case 'end_match': return m.liveB_endMatch(action.winner)
    case 'foul': return m.liveB_addFoul(action.side)
    case 'set_phase': return m.liveB_setPhase(action.phase)
    case 'reset': return m.resetLiveB()
  }
}

async function applySupabase(action: Action): Promise<LiveStateB | null> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: current } = await supabase.from('live_match_state').select('*').eq('category', 'b').maybeSingle()
  const cur = (current as LiveStateB | null) ?? null

  const patch: Partial<LiveStateB> = {}
  switch (action.type) {
    case 'start_match':
      Object.assign(patch, {
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
      })
      break
    case 'set_position':
      Object.assign(patch, { phase: 'positioning', starting_position: action.position })
      break
    case 'start_countdown':
      Object.assign(patch, { phase: 'countdown', countdown_started_at: new Date().toISOString() })
      break
    case 'cancel_countdown':
      Object.assign(patch, { phase: 'positioning', countdown_started_at: null })
      break
    case 'go_fight':
      // Anchor fight start (countdown_started_at − 5s = fight_start). If no countdown
      // was used, set anchor to (now − 5s) so /field can render a count-up timer.
      Object.assign(patch, {
        phase: 'fighting',
        countdown_started_at: new Date(Date.now() - 5000).toISOString(),
      })
      break
    case 'round_result': {
      const hist = [...(cur?.round_history ?? []), action.outcome]
      Object.assign(patch, {
        phase: 'round_result',
        last_round_winner: action.outcome,
        wins_red: (cur?.wins_red ?? 0) + (action.outcome === 'red' ? 1 : 0),
        wins_white: (cur?.wins_white ?? 0) + (action.outcome === 'white' ? 1 : 0),
        round_history: hist,
      })
      break
    }
    case 'next_round':
      Object.assign(patch, {
        phase: 'positioning',
        round_number: (cur?.round_number ?? 1) + 1,
        last_round_winner: null,
        starting_position: null,
        countdown_started_at: null,
      })
      break
    case 'end_match':
      Object.assign(patch, { phase: 'match_result', match_winner: action.winner })
      break
    case 'foul': {
      // Atomic counter increment via migration 018's inc_live_counter RPC.
      // Read-compute-write would race when two judges submit a foul concurrently.
      const col = action.side === 'red' ? 'fouls_red' : 'fouls_white'
      const { data: row, error: rpcErr } = await supabase.rpc('inc_live_counter', {
        p_category: 'b',
        p_column: col,
        p_delta: 1,
      })
      if (rpcErr) throw rpcErr
      // Reflect the authoritative new counter back into the patch so subsequent
      // assignments inside this handler stay in sync with the DB.
      if (action.side === 'red') patch.fouls_red = (row as { fouls_red: number } | null)?.fouls_red ?? 0
      else patch.fouls_white = (row as { fouls_white: number } | null)?.fouls_white ?? 0
      break
    }
    case 'set_phase':
      patch.phase = action.phase
      break
    case 'reset':
      Object.assign(patch, {
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
      })
      break
  }

  const { data, error } = await supabase
    .from('live_match_state')
    .update(patch)
    .eq('category', 'b')
    .select()
    .maybeSingle()
  if (error) return null
  return (data as LiveStateB | null) ?? null
}
