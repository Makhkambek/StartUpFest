import type { Team, ResultA, StandingA, StatusA } from '@/types/database'

// Sentinel totals for sort ordering (lower = better):
//   real total (e.g. 30.5) < DNF (99998) < DISQ (99999) < no-result (99999.5)
// A team with no submitted result MUST rank below DQ and never be marked
// finalist/qualified, no matter how few teams competed.
const TOTAL_DNF = 99_998
const TOTAL_DISQ = 99_999
const TOTAL_NO_RESULT = 99_999.5

const PENALTY_SEC: Record<string, number> = { '10': 10, '20': 20, '40': 40, '50': 50 }

interface InternalRow {
  team: Team
  run1: number | null
  run2: number | null
  penalty: string
  penaltySec: number          // tiebreaker: fewer penalty seconds = better
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
        penaltySec: 0,
        total: TOTAL_NO_RESULT,
        displayTotal: null,
        status: 'elim',
      }
    }
    // Each scheduled match = one run stored as run1 in its own result row.
    // Sort by updated_at to get chronological order, then treat each row's
    // run1 as the N-th run for display purposes.
    const sorted = [...teamResults].sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    const run1 = sorted[0]?.run1 ?? null
    const run2 = sorted[1]?.run1 ?? null

    // Best result row for ranking (lowest total, ignoring DNF/DISQ).
    const completed = teamResults.filter(r => r.penalty !== 'dnf' && r.penalty !== 'disq' && r.total !== null)
    const best = completed.length
      ? completed.reduce((a, b) => (a.total! <= b.total! ? a : b))
      : teamResults[teamResults.length - 1]
    const isDnf = completed.length === 0 && best.penalty === 'dnf'
    const isDisq = completed.length === 0 && best.penalty === 'disq'
    return {
      team,
      run1,
      run2,
      penalty: best.penalty,
      penaltySec: PENALTY_SEC[best.penalty] ?? 0,
      total: isDnf ? TOTAL_DNF : isDisq ? TOTAL_DISQ : (best.total ?? TOTAL_NO_RESULT),
      displayTotal: isDnf || isDisq ? null : best.total,
      status: isDnf ? 'dnf' : isDisq ? 'disq' : null,
    }
  })

  // Primary: total (lower wins).
  // Tiebreaker 1: penaltySec (fewer = better) — rulebook §3.2.
  // Tiebreaker 2: team.created_at (earlier registration) — deterministic, triggers golden run in practice.
  rows.sort((a, b) => {
    if (a.total !== b.total) return a.total - b.total
    if (a.penaltySec !== b.penaltySec) return a.penaltySec - b.penaltySec
    return a.team.created_at.localeCompare(b.team.created_at)
  })

  return rows.map((row, i) => ({
    rank: i + 1,
    team: row.team,
    run1: row.run1,
    run2: row.run2,
    penalty: row.penalty,
    total: row.displayTotal,
    status: row.status ?? (i < 4 ? 'finalist' : i < 16 ? 'qualified' : 'elim'),
  }))
}
