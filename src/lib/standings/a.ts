import type { Team, ResultA, StandingA, StatusA } from '@/types/database'

export function computeStandingsA(teams: Team[], results: ResultA[]): StandingA[] {
  const rows = teams.map((team) => {
    const r = results.find((x) => x.team_id === team.id)
    if (!r) return { team, run1: null, run2: null, penalty: '0', total: 99997, status: null as StatusA | null }
    const isDnf = r.penalty === 'dnf'
    const isDisq = r.penalty === 'disq'
    return {
      team,
      run1: r.run1,
      run2: r.run2,
      penalty: r.penalty,
      total: isDnf ? 99998 : isDisq ? 99999 : r.total,
      status: isDnf ? ('dnf' as StatusA) : isDisq ? ('disq' as StatusA) : null,
    }
  })

  rows.sort((a, b) => (a.total ?? 99999) - (b.total ?? 99999))

  return rows.map((row, i) => ({
    rank: i + 1,
    team: row.team,
    run1: row.run1,
    run2: row.run2,
    penalty: row.penalty,
    total: row.status === 'dnf' || row.status === 'disq' ? null : row.total,
    status: row.status ?? (i < 4 ? 'finalist' : i < 16 ? 'qualified' : 'elim'),
  }))
}
