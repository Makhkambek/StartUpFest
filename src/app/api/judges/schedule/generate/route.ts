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
// Line Follower (category A) — each team gets `n` consecutive Qs so the team
// stays on the track for all of its attempts back-to-back. Judges hated the
// previous round-robin layout (B → A → C → B → A → C) because between B's two
// runs they had to swap robots twice. Now the order is B → B → A → A → C → C:
// one team finishes its block, then move to the next.
// The team ORDER is shuffled so the first team to run varies each event,
// but a team's own Qs are always adjacent.
function buildSoloRuns(teamIds: string[], n: number): { team1_id: string; team2_id: null }[] {
  const order = shuffle(teamIds)
  const runs: { team1_id: string; team2_id: null }[] = []
  for (const id of order) {
    for (let i = 0; i < n; i++) {
      runs.push({ team1_id: id, team2_id: null })
    }
  }
  return runs
}

// Categories B/C — head-to-head pairings, one match per pair
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

function alliancesPossible(teamCount: number): number {
  return Math.floor(teamCount / 4)
}

// Bug #19 helpers — count and clear qualification matches before regenerating.
async function countQualificationMatches(category: string): Promise<number> {
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { count } = await supabase
      .from('scheduled_matches')
      .select('id', { count: 'exact', head: true })
      .eq('category', category)
      .like('match_id', 'Q-%')
    return count ?? 0
  }
  const { getSchedule } = await import('@/lib/schedule-store')
  return getSchedule(category).filter(m => m.match_id.startsWith('Q-')).length
}

async function clearQualificationMatches(category: string) {
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase
      .from('scheduled_matches')
      .delete()
      .eq('category', category)
      .like('match_id', 'Q-%')
    return
  }
  const { getSchedule, deleteScheduledMatch } = await import('@/lib/schedule-store')
  for (const m of getSchedule(category)) {
    if (m.match_id.startsWith('Q-')) deleteScheduledMatch(m.id)
  }
}

// Category D (Robo Football) — alliance pairings: 4 teams per match (2 vs 2).
// Each match: red alliance = team1+team1b, blue alliance = team2+team2b.
function buildAlliances(teamIds: string[], n: number): {
  team1_id: string; team1b_id: string; team2_id: string; team2b_id: string
}[] {
  const out: { team1_id: string; team1b_id: string; team2_id: string; team2b_id: string }[] = []
  for (let round = 0; round < n; round++) {
    const order = shuffle(teamIds)
    // Take groups of 4 — each becomes one alliance match.
    for (let i = 0; i + 3 < order.length; i += 4) {
      out.push({
        team1_id: order[i],
        team1b_id: order[i + 1],
        team2_id: order[i + 2],
        team2b_id: order[i + 3],
      })
    }
  }
  return out
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const body = await req.json() as { category: string; n: number; replace?: boolean }
  if (!body.category || !body.n || body.n < 1) {
    return NextResponse.json({ error: 'category and n required' }, { status: 400 })
  }
  if (body.n > 20) {
    return NextResponse.json({ error: 'n cannot exceed 20' }, { status: 400 })
  }
  if (!['a', 'b', 'c', 'd'].includes(body.category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  // Bug #19 fix: refuse to silently append to an existing schedule. Caller must
  // opt into `replace: true` to wipe and regenerate (or use a separate flow to
  // delete first). Otherwise we'd duplicate every match on repeated calls.
  const existingCount = await countQualificationMatches(body.category)
  if (existingCount > 0 && !body.replace) {
    return NextResponse.json({
      error: `Schedule already has ${existingCount} matches for category ${body.category.toUpperCase()}. Pass { replace: true } to regenerate.`,
      existingCount,
    }, { status: 409 })
  }
  if (body.replace && existingCount > 0) {
    await clearQualificationMatches(body.category)
  }

  const { getTeams } = await import('@/lib/data')
  const teams = await getTeams(body.category as 'a' | 'b' | 'c' | 'd')
  const minTeams = body.category === 'd' ? 4 : 2
  if (teams.length < minTeams) {
    return NextResponse.json({
      error: body.category === 'd' ? 'Need at least 4 teams for alliance matches' : 'Need at least 2 teams',
    }, { status: 400 })
  }

  if (body.category === 'a') {
    const runs = buildSoloRuns(teams.map((t) => t.id), body.n)
    if (hasSupabase) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const now = Date.now()
      const rows = runs.map((p, i) => ({
        category: 'a',
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
    runs.forEach((p, i) => addScheduledMatch({ category: 'a', match_id: `Q-${i + 1}`, ...p }))
    return NextResponse.json({ count: runs.length })
  }

  if (body.category === 'd') {
    if (alliancesPossible(teams.length) === 0) {
      return NextResponse.json({ error: `Need at least 4 teams for alliance matches (you have ${teams.length})` }, { status: 400 })
    }
    const alliances = buildAlliances(teams.map((t) => t.id), body.n)
    if (hasSupabase) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const now = Date.now()
      const rows = alliances.map((a, i) => ({
        category: 'd',
        match_id: `Q-${i + 1}`,
        team1_id: a.team1_id,
        team1b_id: a.team1b_id,
        team2_id: a.team2_id,
        team2b_id: a.team2b_id,
        created_at: new Date(now + i).toISOString(),
      }))
      const { error } = await supabase.from('scheduled_matches').insert(rows)
      if (error) {
        const isMissingCol = /team1b_id|team2b_id|schema cache/i.test(error.message)
        if (isMissingCol) {
          return NextResponse.json({
            error: `Migration 015 not applied. Run in Supabase SQL Editor: ALTER TABLE scheduled_matches ADD COLUMN team1b_id UUID REFERENCES teams(id), ADD COLUMN team2b_id UUID REFERENCES teams(id);`,
            needsMigration: '015_alliance_partners',
          }, { status: 500 })
        }
        return NextResponse.json({ error: `Generate failed: ${error.message}` }, { status: 500 })
      }
      return NextResponse.json({ count: rows.length, format: 'alliance-4' })
    }
    const { addScheduledMatch } = await import('@/lib/schedule-store')
    alliances.forEach((a, i) => addScheduledMatch({
      category: 'd',
      match_id: `Q-${i + 1}`,
      team1_id: a.team1_id,
      team1b_id: a.team1b_id,
      team2_id: a.team2_id,
      team2b_id: a.team2b_id,
    }))
    return NextResponse.json({ count: alliances.length, format: 'alliance-4' })
  }

  // B / C — head-to-head pairs
  const pairs = buildPairings(teams.map((t) => t.id), body.n)
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
  pairs.forEach((p, i) => addScheduledMatch({ category: body.category, match_id: `Q-${i + 1}`, ...p }))
  return NextResponse.json({ count: pairs.length })
}
