// In-memory scheduled matches store (mock mode).
// In Supabase mode this is replaced by the `scheduled_matches` table.

export type MatchPhasePrefix = 'Q' | 'F' | 'SF' | 'E'

export type MatchPhase = 'qualification' | 'finals'
export type MatchRound = 'group' | 'r1' | 'r2' | 'quarter' | 'semi' | 'third_place' | 'final' | 'triangle' | 'round_robin'

export interface ScheduledMatch {
  id: string
  category: string
  match_id: string      // e.g. "Q-39", "F-1"
  team1_id: string
  team2_id: string | null   // null for solo-run categories (e.g. Line Follower)
  // Category D (Robo Football) uses 4-team alliances. team1b = red partner, team2b = blue partner.
  // NULL for categories A/B/C which use 1-vs-1 or solo formats.
  team1b_id?: string | null
  team2b_id?: string | null
  // Team IDs that are playing surrogate in this match — their result does not count for standings.
  surrogate_team_ids?: string[]
  status: 'pending' | 'waiting' | 'active' | 'completed'
  phase: MatchPhase
  round: MatchRound | null
  result_id: string | null
  notes: string | null  // judge notes — never shown publicly
  created_at: string
}

const store = new Map<string, ScheduledMatch>()
let _seq = 1
function newId() { return `sched-${_seq++}` }

export function getSchedule(category: string): ScheduledMatch[] {
  return [...store.values()].filter(m => m.category === category)
    .sort((a, b) => a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
}

export function addScheduledMatch(data: {
  category: string
  match_id: string
  team1_id: string
  team2_id: string | null
  team1b_id?: string | null
  team2b_id?: string | null
  surrogate_team_ids?: string[]
  phase?: MatchPhase
  round?: MatchRound | null
}): ScheduledMatch {
  const m: ScheduledMatch = {
    id: newId(),
    category: data.category,
    match_id: data.match_id,
    team1_id: data.team1_id,
    team2_id: data.team2_id,
    team1b_id: data.team1b_id ?? null,
    team2b_id: data.team2b_id ?? null,
    surrogate_team_ids: data.surrogate_team_ids ?? [],
    phase: data.phase ?? 'qualification',
    round: data.round ?? null,
    status: 'pending',
    result_id: null,
    notes: null,
    created_at: new Date().toISOString(),
  }
  store.set(m.id, m)
  return m
}

export function markComplete(id: string, result_id: string, notes: string | null) {
  const m = store.get(id)
  if (!m) return
  store.set(id, { ...m, status: 'completed', result_id, notes })
}

export function setMatchStatus(id: string, status: ScheduledMatch['status']) {
  const m = store.get(id)
  if (!m) return
  store.set(id, { ...m, status })
}

// For Cat D finals: set partner slot for a captain across all their finals matches.
export function setMatchPartnerD(category: string, captainId: string, partnerId: string | null) {
  for (const [id, m] of store) {
    if (m.category !== category || (m as ScheduledMatch & { phase?: string }).phase !== 'finals') continue
    if (m.team1_id === captainId) store.set(id, { ...m, team1b_id: partnerId })
    else if (m.team2_id === captainId) store.set(id, { ...m, team2b_id: partnerId })
  }
}

export function deleteScheduledMatch(id: string) {
  store.delete(id)
}

export function clearSchedule(category: string) {
  // Collect keys first to avoid mutating Map during iteration (concurrent
  // reader could miss/double-process entries otherwise).
  const ids: string[] = []
  for (const [id, m] of store) {
    if (m.category === category) ids.push(id)
  }
  for (const id of ids) store.delete(id)
}

export function getMatchById(id: string): ScheduledMatch | null {
  return store.get(id) ?? null
}

export function resetScheduleStatuses(category: string) {
  for (const [id, m] of store) {
    if (m.category === category) {
      store.set(id, { ...m, status: 'pending', result_id: null })
    }
  }
}
