import type { Team, MatchB, StandingB } from '@/types/database'

export function computeStandingsB(teams: Team[], matches: MatchB[]): StandingB[] {
  const stats: Record<string, { wins: number; draws: number; losses: number; round_wins: number }> = {}
  teams.forEach((t) => { stats[t.id] = { wins: 0, draws: 0, losses: 0, round_wins: 0 } })

  matches.forEach((m) => {
    const s1 = stats[m.team1_id]
    const s2 = stats[m.team2_id]
    if (!s1 || !s2) {
      // Audit trail: stale match references a team that was deleted.
      console.warn('[standings/b] skipping match with unknown team', { match_id: m.id, team1_id: m.team1_id, team2_id: m.team2_id })
      return
    }
    if (m.winner === 1)      { s1.wins++;  s2.losses++ }
    else if (m.winner === 2) { s2.wins++;  s1.losses++ }
    else                     { s1.draws++; s2.draws++  }
    s1.round_wins += Math.max(0, m.rounds1)
    s2.round_wins += Math.max(0, m.rounds2)
  })

  const rows = teams.map((team) => ({
    team,
    ...stats[team.id],
    points: stats[team.id].wins * 3 + stats[team.id].draws,
  }))

  rows.sort((a, b) => b.points - a.points || b.round_wins - a.round_wins || a.team.created_at.localeCompare(b.team.created_at))

  // v1.1: 4 groups, top 2 per group → 8-team QF bracket.
  // If groups are configured: top 2 in each group = finalist.
  // If no groups yet: top 8 globally = finalist.
  const groups = new Map<string, string[]>()
  for (const row of rows) {
    const g = row.team.group_letter ?? ''
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(row.team.id)
  }

  const finalistIds = new Set<string>()
  const hasGroups = groups.size > 1 || (groups.size === 1 && !groups.has(''))
  if (hasGroups) {
    for (const [g, ids] of groups) {
      if (g === '') continue
      ids.slice(0, 2).forEach(id => finalistIds.add(id))
    }
  } else {
    rows.slice(0, 8).forEach(r => finalistIds.add(r.team.id))
  }

  return rows.map((row, i) => ({
    rank: i + 1,
    ...row,
    status: finalistIds.has(row.team.id) ? 'finalist' : 'elim',
  } as StandingB))
}
