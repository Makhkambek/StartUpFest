import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Category A (Line Follower) — solo runs, no opponent
function buildSoloRuns(teamIds: string[], n: number): { team1_id: string; team2_id: null }[] {
  const runs: { team1_id: string; team2_id: null }[] = []
  for (let round = 0; round < n; round++) {
    const order = shuffle(teamIds)
    for (const id of order) {
      runs.push({ team1_id: id, team2_id: null })
    }
  }
  return runs
}

// Categories B/C/D — head-to-head pairings, one match per pair
function buildPairings(teamIds: string[], n: number): { team1_id: string; team2_id: string }[] {
  const pairs: { team1_id: string; team2_id: string }[] = []
  for (let round = 0; round < n; round++) {
    const order = shuffle(teamIds)
    for (let i = 0; i + 1 < order.length; i += 2) {
      pairs.push({ team1_id: order[i], team2_id: order[i + 1] })
    }
    if (order.length % 2 === 1) {
      pairs.push({ team1_id: order[order.length - 1], team2_id: order[0] })
    }
  }
  return pairs
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const body = await req.json() as { category: string; n: number }
  if (!body.category || !body.n || body.n < 1) {
    return NextResponse.json({ error: 'category and n required' }, { status: 400 })
  }
  if (body.n > 20) {
    return NextResponse.json({ error: 'n cannot exceed 20' }, { status: 400 })
  }

  const { getTeams } = await import('@/lib/data')
  const teams = await getTeams(body.category as 'a' | 'b' | 'c' | 'd')
  if (teams.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 teams' }, { status: 400 })
  }

  const pairs = body.category === 'a'
    ? buildSoloRuns(teams.map(t => t.id), body.n)
    : buildPairings(teams.map(t => t.id), body.n)

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const now = Date.now()
    const rows = pairs.map((p, i) => ({
      category: body.category,
      match_id: `Q-${i + 1}`,
      team1_id: p.team1_id,
      team2_id: p.team2_id,
      created_at: new Date(now + i).toISOString(),
    }))
    const { error } = await supabase.from('scheduled_matches').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ count: rows.length })
  }

  const { addScheduledMatch } = await import('@/lib/schedule-store')
  pairs.forEach((p, i) => {
    addScheduledMatch({ category: body.category, match_id: `Q-${i + 1}`, ...p })
  })
  return NextResponse.json({ count: pairs.length })
}
