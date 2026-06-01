import { NextRequest, NextResponse } from 'next/server'
import type { Category } from '@/types/database'
import type { MatchRound } from '@/lib/schedule-store'
import { computeStandingsA } from '@/lib/standings/a'
import { computeStandingsB } from '@/lib/standings/b'
import { computeStandingsC } from '@/lib/standings/c'
import { computeStandingsD } from '@/lib/standings/d'
import { getTeams, getResultsA, getMatchesB, getMatchesD, getFightsC } from '@/lib/data'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function requireAdmin() {
  const { getSession } = await import('@/lib/session')
  const session = await getSession()
  if (!session) return { ok: false as const, status: 401, error: 'Unauthorized' }
  if (session.role !== 'admin') return { ok: false as const, status: 403, error: 'Admin only' }
  return { ok: true as const }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface PlannedMatch {
  match_id: string
  team1_id: string
  team2_id: string | null
  round: MatchRound
}

async function planFinalsA(): Promise<{ matches: PlannedMatch[]; warning?: string }> {
  const teams = await getTeams('a')
  const results = await getResultsA()
  const standings = computeStandingsA(teams, results)
  const top4 = shuffle(standings.slice(0, 4))
  if (top4.length < 4) return { matches: [], warning: `Only ${top4.length} teams ranked — need 4 for finals` }
  return {
    matches: [
      { match_id: 'FA-SF1', team1_id: top4[0].team.id, team2_id: top4[1].team.id, round: 'semi' },
      { match_id: 'FA-SF2', team1_id: top4[2].team.id, team2_id: top4[3].team.id, round: 'semi' },
    ],
  }
}

async function planFinalsB(): Promise<{ matches: PlannedMatch[]; warning?: string }> {
  const teams = await getTeams('b')
  const results = await getMatchesB()
  const standings = computeStandingsB(teams, results)

  // Top 12 globally → 6 R1 matches (single elimination round 1)
  const seeded = shuffle(standings.slice(0, 12))
  if (seeded.length < 6) return { matches: [], warning: `Only ${seeded.length} teams ranked — need at least 6 for R1` }

  const matches: PlannedMatch[] = []
  for (let i = 0; i + 1 < seeded.length; i += 2) {
    matches.push({
      match_id: `FB-R1-${matches.length + 1}`,
      team1_id: seeded[i].team.id,
      team2_id: seeded[i + 1].team.id,
      round: 'r1',
    })
  }
  return { matches }
}

// Cat C finals — two steps:
//   step='semi'  → FC-SF1 (rank1 vs rank4), FC-SF2 (rank2 vs rank3)
//   step='final' → FC-F1 (SF winners), FC-3RD (SF losers) — reads SF results
async function planFinalsC(step: 'semi' | 'final', cityCode: string): Promise<{ matches: PlannedMatch[]; warning?: string }> {
  const teams = await getTeams('c')
  const fights = await getFightsC()
  const standings = computeStandingsC(teams, fights)

  if (step === 'semi') {
    if (standings.length < 4) return { matches: [], warning: `Only ${standings.length} teams — need 4 for semis` }
    const [s1, s2, s3, s4] = standings.slice(0, 4).map(s => s.team.id)
    return {
      matches: [
        { match_id: 'FC-SF1', team1_id: s1, team2_id: s4, round: 'semi' }, // 1st vs 4th
        { match_id: 'FC-SF2', team1_id: s2, team2_id: s3, round: 'semi' }, // 2nd vs 3rd
      ],
    }
  }

  // step='final': read SF results to determine winners/losers
  let sfFights: Array<{ scheduled_match_id: string | null; winner: number; team1_id: string; team2_id: string }> = []
  let sfSchedule: Array<{ id: string; match_id: string; team1_id: string; team2_id: string }> = []

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: sf } = await supabase.from('scheduled_matches').select('*')
      .eq('category', 'c').eq('city_code', cityCode).eq('phase', 'finals').in('round', ['semi'])
    sfSchedule = (sf ?? []) as typeof sfSchedule
    if (sfSchedule.length > 0) {
      const ids = sfSchedule.map(m => m.id)
      const { data: ff } = await supabase.from('fights_c').select('*').in('scheduled_match_id', ids)
      sfFights = (ff ?? []) as typeof sfFights
    }
  } else {
    const { getSchedule } = await import('@/lib/schedule-store')
    sfSchedule = getSchedule('c').filter(m => m.phase === 'finals' && m.round === 'semi') as typeof sfSchedule
    const { getFightsC: getMockFights } = await import('@/lib/mock-store')
    sfFights = getMockFights() as typeof sfFights
  }

  if (sfSchedule.length < 2) return { matches: [], warning: 'Semis not generated yet — generate semis first' }

  const getWinnerLoser = (sm: typeof sfSchedule[0]) => {
    const fight = sfFights.find(f => f.scheduled_match_id === sm.id)
    if (!fight || fight.winner === 0) return null // draw = no result yet
    const winner = fight.winner === 1 ? sm.team1_id : sm.team2_id
    const loser  = fight.winner === 1 ? sm.team2_id : sm.team1_id
    return { winner, loser }
  }

  const sf1 = sfSchedule.find(m => m.match_id === 'FC-SF1')
  const sf2 = sfSchedule.find(m => m.match_id === 'FC-SF2')
  if (!sf1 || !sf2) return { matches: [], warning: 'FC-SF1 / FC-SF2 not found' }

  const r1 = getWinnerLoser(sf1)
  const r2 = getWinnerLoser(sf2)
  if (!r1 || !r2) return { matches: [], warning: 'Both semis must have a result (no draws) before generating final' }

  return {
    matches: [
      { match_id: 'FC-F1',  team1_id: r1.winner, team2_id: r2.winner, round: 'final' },
      { match_id: 'FC-3RD', team1_id: r1.loser,  team2_id: r2.loser,  round: 'third_place' },
    ],
  }
}

// Cat D finals: round-robin among Top-3 alliances (3 matches total).
// Rulebook §6.2: Top 3 teams from qualification each pick a partner (4th–10th).
// The 3 alliance captains are seeded here; partners are assigned at match-recording time.
async function planFinalsD(): Promise<{ matches: PlannedMatch[]; warning?: string }> {
  const teams = await getTeams('d')
  const matchesD = await getMatchesD()
  const standings = computeStandingsD(teams, matchesD)
  if (standings.length < 3) return { matches: [], warning: `Only ${standings.length} teams ranked — need at least 3 for finals` }
  const [a, b, c] = standings.slice(0, 3).map(s => s.team.id)
  return {
    matches: [
      { match_id: 'FD-RR1', team1_id: a, team2_id: b, round: 'round_robin' }, // Alliance 1 vs Alliance 2
      { match_id: 'FD-RR2', team1_id: a, team2_id: c, round: 'round_robin' }, // Alliance 1 vs Alliance 3
      { match_id: 'FD-RR3', team1_id: b, team2_id: c, round: 'round_robin' }, // Alliance 2 vs Alliance 3
    ],
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await req.json() as { category: Category; confirm?: boolean; step?: 'semi' | 'final' }
  const { category } = body
  if (!category || !['a', 'b', 'c', 'd'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const cityCode = hasSupabase ? await getActiveCityCode() : 'MOCK'

  // For Cat C step='final', only check for existing final/3rd-place rows (not semis).
  const checkRounds = (category === 'c' && body.step === 'final')
    ? ['final', 'third_place']
    : null // null = check all finals

  let existingFinalsCount = 0
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    let q = supabase.from('scheduled_matches').select('id', { count: 'exact', head: true })
      .eq('category', category).eq('city_code', cityCode).eq('phase', 'finals')
    if (checkRounds) q = q.in('round', checkRounds)
    const { count } = await q
    existingFinalsCount = count ?? 0
  } else {
    const { getSchedule } = await import('@/lib/schedule-store')
    const all = getSchedule(category).filter(m => m.phase === 'finals')
    existingFinalsCount = checkRounds
      ? all.filter(m => checkRounds.includes(m.round ?? '')).length
      : all.length
  }
  if (existingFinalsCount > 0 && !body.confirm) {
    return NextResponse.json({
      error: `Finals bracket for ${category.toUpperCase()} already exists (${existingFinalsCount} matches). Pass { confirm: true } to replace.`,
      existingFinalsCount,
    }, { status: 409 })
  }

  // Compute plan
  let plan: { matches: PlannedMatch[]; warning?: string }
  if (category === 'a') plan = await planFinalsA()
  else if (category === 'b') plan = await planFinalsB()
  else if (category === 'c') plan = await planFinalsC(body.step ?? 'semi', cityCode)
  else plan = await planFinalsD()

  if (plan.matches.length === 0) {
    return NextResponse.json({ error: plan.warning ?? 'Cannot generate finals' }, { status: 400 })
  }

  // Insert
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    // Delete existing finals first (re-randomize)
    await supabase.from('scheduled_matches').delete()
      .eq('category', category).eq('city_code', cityCode).eq('phase', 'finals')
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
  } else {
    const { addScheduledMatch, getSchedule, deleteScheduledMatch } = await import('@/lib/schedule-store')
    // Delete existing finals for this category
    const existing = getSchedule(category).filter(m => m.phase === 'finals')
    for (const m of existing) deleteScheduledMatch(m.id)
    for (const m of plan.matches) {
      addScheduledMatch({
        category,
        match_id: m.match_id,
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        phase: 'finals',
        round: m.round,
      })
    }
  }

  return NextResponse.json({ ok: true, count: plan.matches.length })
}

// ── DELETE: reset individual finals rounds (admin only) ───────────────────
// body: { category, round: 'semi' | 'final' }
//   'semi'  → deletes semi + final + third_place  (cascade, since Final feeds from SF)
//   'final' → deletes final + third_place only
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { category, round } = await req.json() as { category: Category; round: 'semi' | 'final' }
  if (!category || !['a', 'b', 'c', 'd'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (round !== 'semi' && round !== 'final') {
    return NextResponse.json({ error: 'round must be "semi" or "final"' }, { status: 400 })
  }

  // Which rounds to wipe (cascade later rounds when resetting earlier ones)
  const roundsToDelete: MatchRound[] = round === 'semi'
    ? ['semi', 'r1', 'r2', 'final', 'third_place', 'triangle', 'round_robin']
    : ['final', 'third_place', 'triangle']

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: schedMatches } = await supabase
      .from('scheduled_matches')
      .select('id')
      .eq('category', category)
      .eq('city_code', cityCode)
      .eq('phase', 'finals')
      .in('round', roundsToDelete)

    if (schedMatches && schedMatches.length > 0) {
      const ids = schedMatches.map((m: { id: string }) => m.id)
      const table = category === 'b' ? 'matches_b'
        : category === 'd' ? 'matches_d'
        : category === 'c' ? 'fights_c'
        : null
      if (table) {
        await supabase.from(table).delete().in('scheduled_match_id', ids)
      }
      await supabase.from('scheduled_matches').delete().in('id', ids)
    }
    return NextResponse.json({ ok: true })
  }

  // Mock mode
  const { getSchedule, deleteScheduledMatch } = await import('@/lib/schedule-store')
  const toDelete = getSchedule(category).filter(
    m => m.phase === 'finals' && roundsToDelete.includes(m.round as MatchRound)
  )
  if (category === 'b') {
    const { getMatchesB, deleteMatchB } = await import('@/lib/mock-store')
    const ids = new Set(toDelete.map(m => m.id))
    for (const r of getMatchesB()) {
      if (r.scheduled_match_id && ids.has(r.scheduled_match_id)) deleteMatchB(r.id)
    }
  }
  for (const m of toDelete) deleteScheduledMatch(m.id)
  return NextResponse.json({ ok: true })
}
