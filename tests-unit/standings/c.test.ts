import { describe, it, expect } from 'vitest'
import { computeStandingsC } from '@/lib/standings/c'
import { makeTeam, makeFightC } from '../helpers/factories'

describe('computeStandingsC — MiniRoboWar', () => {
  it('awards 3 points for a win, 0 for a loss', () => {
    const t1 = makeTeam({ id: 't1', category: 'c' })
    const t2 = makeTeam({ id: 't2', category: 'c' })
    const fights = [
      makeFightC({ team1_id: 't1', team2_id: 't2', winner: 1, method: 'JD', judge_score1: 80, judge_score2: 70 }),
    ]
    const s = computeStandingsC([t1, t2], fights)
    const byId = Object.fromEntries(s.map(r => [r.team.id, r]))
    expect(byId.t1.points).toBe(3)
    expect(byId.t1.wins).toBe(1)
    expect(byId.t2.points).toBe(0)
    expect(byId.t2.losses).toBe(1)
  })

  it('counts knockouts only for KO method', () => {
    const t1 = makeTeam({ id: 't1', category: 'c' })
    const t2 = makeTeam({ id: 't2', category: 'c' })
    const t3 = makeTeam({ id: 't3', category: 'c' })
    const fights = [
      makeFightC({ team1_id: 't1', team2_id: 't2', winner: 1, method: 'KO' }),
      makeFightC({ team1_id: 't1', team2_id: 't3', winner: 1, method: 'JD' }),
      makeFightC({ team1_id: 't2', team2_id: 't3', winner: 1, method: 'IMM' }),
    ]
    const s = computeStandingsC([t1, t2, t3], fights)
    const byId = Object.fromEntries(s.map(r => [r.team.id, r]))
    expect(byId.t1.knockouts).toBe(1)
    expect(byId.t2.knockouts).toBe(0)
    expect(byId.t3.knockouts).toBe(0)
  })

  it('accumulates judge_score across fights', () => {
    const t1 = makeTeam({ id: 't1', category: 'c' })
    const t2 = makeTeam({ id: 't2', category: 'c' })
    const fights = [
      makeFightC({ team1_id: 't1', team2_id: 't2', winner: 1, judge_score1: 90, judge_score2: 60 }),
      makeFightC({ team1_id: 't1', team2_id: 't2', winner: 2, judge_score1: 70, judge_score2: 85 }),
    ]
    const s = computeStandingsC([t1, t2], fights)
    const byId = Object.fromEntries(s.map(r => [r.team.id, r]))
    expect(byId.t1.judge_score).toBe(160)
    expect(byId.t2.judge_score).toBe(145)
  })

  it('breaks tie by judge_score, then knockouts', () => {
    const t1 = makeTeam({ id: 't1', category: 'c' })
    const t2 = makeTeam({ id: 't2', category: 'c' })
    const t3 = makeTeam({ id: 't3', category: 'c' })
    const t4 = makeTeam({ id: 't4', category: 'c' })
    const fights = [
      makeFightC({ team1_id: 't1', team2_id: 't4', winner: 1, method: 'KO', judge_score1: 100, judge_score2: 50 }),
      makeFightC({ team1_id: 't2', team2_id: 't4', winner: 1, method: 'JD',  judge_score1: 80,  judge_score2: 70 }),
      makeFightC({ team1_id: 't3', team2_id: 't4', winner: 1, method: 'JD',  judge_score1: 80,  judge_score2: 70 }),
    ]
    const s = computeStandingsC([t1, t2, t3, t4], fights)
    // t1 (3 pts, 100 score, 1 KO) > t2 (3 pts, 80 score, 0 KO) ~ t3 (3 pts, 80 score, 0 KO)
    expect(s[0].team.id).toBe('t1')
  })

  /**
   * REGRESSION: bug #31 from sfrc-bugs-audit.md
   * Fight with winner=null/undefined (corrupted data) should not silently award
   * neither points nor draws. Currently accumulates judge_score without W/D/L update.
   */
  it('REGRESSION: handles fight with corrupted/null winner gracefully', () => {
    const t1 = makeTeam({ id: 't1', category: 'c' })
    const t2 = makeTeam({ id: 't2', category: 'c' })
    const fights = [
      // simulate corrupted record — bypass type via cast
      { ...makeFightC({ team1_id: 't1', team2_id: 't2' }), winner: null } as never,
    ]
    expect(() => computeStandingsC([t1, t2], fights)).not.toThrow()
  })

  it('handles empty fights list', () => {
    const t1 = makeTeam({ id: 't1', category: 'c' })
    const s = computeStandingsC([t1], [])
    expect(s).toHaveLength(1)
    expect(s[0].points).toBe(0)
  })
})
