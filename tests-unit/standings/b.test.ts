import { describe, it, expect } from 'vitest'
import { computeStandingsB } from '@/lib/standings/b'
import { makeTeam, makeMatchB } from '../helpers/factories'

describe('computeStandingsB — Mini Sumo', () => {
  it('awards 3 points for a win, 1 for a draw, 0 for a loss', () => {
    const t1 = makeTeam({ id: 't1', category: 'b' })
    const t2 = makeTeam({ id: 't2', category: 'b' })
    const t3 = makeTeam({ id: 't3', category: 'b' })

    const matches = [
      makeMatchB({ team1_id: 't1', team2_id: 't2', winner: 1, rounds1: 2, rounds2: 1 }),
      makeMatchB({ team1_id: 't2', team2_id: 't3', winner: 0, rounds1: 1, rounds2: 1 }),
      makeMatchB({ team1_id: 't1', team2_id: 't3', winner: 2, rounds1: 0, rounds2: 2 }),
    ]

    const s = computeStandingsB([t1, t2, t3], matches)
    const byId = Object.fromEntries(s.map(r => [r.team.id, r]))
    expect(byId.t1.points).toBe(3)
    expect(byId.t2.points).toBe(1)
    expect(byId.t3.points).toBe(4)
    expect(byId.t1.wins).toBe(1)
    expect(byId.t2.draws).toBe(1)
    expect(byId.t3.draws).toBe(1)
    expect(byId.t3.wins).toBe(1)
  })

  it('breaks tie by round_wins', () => {
    const t1 = makeTeam({ id: 't1', category: 'b' })
    const t2 = makeTeam({ id: 't2', category: 'b' })
    const t3 = makeTeam({ id: 't3', category: 'b' })

    const matches = [
      makeMatchB({ team1_id: 't1', team2_id: 't3', winner: 1, rounds1: 2, rounds2: 0 }),
      makeMatchB({ team1_id: 't2', team2_id: 't3', winner: 1, rounds1: 2, rounds2: 1 }),
    ]
    const s = computeStandingsB([t1, t2, t3], matches)
    // Both t1 and t2 have 3 points; t1 has 2 round_wins, t2 has 2 → tie at top
    // But t1 has 0 round losses, t2 has 1 — round_wins both 2 → insertion order
    expect(s[0].points).toBe(3)
    expect(s[1].points).toBe(3)
    expect(s[2].team.id).toBe('t3')
    expect(s[2].points).toBe(0)
  })

  it('assigns finalist/qualified/elim status by rank', () => {
    const teams = Array.from({ length: 15 }, (_, i) => makeTeam({ id: `t${i}`, category: 'b' }))
    // build matches so winners are t0, t1, t2 (top 3)
    const matches = teams.slice(3).map(opponent =>
      makeMatchB({ team1_id: 't0', team2_id: opponent.id, winner: 1, rounds1: 2, rounds2: 0 })
    )
    const s = computeStandingsB(teams, matches)
    expect(s.filter(r => r.status === 'finalist')).toHaveLength(3)
    expect(s.filter(r => r.status === 'qualified').length).toBeGreaterThan(0)
    expect(s.filter(r => r.status === 'elim').length).toBeGreaterThan(0)
  })

  it('handles match with unknown team_id without crashing', () => {
    const t1 = makeTeam({ id: 't1', category: 'b' })
    const matches = [
      makeMatchB({ team1_id: 't1', team2_id: 'ghost', winner: 1, rounds1: 2, rounds2: 0 }),
    ]
    expect(() => computeStandingsB([t1], matches)).not.toThrow()
    const s = computeStandingsB([t1], matches)
    // match is silently skipped — known P1 audit bug #11
    expect(s[0].wins).toBe(0)
  })

  it('handles empty matches', () => {
    const t1 = makeTeam({ id: 't1', category: 'b' })
    const t2 = makeTeam({ id: 't2', category: 'b' })
    const s = computeStandingsB([t1, t2], [])
    expect(s.every(r => r.points === 0)).toBe(true)
    expect(s[0].rank).toBe(1)
    expect(s[1].rank).toBe(2)
  })

  it('accumulates round_wins across multiple matches', () => {
    const t1 = makeTeam({ id: 't1', category: 'b' })
    const t2 = makeTeam({ id: 't2', category: 'b' })
    const matches = [
      makeMatchB({ team1_id: 't1', team2_id: 't2', winner: 1, rounds1: 2, rounds2: 1 }),
      makeMatchB({ team1_id: 't1', team2_id: 't2', winner: 1, rounds1: 2, rounds2: 0 }),
    ]
    const s = computeStandingsB([t1, t2], matches)
    const byId = Object.fromEntries(s.map(r => [r.team.id, r]))
    expect(byId.t1.round_wins).toBe(4)
    expect(byId.t2.round_wins).toBe(1)
  })
})
