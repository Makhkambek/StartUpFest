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

// ── Cat B: QF→SF→Final+3rd (v1.1) and R1→R2→Final+3rd/Triangle (v1.0 compat) ──
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

  // v1.1 rounds
  const qf       = finalsMatches.filter(m => m.round === 'quarter')
  const sf        = finalsMatches.filter(m => m.round === 'semi')
  // v1.0 rounds
  const r1        = finalsMatches.filter(m => m.round === 'r1')
  const r2        = finalsMatches.filter(m => m.round === 'r2')
  const triangle  = finalsMatches.filter(m => m.round === 'triangle')
  // shared final rounds
  const finalRounds = finalsMatches.filter(m => m.round === 'final' || m.round === 'third_place')

  if (finalRounds.length > 0) return { matches: [], warning: 'Final already generated', round: 'final' }
  if (triangle.length > 0) return { matches: [], warning: 'Triangle final already generated', round: 'triangle' }

  const resultsB = await getMatchesB()
  const winnerOf = (scheduledId: string, t1: string, t2: string): string | null => {
    const r = resultsB.find(x => x.scheduled_match_id === scheduledId)
    if (!r) return null
    return r.winner === 1 ? t1 : r.winner === 2 ? t2 : null
  }
  const loserOf = (scheduledId: string, t1: string, t2: string): string | null => {
    const r = resultsB.find(x => x.scheduled_match_id === scheduledId)
    if (!r) return null
    return r.winner === 1 ? t2 : r.winner === 2 ? t1 : null
  }

  // ── v1.1: SF done → Final + 3rd Place ───────────────────────────────────
  if (sf.length === 2 && sf.every(m => m.status === 'completed')) {
    const sorted = [...sf].sort((a, b) => a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
    const w1 = sorted[0].team2_id ? winnerOf(sorted[0].id, sorted[0].team1_id, sorted[0].team2_id) : null
    const l1 = sorted[0].team2_id ? loserOf(sorted[0].id, sorted[0].team1_id, sorted[0].team2_id) : null
    const w2 = sorted[1].team2_id ? winnerOf(sorted[1].id, sorted[1].team1_id, sorted[1].team2_id) : null
    const l2 = sorted[1].team2_id ? loserOf(sorted[1].id, sorted[1].team1_id, sorted[1].team2_id) : null
    if (!w1 || !w2 || !l1 || !l2) return { matches: [], warning: 'SF results incomplete or tied — record winners first', round: 'semi' }
    return {
      round: 'final',
      matches: [
        { match_id: 'FB-3RD', team1_id: l1, team2_id: l2, round: 'third_place' },
        { match_id: 'FB-F1',  team1_id: w1, team2_id: w2, round: 'final' },
      ],
    }
  }

  // ── v1.1: QF done → SF ──────────────────────────────────────────────────
  if (qf.length >= 2 && qf.every(m => m.status === 'completed')) {
    const sorted = [...qf].sort((a, b) => a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
    const winners = sorted.map(m => m.team2_id ? winnerOf(m.id, m.team1_id, m.team2_id) : null).filter((x): x is string => !!x)
    if (winners.length < 2) return { matches: [], warning: `Record all QF results first (winners: ${winners.length})`, round: 'quarter' }
    const matches: PlannedMatch[] = []
    for (let i = 0; i + 1 < winners.length; i += 2) {
      matches.push({ match_id: `FB-SF${matches.length + 1}`, team1_id: winners[i], team2_id: winners[i + 1], round: 'semi' })
    }
    return { round: 'semi', matches }
  }

  // ── v1.0: R2 done → Final+3rd (2 winners) or Triangle (3 winners) ───────
  if (r2.length > 0 && r2.every(m => m.status === 'completed')) {
    const sorted = [...r2].sort((a, b) => a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
    const winners = sorted.map(m => m.team2_id ? winnerOf(m.id, m.team1_id, m.team2_id) : null).filter((x): x is string => !!x)
    const losers  = sorted.map(m => m.team2_id ? loserOf(m.id, m.team1_id, m.team2_id) : null).filter((x): x is string => !!x)
    if (winners.length < 2) return { matches: [], warning: `Record all R2 results first (winners: ${winners.length})`, round: 'r2' }
    if (winners.length === 2) {
      return {
        round: 'final',
        matches: [
          { match_id: 'FB-3RD', team1_id: losers[0], team2_id: losers[1], round: 'third_place' },
          { match_id: 'FB-F1',  team1_id: winners[0], team2_id: winners[1], round: 'final' },
        ],
      }
    }
    const [a, b, c] = winners
    return {
      round: 'triangle',
      matches: [
        { match_id: 'FB-T1', team1_id: a, team2_id: b, round: 'triangle' },
        { match_id: 'FB-T2', team1_id: b, team2_id: c, round: 'triangle' },
        { match_id: 'FB-T3', team1_id: a, team2_id: c, round: 'triangle' },
      ],
    }
  }

  // ── v1.0: R1 done → R2 ──────────────────────────────────────────────────
  if (r1.length > 0 && r1.every(m => m.status === 'completed')) {
    const sorted = [...r1].sort((a, b) => a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
    const winners = sorted.map(m => m.team2_id ? winnerOf(m.id, m.team1_id, m.team2_id) : null).filter((x): x is string => !!x)
    if (winners.length < 2) return { matches: [], warning: `Record all R1 results first (winners: ${winners.length})`, round: 'r1' }
    const matches: PlannedMatch[] = []
    for (let i = 0; i + 1 < winners.length; i += 2) {
      matches.push({ match_id: `FB-R2-${matches.length + 1}`, team1_id: winners[i], team2_id: winners[i + 1], round: 'r2' })
    }
    return { round: 'r2', matches }
  }

  return { matches: [], warning: 'Previous round not complete yet', round: '' }
}

// Cat D finals use round-robin (3 matches generated all at once by /finals).
// "Advance" is not needed — return a clear message so the UI button can be hidden.
async function advanceD(_cityCode: string): Promise<{ matches: PlannedMatch[]; warning?: string; round: string }> {
  return { matches: [], warning: 'Cat D uses round-robin finals — all 3 matches are generated at once via "Generate Finals". No advancement needed.', round: '' }
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
