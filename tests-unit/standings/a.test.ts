import { describe, it, expect } from 'vitest'
import { computeStandingsA } from '@/lib/standings/a'
import { makeTeam, makeResultA } from '../helpers/factories'

describe('computeStandingsA — Line Follower', () => {
  it('ranks teams by total time ascending (lower is better)', () => {
    const t1 = makeTeam({ id: 't1', category: 'a' })
    const t2 = makeTeam({ id: 't2', category: 'a' })
    const t3 = makeTeam({ id: 't3', category: 'a' })

    const results = [
      makeResultA({ team_id: 't1', run1: 30, run2: 28, total: 28, penalty: '0' }),
      makeResultA({ team_id: 't2', run1: 25, run2: 26, total: 25, penalty: '0' }),
      makeResultA({ team_id: 't3', run1: 35, run2: 33, total: 33, penalty: '0' }),
    ]

    const standings = computeStandingsA([t1, t2, t3], results)
    expect(standings.map(s => s.team.id)).toEqual(['t2', 't1', 't3'])
    expect(standings[0].rank).toBe(1)
  })

  it('picks the best (lowest) result when team has multiple', () => {
    const t1 = makeTeam({ id: 't1', category: 'a' })
    const results = [
      makeResultA({ team_id: 't1', run1: 50, run2: 50, total: 50 }),
      makeResultA({ team_id: 't1', run1: 30, run2: 31, total: 30 }),
      makeResultA({ team_id: 't1', run1: 40, run2: 39, total: 39 }),
    ]
    const [row] = computeStandingsA([t1], results)
    expect(row.total).toBe(30)
  })

  it('applies penalty seconds correctly (20s)', () => {
    const t1 = makeTeam({ id: 't1', category: 'a' })
    const results = [
      makeResultA({ team_id: 't1', run1: 25, run2: 26, total: 45, penalty: '20' }),
    ]
    const [row] = computeStandingsA([t1], results)
    expect(row.penalty).toBe('20')
    expect(row.total).toBe(45)
  })

  it('marks DnF status and pushes to bottom', () => {
    const t1 = makeTeam({ id: 't1', category: 'a' })
    const t2 = makeTeam({ id: 't2', category: 'a' })
    const results = [
      makeResultA({ team_id: 't1', run1: 30, run2: 28, total: 28, penalty: '0' }),
      makeResultA({ team_id: 't2', run1: null, run2: null, total: null, penalty: 'dnf' }),
    ]
    const standings = computeStandingsA([t1, t2], results)
    expect(standings[0].team.id).toBe('t1')
    expect(standings[1].team.id).toBe('t2')
    expect(standings[1].status).toBe('dnf')
    expect(standings[1].total).toBeNull()
  })

  it('marks DisQ status and ranks below DnF', () => {
    const t1 = makeTeam({ id: 't1', category: 'a' })
    const t2 = makeTeam({ id: 't2', category: 'a' })
    const t3 = makeTeam({ id: 't3', category: 'a' })
    const results = [
      makeResultA({ team_id: 't1', run1: 30, run2: 28, total: 28 }),
      makeResultA({ team_id: 't2', penalty: 'dnf', total: null }),
      makeResultA({ team_id: 't3', penalty: 'disq', total: null }),
    ]
    const standings = computeStandingsA([t1, t2, t3], results)
    expect(standings.map(s => s.status)).toEqual([
      expect.stringMatching(/finalist|qualified/),
      'dnf',
      'disq',
    ])
  })

  it('assigns finalist status to top 4', () => {
    const teams = Array.from({ length: 20 }, (_, i) => makeTeam({ id: `t${i}`, category: 'a' }))
    const results = teams.map((t, i) => makeResultA({ team_id: t.id, total: 20 + i, penalty: '0' }))
    const standings = computeStandingsA(teams, results)
    expect(standings.slice(0, 4).every(s => s.status === 'finalist')).toBe(true)
    expect(standings.slice(4, 16).every(s => s.status === 'qualified')).toBe(true)
    expect(standings.slice(16).every(s => s.status === 'elim')).toBe(true)
  })

  /**
   * REGRESSION: bug #1 from sfrc-bugs-audit.md
   * Teams without any results get total=99997, sorting BEFORE dnf (99998)
   * and disq (99999), then receiving status 'finalist'/'qualified' at i<4 / i<16.
   * Expected: no-result teams should rank LAST and not get a qualified status.
   * Fixed 2026-05-20.
   */
  it('REGRESSION (bug #1): teams without any results must not be ranked as finalists', () => {
    const tWithResults = makeTeam({ id: 'with', category: 'a', name: 'Has Results' })
    const tNoResults = makeTeam({ id: 'none', category: 'a', name: 'No Results' })
    const results = [
      makeResultA({ team_id: 'with', run1: 50, run2: 50, total: 50, penalty: '0' }),
    ]
    const standings = computeStandingsA([tNoResults, tWithResults], results)
    const noResultRow = standings.find(s => s.team.id === 'none')!
    expect(noResultRow.rank).toBeGreaterThan(1)
    expect(noResultRow.status).not.toBe('finalist')
    expect(noResultRow.status).not.toBe('qualified')
  })

  it('handles empty teams list', () => {
    expect(computeStandingsA([], [])).toEqual([])
  })

  it('handles teams with empty results list', () => {
    const t1 = makeTeam({ id: 't1', category: 'a' })
    const standings = computeStandingsA([t1], [])
    expect(standings).toHaveLength(1)
    expect(standings[0].rank).toBe(1)
  })

  /**
   * REGRESSION: bug #10
   * Two teams with identical total time should rank deterministically by
   * best single-run time (tiebreaker), not by insertion order.
   * Fixed 2026-05-20.
   */
  it('REGRESSION (bug #10): equal-total teams need a deterministic tiebreaker', () => {
    const t1 = makeTeam({ id: 't1', category: 'a', name: 'BetterRun' })
    const t2 = makeTeam({ id: 't2', category: 'a', name: 'WorseRun' })
    const results = [
      makeResultA({ team_id: 't1', run1: 30, run2: 40, total: 30 }), // best single-run = 30
      makeResultA({ team_id: 't2', run1: 35, run2: 35, total: 30 }), // best single-run = 35
    ]
    // Pass teams in REVERSED order (t2 first) — proper tiebreaker should still rank t1 first
    const standings = computeStandingsA([t2, t1], results)
    expect(standings[0].team.id).toBe('t1')
  })
})
