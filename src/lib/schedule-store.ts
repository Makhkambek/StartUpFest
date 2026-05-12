// In-memory scheduled matches store (mock mode).
// In Supabase mode this is replaced by the `scheduled_matches` table.

export type MatchPhasePrefix = 'Q' | 'F' | 'SF' | 'E'

export type MatchPhase = 'qualification' | 'finals'
export type MatchRound = 'group' | 'r1' | 'r2' | 'quarter' | 'semi' | 'third_place' | 'final' | 'triangle'

export interface ScheduledMatch {
  id: string
  category: string
  match_id: string      // e.g. "Q-39", "F-1"
  team1_id: string
  team2_id: string | null   // null for solo-run categories (e.g. Line Follower)
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
  phase?: MatchPhase
  round?: MatchRound | null
}): ScheduledMatch {
  const m: ScheduledMatch = {
    id: newId(),
    category: data.category,
    match_id: data.match_id,
    team1_id: data.team1_id,
    team2_id: data.team2_id,
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

export function deleteScheduledMatch(id: string) {
  store.delete(id)
}

export function clearSchedule(category: string) {
  for (const [id, m] of store) {
    if (m.category === category) store.delete(id)
  }
}

export function getMatchById(id: string): ScheduledMatch | null {
  return store.get(id) ?? null
}
