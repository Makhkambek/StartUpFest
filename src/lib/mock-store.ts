import type { Team, ResultA, MatchB, FightC, MatchD } from '@/types/database'

// Module-level mutable store — persists for the lifetime of the dev server process.
// Reset on server restart. Replaced by Supabase when env vars are present.

const teams = new Map<string, Team>()
const resultsA = new Map<string, ResultA>() // keyed by scheduled_match_id
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

export function getResultsA(): ResultA[] {
  return [...resultsA.values()]
}

export function upsertResultA(data: {
  scheduled_match_id: string
  team_id: string
  run1: number | null
  run2: number | null
  penalty: ResultA['penalty']
  run_phase?: ResultA['run_phase']
  notes?: string | null
}): ResultA {
  const best = [data.run1, data.run2]
    .filter((v): v is number => v !== null)
    .reduce((a, b) => Math.min(a, b), Infinity)

  const penaltySec = data.penalty === '20' ? 20 : data.penalty === '40' ? 40 : 0
  const total = data.penalty === 'dnf' || data.penalty === 'disq'
    ? null
    : isFinite(best) ? best + penaltySec : null

  const result: ResultA = {
    scheduled_match_id: data.scheduled_match_id,
    team_id: data.team_id,
    run1: data.run1,
    run2: data.run2,
    penalty: data.penalty,
    run_phase: data.run_phase ?? 'qualification',
    notes: data.notes ?? null,
    total,
    updated_at: new Date().toISOString(),
  }
  resultsA.set(data.scheduled_match_id, result)
  return result
}

export function deleteResultA(scheduled_match_id: string) {
  resultsA.delete(scheduled_match_id)
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
  match_number?: number | null
  starting_position?: MatchB['starting_position']
  notes?: string | null
}): MatchB {
  const match: MatchB = {
    id: newId(),
    match_number: data.match_number ?? null,
    team1_id: data.team1_id,
    team2_id: data.team2_id,
    winner: data.winner,
    rounds1: data.rounds1,
    rounds2: data.rounds2,
    starting_position: data.starting_position ?? 'face',
    notes: data.notes ?? null,
    created_at: new Date().toISOString(),
  }
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
  fight_number?: number | null
  notes?: string | null
}): FightC {
  const fight: FightC = {
    id: newId(),
    fight_number: data.fight_number ?? null,
    team1_id: data.team1_id,
    team2_id: data.team2_id,
    winner: data.winner,
    method: data.method,
    judge_score1: data.judge_score1,
    judge_score2: data.judge_score2,
    notes: data.notes ?? null,
    created_at: new Date().toISOString(),
  }
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
  match_number?: number | null
  match_phase?: MatchD['match_phase']
  notes?: string | null
}): MatchD {
  const match: MatchD = {
    id: newId(),
    match_number: data.match_number ?? null,
    team1_id: data.team1_id,
    team2_id: data.team2_id,
    goals1: data.goals1,
    goals2: data.goals2,
    match_phase: data.match_phase ?? 'group',
    notes: data.notes ?? null,
    created_at: new Date().toISOString(),
  }
  matchesD.set(match.id, match)
  return match
}

export function deleteMatchD(id: string) { matchesD.delete(id) }
