import type { Team, ResultA, MatchB, FightC, MatchD, LiveStateB, LivePhaseB, RoundOutcome, StartingPosition, EventSettings } from '@/types/database'

// Module-level mutable store — persists for the lifetime of the dev server process.
// Reset on server restart. Replaced by Supabase when env vars are present.

const MAX_STORE_SIZE = 500

// Trim oldest 20% of entries when map exceeds MAX_STORE_SIZE.
// Maps maintain insertion order in V8/Node, so the first keys are the oldest.
function pruneIfNeeded<K, V>(map: Map<K, V>) {
  if (map.size <= MAX_STORE_SIZE) return
  const toDelete = Math.floor(MAX_STORE_SIZE * 0.2)
  const iter = map.keys()
  for (let i = 0; i < toDelete; i++) {
    const next = iter.next()
    if (!next.done) map.delete(next.value)
  }
}

const teams = new Map<string, Team>()
const resultsA = new Map<string, ResultA>() // keyed by scheduled_match_id
const matchesB = new Map<string, MatchB>()
const fightsC  = new Map<string, FightC>()
const matchesD = new Map<string, MatchD>()

let _seq = 1
function newId() { return `mock-${_seq++}` }

// ── Teams ──────────────────────────────────────────────────────────────────

export function getTeams(category: string): Team[] {
  // Sort by created_at to match Supabase's `.order('created_at')` output —
  // keeps UI ordering stable across mock ↔ Supabase modes.
  return [...teams.values()]
    .filter(t => t.category === category)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function addTeam(data: { name: string; school: string; category: string }): Team {
  const team: Team = {
    id: newId(),
    category: data.category as Team['category'],
    city_code: 'MOCK',
    name: data.name.trim(),
    school: data.school.trim(),
    group_letter: null,
    created_at: new Date().toISOString(),
  }
  teams.set(team.id, team)
  pruneIfNeeded(teams)
  return team
}

/**
 * Removes a team and cascades to all of its results/matches/fights so the
 * mock store doesn't keep orphaned references that break standings or
 * field displays.
 */
export function deleteTeam(id: string) {
  teams.delete(id)
  // Result A is keyed by scheduled_match_id, not team_id — scan values.
  for (const [k, r] of resultsA) {
    if (r.team_id === id) resultsA.delete(k)
  }
  for (const [k, m] of matchesB) {
    if (m.team1_id === id || m.team2_id === id) matchesB.delete(k)
  }
  for (const [k, f] of fightsC) {
    if (f.team1_id === id || f.team2_id === id) fightsC.delete(k)
  }
  for (const [k, m] of matchesD) {
    if (m.team1_id === id || m.team2_id === id) matchesD.delete(k)
  }
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
  pruneIfNeeded(resultsA)
  return result
}

export function deleteResultA(scheduled_match_id: string) {
  resultsA.delete(scheduled_match_id)
}

// ── Matches B ─────────────────────────────────────────────────────────────

export function getMatchesB(): MatchB[] {
  return [...matchesB.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
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
  pruneIfNeeded(matchesB)
  return match
}

export function deleteMatchB(id: string) { matchesB.delete(id) }

// ── Fights C ──────────────────────────────────────────────────────────────

export function getFightsC(): FightC[] {
  return [...fightsC.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
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
  pruneIfNeeded(fightsC)
  return fight
}

export function deleteFightC(id: string) { fightsC.delete(id) }

// ── Matches D ─────────────────────────────────────────────────────────────

export function getMatchesD(): MatchD[] {
  return [...matchesD.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function addMatchD(data: {
  team1_id: string
  team1b_id?: string | null
  team2_id: string
  team2b_id?: string | null
  goals1: number
  goals2: number
  team1_forfeit?: boolean; team1b_forfeit?: boolean
  team2_forfeit?: boolean; team2b_forfeit?: boolean
  match_number?: number | null
  match_phase?: MatchD['match_phase']
  notes?: string | null
}): MatchD {
  const match: MatchD = {
    id: newId(),
    match_number: data.match_number ?? null,
    team1_id: data.team1_id,
    team1b_id: data.team1b_id ?? null,
    team2_id: data.team2_id,
    team2b_id: data.team2b_id ?? null,
    goals1: data.goals1,
    goals2: data.goals2,
    team1_forfeit: data.team1_forfeit ?? false,
    team1b_forfeit: data.team1b_forfeit ?? false,
    team2_forfeit: data.team2_forfeit ?? false,
    team2b_forfeit: data.team2b_forfeit ?? false,
    match_phase: data.match_phase ?? 'group',
    notes: data.notes ?? null,
    created_at: new Date().toISOString(),
  }
  matchesD.set(match.id, match)
  pruneIfNeeded(matchesD)
  return match
}

export function deleteMatchD(id: string) { matchesD.delete(id) }

// ── Live state B (field display for Mini Sumo) ────────────────────────────

const initialLiveB: LiveStateB = {
  category: 'b',
  city_code: 'MOCK',
  active_match_id: null,
  phase: 'idle',
  round_number: 1,
  wins_red: 0,
  wins_white: 0,
  starting_position: null,
  last_round_winner: null,
  match_winner: null,
  countdown_started_at: null,
  fight_started_at: null,
  fouls_red: 0,
  fouls_white: 0,
  round_history: [],
  finals_visible: false,
  updated_at: new Date().toISOString(),
}

let liveB: LiveStateB = { ...initialLiveB, category: 'b' }
let liveA: LiveStateB = { ...initialLiveB, category: 'a' }
let liveC: LiveStateB = { ...initialLiveB, category: 'c' }
let liveD: LiveStateB = { ...initialLiveB, category: 'd' }

export function getLiveB(): LiveStateB {
  return liveB
}

export function getLiveA(): LiveStateB {
  return liveA
}

export function setLiveA(patch: Partial<LiveStateB>): LiveStateB {
  liveA = { ...liveA, ...patch, updated_at: new Date().toISOString() }
  return liveA
}

export function getLiveC(): LiveStateB {
  return liveC
}

export function setLiveC(patch: Partial<LiveStateB>): LiveStateB {
  liveC = { ...liveC, ...patch, updated_at: new Date().toISOString() }
  return liveC
}

export function getLiveD(): LiveStateB {
  return liveD
}

export function setLiveD(patch: Partial<LiveStateB>): LiveStateB {
  liveD = { ...liveD, ...patch, updated_at: new Date().toISOString() }
  return liveD
}

export type LivePatchB = Partial<Pick<LiveStateB,
  'active_match_id' | 'phase' | 'round_number' | 'wins_red' | 'wins_white' |
  'starting_position' | 'last_round_winner' | 'match_winner' |
  'countdown_started_at' | 'fouls_red' | 'fouls_white' | 'round_history' | 'finals_visible'
>>

export function setLiveB(patch: LivePatchB): LiveStateB {
  liveB = { ...liveB, ...patch, updated_at: new Date().toISOString() }
  return liveB
}

export function resetLiveB(): LiveStateB {
  liveB = { ...initialLiveB, updated_at: new Date().toISOString() }
  return liveB
}

// High-level transitions used by judge UI
export function liveB_startMatch(active_match_id: string): LiveStateB {
  return setLiveB({
    active_match_id,
    phase: 'waiting',
    round_number: 1,
    wins_red: 0,
    wins_white: 0,
    starting_position: null,
    last_round_winner: null,
    match_winner: null,
    countdown_started_at: null,
    fouls_red: 0,
    fouls_white: 0,
    round_history: [],
  })
}

export function liveB_setPosition(pos: StartingPosition): LiveStateB {
  return setLiveB({ phase: 'positioning', starting_position: pos })
}

export function liveB_startCountdown(): LiveStateB {
  return setLiveB({ phase: 'countdown', countdown_started_at: new Date().toISOString() })
}

export function liveB_cancelCountdown(): LiveStateB {
  return setLiveB({ phase: 'positioning', countdown_started_at: null })
}

export function liveB_goFight(): LiveStateB {
  // Anchor a fight-start timestamp so /field can render a count-up match timer.
  // We re-use countdown_started_at: fight elapsed = (now - countdown_started_at) - 5s.
  // If judge skipped the countdown entirely we still set it to (now − 5s) so elapsed starts at 0.
  const fightAnchor = new Date(Date.now() - 5000).toISOString()
  return setLiveB({ phase: 'fighting', countdown_started_at: fightAnchor })
}

export function liveB_roundResult(outcome: RoundOutcome): LiveStateB {
  const hist = [...liveB.round_history, outcome]
  const wr = liveB.wins_red + (outcome === 'red' ? 1 : 0)
  const ww = liveB.wins_white + (outcome === 'white' ? 1 : 0)
  return setLiveB({
    phase: 'round_result',
    last_round_winner: outcome,
    wins_red: wr,
    wins_white: ww,
    round_history: hist,
  })
}

export function liveB_nextRound(): LiveStateB {
  return setLiveB({
    phase: 'positioning',
    round_number: liveB.round_number + 1,
    last_round_winner: null,
    starting_position: null,
    countdown_started_at: null,
  })
}

export function liveB_endMatch(winner: 1 | 2 | 0): LiveStateB {
  return setLiveB({ phase: 'match_result', match_winner: winner })
}

export function liveB_addFoul(side: 'red' | 'white'): LiveStateB {
  return side === 'red'
    ? setLiveB({ fouls_red: liveB.fouls_red + 1 })
    : setLiveB({ fouls_white: liveB.fouls_white + 1 })
}

export function liveB_setPhase(phase: LivePhaseB): LiveStateB {
  return setLiveB({ phase })
}

// ── Event settings (single row, admin-controlled) ─────────────────────────

let eventSettings: EventSettings = {
  id: 1,
  city_code: 'TSH',
  year: new Date().getFullYear(),
  event_name: null,
  updated_at: new Date().toISOString(),
}

export function getEventSettings(): EventSettings {
  return eventSettings
}

export function setEventSettings(patch: Partial<Omit<EventSettings, 'id' | 'updated_at'>>): EventSettings {
  eventSettings = { ...eventSettings, ...patch, updated_at: new Date().toISOString() }
  return eventSettings
}
