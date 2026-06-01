import type { Team, MatchD, StandingD } from '@/types/database'

// surrogateMap: scheduled_match_id → set of team IDs playing surrogate.
// Surrogate teams play the match normally but their result is excluded from standings.
export function computeStandingsD(
  teams: Team[],
  matches: MatchD[],
  surrogateMap?: Map<string, Set<string>>,
): StandingD[] {
  const stats: Record<string, { wins: number; draws: number; losses: number; points: number; goals_for: number; goals_against: number }> = {}
  teams.forEach((t) => { stats[t.id] = { wins: 0, draws: 0, losses: 0, points: 0, goals_for: 0, goals_against: 0 } })

  matches.forEach((m) => {
    const s1 = stats[m.team1_id]
    const s2 = stats[m.team2_id]
    if (!s1 || !s2) {
      console.warn('[standings/d] skipping match with unknown team', { match_id: m.id, team1_id: m.team1_id, team2_id: m.team2_id })
      return
    }
    const surrogates = m.scheduled_match_id && surrogateMap
      ? (surrogateMap.get(m.scheduled_match_id) ?? new Set<string>())
      : new Set<string>()
    // Clamp goals to ≥ 0 — canonical validation lives at the POST endpoint;
    // this defends standings math from any bad legacy/test data.
    const g1 = Math.max(0, m.goals1)
    const g2 = Math.max(0, m.goals2)

    const s1b = m.team1b_id ? (stats[m.team1b_id] ?? null) : null
    const s2b = m.team2b_id ? (stats[m.team2b_id] ?? null) : null

    type Stat = typeof s1
    // Forfeit: team gets a loss with 0 goals (they didn't play).
    const applyForfeit = (s: Stat) => { s.losses++ }
    // Forfeit win: entire opposing alliance no-showed → 3 pts, no goals (match not played).
    const applyForfeitWin = (s: Stat) => { s.wins++; s.points += 3 }
    const applyAlliance1 = (s: Stat) => {
      s.goals_for += g1; s.goals_against += g2
      if (g1 > g2)      { s.wins++; s.points += 3 }
      else if (g2 > g1) { s.losses++ }
      else              { s.draws++; s.points++ }
    }
    const applyAlliance2 = (s: Stat) => {
      s.goals_for += g2; s.goals_against += g1
      if (g2 > g1)      { s.wins++; s.points += 3 }
      else if (g1 > g2) { s.losses++ }
      else              { s.draws++; s.points++ }
    }

    // Entire alliance forfeited = every member of that side has a forfeit flag.
    const redAllForfeited = !!m.team1_forfeit && (!m.team1b_id || !!m.team1b_forfeit)
    const blueAllForfeited = !!m.team2_forfeit && (!m.team2b_id || !!m.team2b_forfeit)

    if (!surrogates.has(m.team1_id))
      m.team1_forfeit  ? applyForfeit(s1)  : (blueAllForfeited ? applyForfeitWin(s1)  : applyAlliance1(s1))
    if (s1b && !surrogates.has(m.team1b_id!))
      m.team1b_forfeit ? applyForfeit(s1b) : (blueAllForfeited ? applyForfeitWin(s1b) : applyAlliance1(s1b))
    if (!surrogates.has(m.team2_id))
      m.team2_forfeit  ? applyForfeit(s2)  : (redAllForfeited  ? applyForfeitWin(s2)  : applyAlliance2(s2))
    if (s2b && !surrogates.has(m.team2b_id!))
      m.team2b_forfeit ? applyForfeit(s2b) : (redAllForfeited  ? applyForfeitWin(s2b) : applyAlliance2(s2b))
  })

  const rows = teams.map((team) => ({
    team, ...stats[team.id],
    goal_diff: stats[team.id].goals_for - stats[team.id].goals_against,
  }))

  rows.sort((a, b) =>
    b.points - a.points ||
    b.goal_diff - a.goal_diff ||
    b.goals_for - a.goals_for ||
    a.team.created_at.localeCompare(b.team.created_at)
  )

  return rows.map((row, i) => ({ rank: i + 1, ...row }))
}
