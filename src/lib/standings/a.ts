import type { Team, ResultA, StandingA, StatusA } from '@/types/database'

// Sentinel totals for sort ordering (lower = better):
//   real total (e.g. 30.5) < DNF (99998) < DISQ (99999) < no-result (99999.5)
// A team with no submitted result MUST rank below DQ and never be marked
// finalist/qualified, no matter how few teams competed.
const TOTAL_DNF = 99_998
const TOTAL_DISQ = 99_999
const TOTAL_NO_RESULT = 99_999.5

interface InternalRow {
  team: Team
  run1: number | null
  run2: number | null
  penalty: string
  bestRun: number | null      // best single-run time (tiebreaker)
  total: number               // sort key (uses sentinels above)
  displayTotal: number | null // what to render in the standings table
  status: StatusA | null      // forced status, or null = derive from rank
}

export function computeStandingsA(teams: Team[], results: ResultA[]): StandingA[] {
  const rows: InternalRow[] = teams.map((team) => {
    const teamResults = results.filter((x) => x.team_id === team.id)
    if (!teamResults.length) {
      return {
        team,
        run1: null,
        run2: null,
        penalty: '0',
        bestRun: null,
        total: TOTAL_NO_RESULT,
        displayTotal: null,
        status: 'elim',
      }
    }
    const completed = teamResults.filter(r => r.penalty !== 'dnf' && r.penalty !== 'disq' && r.total !== null)
    const r = completed.length
      ? completed.reduce((a, b) => (a.total! <= b.total! ? a : b))
      : teamResults[teamResults.length - 1]
    const isDnf = r.penalty === 'dnf'
    const isDisq = r.penalty === 'disq'
    const runs = [r.run1, r.run2].filter((v): v is number => v !== null)
    const bestRun = runs.length ? Math.min(...runs) : null
    return {
      team,
      run1: r.run1,
      run2: r.run2,
      penalty: r.penalty,
      bestRun,
      total: isDnf ? TOTAL_DNF : isDisq ? TOTAL_DISQ : (r.total ?? TOTAL_NO_RESULT),
      displayTotal: isDnf || isDisq ? null : r.total,
      status: isDnf ? 'dnf' : isDisq ? 'disq' : null,
    }
  })

  // Primary: total (lower wins). Tiebreaker 1: best single-run (lower wins).
  // Tiebreaker 2: team.created_at (earlier registration wins) — deterministic.
  rows.sort((a, b) => {
    if (a.total !== b.total) return a.total - b.total
    const aRun = a.bestRun ?? Infinity
    const bRun = b.bestRun ?? Infinity
    if (aRun !== bRun) return aRun - bRun
    return a.team.created_at.localeCompare(b.team.created_at)
  })

  return rows.map((row, i) => ({
    rank: i + 1,
    team: row.team,
    run1: row.run1,
    run2: row.run2,
    penalty: row.penalty,
    total: row.displayTotal,
    // Forced status (dnf/disq/elim-no-result) wins. Otherwise derive from rank.
    status: row.status ?? (i < 4 ? 'finalist' : i < 16 ? 'qualified' : 'elim'),
  }))
}
