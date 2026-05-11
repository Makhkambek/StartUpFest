import type { Team, ResultA, MatchB, FightC, MatchD } from '@/types/database'

// Module-level mutable store — persists for the lifetime of the dev server process.
// Reset on server restart. Replaced by Supabase when env vars are present.

const teams = new Map<string, Team>()
const resultsA = new Map<string, ResultA>() // keyed by team_id
const matchesB = new Map<string, MatchB>()
const fightsC  = new Map<string, FightC>()
const matchesD = new Map<string, MatchD>()

let _seq = 1
function newId() { return `mock-${_seq++}` }

// ── Teams ──────────────────────────────────────────────────────────────────

export function getTeams(category: string): Team[] {
  return [...teams.values()].filter(t => t.category === category)
}

export function addTeam(data: { name: string; school: string; category: string }): Team {
  const team: Team = {
    id: newId(),
    category: data.category as Team['category'],
    name: data.name.trim(),
    school: data.school.trim(),
    group_letter: null,
    created_at: new Date().toISOString(),
  }
  teams.set(team.id, team)
  return team
}

export function deleteTeam(id: string) {
  teams.delete(id)
  resultsA.delete(id)
}

// ── Results A ─────────────────────────────────────────────────────────────

export function getResultsA(teamIds: string[]): ResultA[] {
  return teamIds.flatMap(id => {
    const r = resultsA.get(id)
    return r ? [r] : []
  })
}

export function upsertResultA(data: {
  team_id: string
  run1: number | null
  run2: number | null
  penalty: ResultA['penalty']
}): ResultA {
  const best = [data.run1, data.run2]
    .filter((v): v is number => v !== null)
    .reduce((a, b) => Math.min(a, b), Infinity)

  const penaltySec = data.penalty === '20' ? 20 : data.penalty === '40' ? 40 : 0
  const total = data.penalty === 'dnf' || data.penalty === 'disq'
    ? null
    : isFinite(best) ? best + penaltySec : null

  const result: ResultA = {
    team_id: data.team_id,
    run1: data.run1,
    run2: data.run2,
    penalty: data.penalty,
    total,
    updated_at: new Date().toISOString(),
  }
  resultsA.set(data.team_id, result)
  return result
}

// ── Matches B ─────────────────────────────────────────────────────────────

export function getMatchesB(): MatchB[] {
  return [...matchesB.values()]
}

export function addMatchB(data: {
  team1_id: string
  team2_id: string
  winner: 0 | 1 | 2
  rounds1: number
  rounds2: number
}): MatchB {
  const match: MatchB = { ...data, id: newId(), created_at: new Date().toISOString() }
  matchesB.set(match.id, match)
  return match
}

export function deleteMatchB(id: string) { matchesB.delete(id) }

// ── Fights C ──────────────────────────────────────────────────────────────

export function getFightsC(): FightC[] {
  return [...fightsC.values()]
}

export function addFightC(data: {
  team1_id: string
  team2_id: string
  winner: 1 | 2
  method: FightC['method']
  judge_score1: number
  judge_score2: number
}): FightC {
  const fight: FightC = { ...data, id: newId(), created_at: new Date().toISOString() }
  fightsC.set(fight.id, fight)
  return fight
}

export function deleteFightC(id: string) { fightsC.delete(id) }

// ── Matches D ─────────────────────────────────────────────────────────────

export function getMatchesD(): MatchD[] {
  return [...matchesD.values()]
}

export function addMatchD(data: {
  team1_id: string
  team2_id: string
  goals1: number
  goals2: number
}): MatchD {
  const match: MatchD = { ...data, id: newId(), created_at: new Date().toISOString() }
  matchesD.set(match.id, match)
  return match
}

export function deleteMatchD(id: string) { matchesD.delete(id) }
