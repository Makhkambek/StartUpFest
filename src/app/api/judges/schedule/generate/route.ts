import { NextRequest, NextResponse } from 'next/server'
import { requireCategory } from '@/lib/session'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Category A (Line Follower) — solo runs, greedy task-scheduler interleaving.
// Always picks the team with most remaining runs that hasn't run in the last
// (teamCount-1) slots, so the same team never appears consecutively and the
// gap between repeats is maximised regardless of team count.
function buildSoloRuns(teamIds: string[], n: number): { team1_id: string; team2_id: null }[] {
  const ids = shuffle(teamIds) // random initial order as tie-breaker
  const counts = new Map(ids.map(id => [id, n]))
  const result: { team1_id: string; team2_id: null }[] = []
  const total = ids.length * n
  const cooldown = Math.max(ids.length - 1, 1)

  for (let i = 0; i < total; i++) {
    const recent = new Set(result.slice(-cooldown).map(r => r.team1_id))

    // Pick team with most remaining runs not in cooldown window
    let pick: string | null = null
    let pickCount = -1
    for (const [id, cnt] of counts) {
      if (cnt > 0 && !recent.has(id) && cnt > pickCount) {
        pick = id; pickCount = cnt
      }
    }
    // Fallback: all available teams are in cooldown (only possible with 1 team)
    if (!pick) {
      for (const [id, cnt] of counts) {
        if (cnt > 0) { pick = id; break }
      }
    }

    result.push({ team1_id: pick!, team2_id: null })
    counts.set(pick!, counts.get(pick!)! - 1)
  }

  return result
}

// Category B — full round-robin within each group.
// Generates every unique pair inside a group exactly once, then interleaves
// groups so the schedule alternates between them.
function buildGroupPairings(
  teamsByGroup: Map<string, string[]>,
): { team1_id: string; team2_id: string; match_prefix: string }[] {
  const groupQueues: { team1_id: string; team2_id: string; match_prefix: string }[][] = []
  for (const [group, ids] of teamsByGroup) {
    if (ids.length < 2) continue
    const shuffled = shuffle(ids)
    const pairs: { team1_id: string; team2_id: string; match_prefix: string }[] = []
    for (let i = 0; i < shuffled.length; i++) {
      for (let j = i + 1; j < shuffled.length; j++) {
        pairs.push({ team1_id: shuffled[i], team2_id: shuffled[j], match_prefix: group })
      }
    }
    groupQueues.push(shuffle(pairs))
  }
  // Interleave groups round-robin style
  const result: { team1_id: string; team2_id: string; match_prefix: string }[] = []
  let remaining = groupQueues.filter(q => q.length > 0)
  while (remaining.length > 0) {
    for (const queue of remaining) {
      if (queue.length > 0) result.push(queue.shift()!)
    }
    remaining = remaining.filter(q => q.length > 0)
  }
  return result
}

// Category C — head-to-head pairings, one match per pair.
// At round boundaries, swaps the first match to avoid repeating teams from the
// previous round's last match.
function buildPairings(teamIds: string[], n: number): { team1_id: string; team2_id: string }[] {
  const pairs: { team1_id: string; team2_id: string }[] = []

  for (let round = 0; round < n; round++) {
    const order = shuffle(teamIds)
    const roundPairs: { team1_id: string; team2_id: string }[] = []
    for (let i = 0; i + 1 < order.length; i += 2) {
      roundPairs.push({ team1_id: order[i], team2_id: order[i + 1] })
    }
    if (order.length % 2 === 1) {
      roundPairs.push({ team1_id: order[order.length - 1], team2_id: order[0] })
    }

    // Fix round boundary: swap first match with the first one that doesn't
    // share teams with the last match of the previous round.
    if (pairs.length > 0) {
      const prev = pairs[pairs.length - 1]
      const prevTeams = new Set([prev.team1_id, prev.team2_id])
      const first = roundPairs[0]
      if (prevTeams.has(first.team1_id) || prevTeams.has(first.team2_id)) {
        const swapIdx = roundPairs.findIndex(
          p => !prevTeams.has(p.team1_id) && !prevTeams.has(p.team2_id)
        )
        if (swapIdx > 0) {
          [roundPairs[0], roundPairs[swapIdx]] = [roundPairs[swapIdx], roundPairs[0]]
        }
      }
    }

    pairs.push(...roundPairs)
  }

  return pairs
}

// Category D (Robo Football) — global slot-based scheduler.
// Every team plays exactly n matches. If (teams * n) is not divisible by 4,
// we add surrogate slots so the total is divisible. Surrogate teams play an
// extra match but their result does NOT count toward their standings.
// This mirrors the FTC surrogate system.
function buildAlliancesGlobal(teamIds: string[], n: number): {
  team1_id: string; team1b_id: string; team2_id: string; team2b_id: string
  surrogate_team_ids: string[]
}[] {
  type Entry = { id: string; isSurrogate: boolean }

  // Each team gets n normal slots
  const pool: Entry[] = teamIds.flatMap(id =>
    Array.from({ length: n }, () => ({ id, isSurrogate: false }))
  )

  // Pad to next multiple of 4 with surrogate entries
  const rem = pool.length % 4
  const surrogateCount = rem === 0 ? 0 : 4 - rem
  shuffle(teamIds).slice(0, surrogateCount).forEach(id =>
    pool.push({ id, isSurrogate: true })
  )

  const entries = shuffle(pool)

  const matches: { team1_id: string; team1b_id: string; team2_id: string; team2b_id: string; surrogate_team_ids: string[] }[] = []

  for (let i = 0; i < entries.length; i += 4) {
    const batch = entries.slice(i, i + 4)

    // Resolve duplicate teams within the batch by swapping with a later entry
    const seen = new Set<string>()
    for (let j = 0; j < 4; j++) {
      if (seen.has(batch[j].id)) {
        for (let k = i + 4; k < entries.length; k++) {
          if (!seen.has(entries[k].id)) {
            const tmp = batch[j]; batch[j] = entries[k]; entries[k] = tmp
            break
          }
        }
      }
      seen.add(batch[j].id)
    }

    matches.push({
      team1_id: batch[0].id,
      team1b_id: batch[1].id,
      team2_id: batch[2].id,
      team2b_id: batch[3].id,
      surrogate_team_ids: batch.filter(e => e.isSurrogate).map(e => e.id),
    })
  }

  return matches
}

// Bug #19 helpers — count and clear qualification matches before regenerating.
async function countQualificationMatches(category: string, cityCode: string): Promise<number> {
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { count } = await supabase
      .from('scheduled_matches')
      .select('id', { count: 'exact', head: true })
      .eq('category', category)
      .eq('city_code', cityCode)
      .like('match_id', 'Q-%')
    return count ?? 0
  }
  const { getSchedule } = await import('@/lib/schedule-store')
  return getSchedule(category).filter(m => m.match_id.startsWith('Q-')).length
}

async function clearQualificationMatches(category: string, cityCode: string) {
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase
      .from('scheduled_matches')
      .delete()
      .eq('category', category)
      .eq('city_code', cityCode)
      .like('match_id', 'Q-%')
    return
  }
  const { getSchedule, deleteScheduledMatch } = await import('@/lib/schedule-store')
  for (const m of getSchedule(category)) {
    if (m.match_id.startsWith('Q-')) deleteScheduledMatch(m.id)
  }
}


export async function POST(req: NextRequest) {
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

  const authz = await requireCategory(body.category)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  // `replace: true` wipes existing matches — only admin can do that (judges must Reset first)
  if (body.replace && authz.session.role !== 'admin') {
    return NextResponse.json({ error: 'Only admin can regenerate an existing schedule' }, { status: 403 })
  }

  const cityCode = hasSupabase ? await getActiveCityCode() : 'MOCK'

  // Bug #19 fix: refuse to silently append to an existing schedule. Caller must
  // opt into `replace: true` to wipe and regenerate (or use a separate flow to
  // delete first). Otherwise we'd duplicate every match on repeated calls.
  const existingCount = await countQualificationMatches(body.category, cityCode)
  if (existingCount > 0 && !body.replace) {
    return NextResponse.json({
      error: `Schedule already has ${existingCount} matches for category ${body.category.toUpperCase()}. Pass { replace: true } to regenerate.`,
      existingCount,
    }, { status: 409 })
  }
  if (body.replace && existingCount > 0) {
    await clearQualificationMatches(body.category, cityCode)
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
        city_code: cityCode,
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
    if (teams.length < 4) {
      return NextResponse.json({ error: `Need at least 4 teams for alliance matches (you have ${teams.length})` }, { status: 400 })
    }
    const alliances = buildAlliancesGlobal(teams.map((t) => t.id), body.n)
    const surrogateCount = alliances.reduce((s, a) => s + a.surrogate_team_ids.length, 0)
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
        surrogate_team_ids: a.surrogate_team_ids,
        city_code: cityCode,
        created_at: new Date(now + i).toISOString(),
      }))
      const { error } = await supabase.from('scheduled_matches').insert(rows)
      if (error) {
        const isMissingCol = /team1b_id|team2b_id|surrogate|schema cache/i.test(error.message)
        if (isMissingCol) {
          return NextResponse.json({
            error: `Missing column — run migrations 015 and 026 in Supabase SQL Editor.`,
            needsMigration: '026_surrogate_teams',
          }, { status: 500 })
        }
        return NextResponse.json({ error: `Generate failed: ${error.message}` }, { status: 500 })
      }
      return NextResponse.json({ count: rows.length, surrogates: surrogateCount, format: 'alliance-4' })
    }
    const { addScheduledMatch } = await import('@/lib/schedule-store')
    alliances.forEach((a, i) => addScheduledMatch({
      category: 'd',
      match_id: `Q-${i + 1}`,
      team1_id: a.team1_id,
      team1b_id: a.team1b_id,
      team2_id: a.team2_id,
      team2b_id: a.team2b_id,
      surrogate_team_ids: a.surrogate_team_ids,
    }))
    return NextResponse.json({ count: alliances.length, surrogates: surrogateCount, format: 'alliance-4' })
  }

  // B — group-stage round-robin (each team plays every other team in its group once)
  if (body.category === 'b') {
    const teamsByGroup = new Map<string, string[]>()
    for (const t of teams) {
      const g = t.group_letter ?? 'Ungrouped'
      if (!teamsByGroup.has(g)) teamsByGroup.set(g, [])
      teamsByGroup.get(g)!.push(t.id)
    }
    const ungrouped = teamsByGroup.get('Ungrouped')
    if (ungrouped && ungrouped.length > 0) {
      return NextResponse.json({
        error: `${ungrouped.length} team(s) have no group assigned. Assign all teams to groups A–D before generating.`,
      }, { status: 400 })
    }
    const pairs = buildGroupPairings(teamsByGroup)
    // Assign match_ids per group: A-1, A-2, … B-1, B-2, …
    const groupCounters: Record<string, number> = {}
    const rows = pairs.map((p) => {
      groupCounters[p.match_prefix] = (groupCounters[p.match_prefix] ?? 0) + 1
      return { team1_id: p.team1_id, team2_id: p.team2_id, match_id: `${p.match_prefix}-${groupCounters[p.match_prefix]}` }
    })
    if (hasSupabase) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const now = Date.now()
      const { error } = await supabase.from('scheduled_matches').insert(
        rows.map((r, i) => ({ category: 'b', match_id: r.match_id, team1_id: r.team1_id, team2_id: r.team2_id, city_code: cityCode, created_at: new Date(now + i).toISOString() }))
      )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ count: rows.length, format: 'group-roundrobin' })
    }
    const { addScheduledMatch } = await import('@/lib/schedule-store')
    rows.forEach((r) => addScheduledMatch({ category: 'b', match_id: r.match_id, team1_id: r.team1_id, team2_id: r.team2_id }))
    return NextResponse.json({ count: rows.length, format: 'group-roundrobin' })
  }

  // C — head-to-head pairs
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
      city_code: cityCode,
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
