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

  return rows.map((row, i) => ({
    rank: i + 1,
    ...row,
    status: i < 3 ? 'finalist' : i < 12 ? 'qualified' : 'elim',
  } as StandingB))
}
