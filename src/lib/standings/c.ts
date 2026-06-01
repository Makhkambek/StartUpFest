import type { Team, FightC, StandingC } from '@/types/database'

export function computeStandingsC(teams: Team[], fights: FightC[]): StandingC[] {
  const stats: Record<string, { wins: number; draws: number; losses: number; points: number; judge_score: number; knockouts: number }> = {}
  teams.forEach((t) => { stats[t.id] = { wins: 0, draws: 0, losses: 0, points: 0, judge_score: 0, knockouts: 0 } })

  fights.forEach((f) => {
    const s1 = stats[f.team1_id]
    const s2 = stats[f.team2_id]
    if (!s1 || !s2) {
      console.warn('[standings/c] skipping fight with unknown team', { fight_id: f.id, team1_id: f.team1_id, team2_id: f.team2_id })
      return
    }
    // Clamp judge scores to [0, 100] — defends against bad data; canonical
    // validation lives at the POST endpoint.
    s1.judge_score += Math.min(100, f.judge_score1)
    s2.judge_score += Math.min(100, f.judge_score2)
    if (f.winner === 1) {
      s1.wins++; s1.points += 3; s2.losses++
      if (f.method === 'KO') s1.knockouts++
    } else if (f.winner === 2) {
      s2.wins++; s2.points += 3; s1.losses++
      if (f.method === 'KO') s2.knockouts++
    } else {
      // Corrupted record (e.g. winner is null/undefined): count as a draw
      // so points conservation holds. 1 point each, like other categories.
      s1.draws++; s1.points += 1
      s2.draws++; s2.points += 1
    }
  })

  const rows = teams.map((team) => ({ team, ...stats[team.id] }))
  rows.sort((a, b) =>
    b.points - a.points ||
    b.judge_score - a.judge_score ||
    b.knockouts - a.knockouts ||
    a.team.created_at.localeCompare(b.team.created_at)
  )

  return rows.map((row, i) => ({ rank: i + 1, ...row }))
}
