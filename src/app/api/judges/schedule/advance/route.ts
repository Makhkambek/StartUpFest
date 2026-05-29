import { NextRequest, NextResponse } from 'next/server'
import type { Category } from '@/types/database'
import type { MatchRound } from '@/lib/schedule-store'
import { getTeams, getMatchesB, getMatchesD } from '@/lib/data'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function requireAdmin() {
  const { getSession } = await import('@/lib/session')
  const session = await getSession()
  if (!session) return { ok: false as const, status: 401, error: 'Unauthorized' }
  if (session.role !== 'admin') return { ok: false as const, status: 403, error: 'Admin only' }
  return { ok: true as const }
}

interface PlannedMatch {
  match_id: string
  team1_id: string
  team2_id: string | null
  round: MatchRound
}

// ── Cat B: R1 → R2 → triangle (FB-F1/F2/F3) ───────────
async function advanceB(cityCode: string): Promise<{ matches: PlannedMatch[]; warning?: string; round: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: finalsMatches } = await supabase
    .from('scheduled_matches')
    .select('id, match_id, team1_id, team2_id, round, status')
    .eq('category', 'b')
    .eq('city_code', cityCode)
    .eq('phase', 'finals')

  if (!finalsMatches || finalsMatches.length === 0) {
    return { matches: [], warning: 'No finals scheduled yet — use "Generate Finals" first', round: '' }
  }

  const r2 = finalsMatches.filter(m => m.round === 'r2')
  const r1 = finalsMatches.filter(m => m.round === 'r1')
  const triangle = finalsMatches.filter(m => m.round === 'triangle')

  if (triangle.length > 0) {
    return { matches: [], warning: 'Triangle final already generated', round: 'triangle' }
  }

  const resultsB = await getMatchesB()
  const winnerOf = (scheduledId: string, team1Id: string, team2Id: string): string | null => {
    const r = resultsB.find(x => x.id === scheduledId)
    if (!r) return null
    if (r.winner === 1) return team1Id
    if (r.winner === 2) return team2Id
    return null
  }

  // R2 done → generate triangle
  if (r2.length > 0 && r2.every(m => m.status === 'completed')) {
    const winners = r2
      .map(m => m.team2_id ? winnerOf(m.id, m.team1_id, m.team2_id) : null)
      .filter((x): x is string => !!x)
    if (winners.length < 3) {
      return { matches: [], warning: `Need 3 R2 winners for triangle, got ${winners.length}`, round: 'r2' }
    }
    const top3 = winners.slice(0, 3)
    return {
      round: 'triangle',
      matches: [
        { match_id: 'FB-F1', team1_id: top3[0], team2_id: top3[1], round: 'triangle' },
        { match_id: 'FB-F2', team1_id: top3[1], team2_id: top3[2], round: 'triangle' },
        { match_id: 'FB-F3', team1_id: top3[0], team2_id: top3[2], round: 'triangle' },
      ],
    }
  }

  // R1 done → generate R2 (pair winners)
  if (r1.length > 0 && r1.every(m => m.status === 'completed')) {
    const r1Sorted = [...r1].sort((a, b) => a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
    const winners = r1Sorted
      .map(m => m.team2_id ? winnerOf(m.id, m.team1_id, m.team2_id) : null)
      .filter((x): x is string => !!x)
    if (winners.length < 2) {
      return { matches: [], warning: `Need at least 2 R1 winners for R2, got ${winners.length}`, round: 'r1' }
    }
    const planned: PlannedMatch[] = []
    for (let i = 0; i + 1 < winners.length; i += 2) {
      planned.push({
        match_id: `FB-R2-${planned.length + 1}`,
        team1_id: winners[i],
        team2_id: winners[i + 1],
        round: 'r2',
      })
    }
    return { matches: planned, round: 'r2' }
  }

  return { matches: [], warning: 'Previous round not complete yet', round: '' }
}

// ── Cat D: QF → SF → F1 + 3RD ─────────────────────────
async function advanceD(cityCode: string): Promise<{ matches: PlannedMatch[]; warning?: string; round: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: finalsMatches } = await supabase
    .from('scheduled_matches')
    .select('id, match_id, team1_id, team2_id, round, status')
    .eq('category', 'd')
    .eq('city_code', cityCode)
    .eq('phase', 'finals')

  if (!finalsMatches || finalsMatches.length === 0) {
    return { matches: [], warning: 'No finals scheduled yet — use "Generate Finals" first', round: '' }
  }

  const qf = finalsMatches.filter(m => m.round === 'quarter')
  const sf = finalsMatches.filter(m => m.round === 'semi')
  const final = finalsMatches.filter(m => m.round === 'final' || m.round === 'third_place')

  if (final.length > 0) {
    return { matches: [], warning: 'Final + 3rd-place already generated', round: 'final' }
  }

  const matchesD = await getMatchesD()
  const winnerLoserOf = (scheduledId: string, team1Id: string, team2Id: string): { winner: string | null; loser: string | null } => {
    const r = matchesD.find(x => x.id === scheduledId)
    if (!r) return { winner: null, loser: null }
    if (r.goals1 > r.goals2) return { winner: team1Id, loser: team2Id }
    if (r.goals2 > r.goals1) return { winner: team2Id, loser: team1Id }
    return { winner: null, loser: null } // tie — admin must resolve manually
  }

  // SF done → F1 + 3RD
  if (sf.length === 2 && sf.every(m => m.status === 'completed')) {
    const sfSorted = [...sf].sort((a, b) => a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
    const r1 = sfSorted[0].team2_id ? winnerLoserOf(sfSorted[0].id, sfSorted[0].team1_id, sfSorted[0].team2_id) : { winner: null, loser: null }
    const r2 = sfSorted[1].team2_id ? winnerLoserOf(sfSorted[1].id, sfSorted[1].team1_id, sfSorted[1].team2_id) : { winner: null, loser: null }
    if (!r1.winner || !r2.winner || !r1.loser || !r2.loser) {
      return { matches: [], warning: 'SF results incomplete or tied — record winners first', round: 'semi' }
    }
    return {
      round: 'final',
      matches: [
        { match_id: 'FD-3RD', team1_id: r1.loser,  team2_id: r2.loser,  round: 'third_place' },
        { match_id: 'FD-F1',  team1_id: r1.winner, team2_id: r2.winner, round: 'final' },
      ],
    }
  }

  // QF done → SF
  if (qf.length === 4 && qf.every(m => m.status === 'completed')) {
    const qfSorted = [...qf].sort((a, b) => a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
    const winners = qfSorted
      .map(m => m.team2_id ? winnerLoserOf(m.id, m.team1_id, m.team2_id).winner : null)
      .filter((x): x is string => !!x)
    if (winners.length < 4) {
      return { matches: [], warning: `Need 4 QF winners for SF, got ${winners.length}`, round: 'quarter' }
    }
    return {
      round: 'semi',
      matches: [
        { match_id: 'FD-SF1', team1_id: winners[0], team2_id: winners[1], round: 'semi' },
        { match_id: 'FD-SF2', team1_id: winners[2], team2_id: winners[3], round: 'semi' },
      ],
    }
  }

  return { matches: [], warning: 'Previous round not complete yet', round: '' }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  if (!hasSupabase) {
    return NextResponse.json({ error: 'Advance is Supabase-only (mock mode uses /finals)' }, { status: 400 })
  }

  const { category } = await req.json() as { category: Category }
  if (!category || !['a', 'b', 'c', 'd'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (category === 'a' || category === 'c') {
    return NextResponse.json({ error: `Cat ${category.toUpperCase()} advance not supported — manage finals manually` }, { status: 400 })
  }

  const cityCode = await getActiveCityCode()

  // Touch teams to surface any auth issues early
  await getTeams(category)

  const plan = category === 'b' ? await advanceB(cityCode) : await advanceD(cityCode)

  if (plan.matches.length === 0) {
    return NextResponse.json({ error: plan.warning ?? 'Cannot advance' }, { status: 400 })
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const now = Date.now()
  const rows = plan.matches.map((m, i) => ({
    category,
    match_id: m.match_id,
    team1_id: m.team1_id,
    team2_id: m.team2_id,
    city_code: cityCode,
    phase: 'finals' as const,
    round: m.round,
    status: 'pending' as const,
    created_at: new Date(now + i).toISOString(),
  }))
  const { error } = await supabase.from('scheduled_matches').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, count: plan.matches.length, round: plan.round })
}
