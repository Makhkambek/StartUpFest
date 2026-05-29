import { NextRequest, NextResponse } from 'next/server'
import type { Category } from '@/types/database'
import type { MatchRound } from '@/lib/schedule-store'
import { computeStandingsA } from '@/lib/standings/a'
import { computeStandingsB } from '@/lib/standings/b'
import { computeStandingsD } from '@/lib/standings/d'
import { getTeams, getResultsA, getMatchesB, getMatchesD } from '@/lib/data'
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
  // Top 2 per group → up to 12 teams. If no groups configured, just take top 12.
  const groups = new Map<string, typeof standings>()
  for (const s of standings) {
    const g = s.team.group_letter ?? '_'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(s)
  }
  let finalists: typeof standings = []
  if (groups.size > 1) {
    for (const list of groups.values()) finalists.push(...list.slice(0, 2))
  } else {
    finalists = standings.slice(0, 12)
  }
  const seeded = shuffle(finalists)
  if (seeded.length < 2) return { matches: [], warning: `Only ${seeded.length} teams ranked — need at least 2 for finals` }
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

async function planFinalsD(): Promise<{ matches: PlannedMatch[]; warning?: string }> {
  const teams = await getTeams('d')
  const matches = await getMatchesD()
  const standings = computeStandingsD(teams, matches)
  // Decide bracket size: 8 if 8+ ranked teams, else 4
  const bracketSize = standings.length >= 8 ? 8 : 4
  const finalists = shuffle(standings.slice(0, bracketSize))
  if (finalists.length < 4) return { matches: [], warning: `Only ${finalists.length} teams ranked — need 4+ for finals` }
  const planned: PlannedMatch[] = []
  if (bracketSize === 8) {
    for (let i = 0; i < 4; i++) {
      planned.push({
        match_id: `FD-QF${i + 1}`,
        team1_id: finalists[i * 2].team.id,
        team2_id: finalists[i * 2 + 1].team.id,
        round: 'quarter',
      })
    }
  } else {
    planned.push({ match_id: 'FD-SF1', team1_id: finalists[0].team.id, team2_id: finalists[1].team.id, round: 'semi' })
    planned.push({ match_id: 'FD-SF2', team1_id: finalists[2].team.id, team2_id: finalists[3].team.id, round: 'semi' })
  }
  return { matches: planned }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await req.json() as { category: Category; confirm?: boolean }
  const { category } = body
  if (!category || !['a', 'b', 'c', 'd'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (category === 'c') {
    return NextResponse.json({ error: 'Cat C has no finals bracket — uses cumulative standings only' }, { status: 400 })
  }

  const cityCode = hasSupabase ? await getActiveCityCode() : 'MOCK'

  // Bug #20 fix: finals generation deletes any existing finals bracket. Force
  // the caller to confirm if rows already exist, so an accidental click can't
  // wipe hours of bracket setup.
  let existingFinalsCount = 0
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { count } = await supabase
      .from('scheduled_matches')
      .select('id', { count: 'exact', head: true })
      .eq('category', category)
      .eq('city_code', cityCode)
      .eq('phase', 'finals')
    existingFinalsCount = count ?? 0
  } else {
    const { getSchedule } = await import('@/lib/schedule-store')
    existingFinalsCount = getSchedule(category).filter(m => m.phase === 'finals').length
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
