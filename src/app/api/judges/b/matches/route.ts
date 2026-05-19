import { NextRequest, NextResponse } from 'next/server'
import type { MatchB } from '@/types/database'
import { getSession, requireCategory } from '@/lib/session'
import { isUuid } from '@/lib/uuid'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function GET() {
  const authz = await requireCategory('b')
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('matches_b').select('*').order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
  const { getMatchesB } = await import('@/lib/mock-store')
  return NextResponse.json(getMatchesB())
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.categories.includes('b')) return NextResponse.json({ error: 'Not assigned to category B' }, { status: 403 })

  const body = await req.json() as {
    team1_id: string; team2_id: string
    winner: 0 | 1 | 2; rounds1: number; rounds2: number
    match_number?: number | null
    starting_position?: MatchB['starting_position']
    notes?: string | null
  }
  if (!body.team1_id || !body.team2_id) return NextResponse.json({ error: 'Both teams required' }, { status: 400 })
  if (!isUuid(body.team1_id) || !isUuid(body.team2_id)) {
    return NextResponse.json({ error: 'team1_id/team2_id must be valid UUIDs' }, { status: 400 })
  }
  if (body.team1_id === body.team2_id) return NextResponse.json({ error: 'Teams must be different' }, { status: 400 })
  if (body.notes && body.notes.length > 500) return NextResponse.json({ error: 'Notes max 500 chars' }, { status: 400 })
  if (![0, 1, 2].includes(body.winner)) {
    return NextResponse.json({ error: 'winner must be 0 (draw), 1, or 2' }, { status: 400 })
  }
  const validRounds = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 5
  if (!validRounds(body.rounds1) || !validRounds(body.rounds2)) {
    return NextResponse.json({ error: 'rounds1/rounds2 must be integers in [0, 5]' }, { status: 400 })
  }

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('matches_b').insert(body).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await syncLiveStateFromMatchB(body)
    return NextResponse.json(data)
  }

  const { addMatchB } = await import('@/lib/mock-store')
  const created = addMatchB(body)
  await syncLiveStateFromMatchB(body)
  return NextResponse.json(created)
}

// When the judge records a final result directly (Record form / Edit), promote
// the field-display state to match_result so the public scoreboard updates.
async function syncLiveStateFromMatchB(body: {
  team1_id: string; team2_id: string
  winner: 0 | 1 | 2; rounds1: number; rounds2: number
  starting_position?: MatchB['starting_position']
}) {
  // Defense in depth: callers (POST) already validate UUIDs, but the .or() filter
  // below is built by string interpolation, so re-check here too.
  if (!isUuid(body.team1_id) || !isUuid(body.team2_id)) return
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: sched } = await supabase
      .from('scheduled_matches')
      .select('*')
      .eq('category', 'b')
      .or(`and(team1_id.eq.${body.team1_id},team2_id.eq.${body.team2_id}),and(team1_id.eq.${body.team2_id},team2_id.eq.${body.team1_id})`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!sched) return

    const swap = body.team1_id !== sched.team1_id
    const wins_red = swap ? body.rounds2 : body.rounds1
    const wins_white = swap ? body.rounds1 : body.rounds2
    const match_winner = body.winner === 0 ? 0 : body.winner === 1 ? (swap ? 2 : 1) : (swap ? 1 : 2)

    await supabase
      .from('live_match_state')
      .update({
        active_match_id: sched.id,
        phase: 'match_result',
        wins_red,
        wins_white,
        match_winner,
        starting_position: body.starting_position ?? 'face',
      })
      .eq('category', 'b')
    return
  }

  const { getSchedule } = await import('@/lib/schedule-store')
  const sched = getSchedule('b').find((s) =>
    (s.team1_id === body.team1_id && s.team2_id === body.team2_id) ||
    (s.team1_id === body.team2_id && s.team2_id === body.team1_id),
  )
  if (!sched) return
  const swap = body.team1_id !== sched.team1_id
  const wins_red = swap ? body.rounds2 : body.rounds1
  const wins_white = swap ? body.rounds1 : body.rounds2
  const match_winner = body.winner === 0 ? 0 : body.winner === 1 ? (swap ? 2 : 1) : (swap ? 1 : 2)
  const { setLiveB } = await import('@/lib/mock-store')
  setLiveB({
    active_match_id: sched.id,
    phase: 'match_result',
    wins_red,
    wins_white,
    match_winner: match_winner as 0 | 1 | 2,
    starting_position: body.starting_position ?? 'face',
  })
}

export async function DELETE(req: NextRequest) {
  const authz = await requireCategory('b')
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.from('matches_b').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  }

  const { deleteMatchB } = await import('@/lib/mock-store')
  deleteMatchB(id)
  return NextResponse.json({ ok: true })
}
