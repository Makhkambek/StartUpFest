import type { Team, MatchD, StandingD } from '@/types/database'

export function computeStandingsD(teams: Team[], matches: MatchD[]): StandingD[] {
  const stats: Record<string, { wins: number; draws: number; losses: number; points: number; goals_for: number; goals_against: number }> = {}
  teams.forEach((t) => { stats[t.id] = { wins: 0, draws: 0, losses: 0, points: 0, goals_for: 0, goals_against: 0 } })

  matches.forEach((m) => {
    const s1 = stats[m.team1_id]
    const s2 = stats[m.team2_id]
    if (!s1 || !s2) return
    s1.goals_for += m.goals1; s1.goals_against += m.goals2
    s2.goals_for += m.goals2; s2.goals_against += m.goals1
    if (m.goals1 > m.goals2)      { s1.wins++; s1.points += 3; s2.losses++ }
    else if (m.goals2 > m.goals1) { s2.wins++; s2.points += 3; s1.losses++ }
    else                          { s1.draws++; s1.points++; s2.draws++; s2.points++ }
  })

  const rows = teams.map((team) => ({
    team, ...stats[team.id],
    goal_diff: stats[team.id].goals_for - stats[team.id].goals_against,
  }))

  rows.sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff || b.goals_for - a.goals_for)

  return rows.map((row, i) => ({ rank: i + 1, ...row }))
}
