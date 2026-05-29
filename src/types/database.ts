export type Category = 'a' | 'b' | 'c' | 'd'

export interface Team {
  id: string
  category: Category
  city_code: string
  name: string
  school: string
  group_letter: string | null
  created_at: string
}

export type PenaltyA = '0' | '20' | '40' | 'dnf' | 'disq'
export type RunPhase = 'qualification' | 'final'
export type StartingPosition = 'face' | 'side' | 'back'
export type MatchPhase = 'group' | 'extra' | 'penalties'

export interface ResultA {
  id?: string
  city_code?: string
  scheduled_match_id: string | null
  team_id: string
  run1: number | null
  run2: number | null
  penalty: PenaltyA
  total: number | null
  notes: string | null
  run_phase: RunPhase
  updated_at: string
}

export interface MatchB {
  id: string
  city_code?: string
  scheduled_match_id?: string | null
  match_number: number | null
  team1_id: string
  team2_id: string
  winner: 1 | 2 | 0
  rounds1: number
  rounds2: number
  starting_position: StartingPosition
  notes: string | null
  created_at: string
}

export interface FightC {
  id: string
  city_code?: string
  scheduled_match_id?: string | null
  fight_number: number | null
  team1_id: string
  team2_id: string
  winner: 1 | 2
  method: 'KO' | 'IMM' | 'JD'
  judge_score1: number
  judge_score2: number
  notes: string | null
  created_at: string
}

export interface MatchD {
  id: string
  city_code?: string
  scheduled_match_id?: string | null
  match_number: number | null
  team1_id: string
  team1b_id?: string | null
  team2_id: string
  team2b_id?: string | null
  goals1: number
  goals2: number
  team1_forfeit?: boolean
  team1b_forfeit?: boolean
  team2_forfeit?: boolean
  team2b_forfeit?: boolean
  match_phase: MatchPhase
  notes: string | null
  created_at: string
}

export interface Profile {
  id: string
  username: string
  is_admin: boolean
  created_at: string
}

export interface JudgeCategory {
  judge_id: string
  category: Category
}

// ── Live match state (field display) ────────────────────

export type LivePhaseB =
  | 'idle'           // no active match
  | 'waiting'        // teams announced, robots not yet on ring
  | 'positioning'    // judge sets starting position
  | 'countdown'      // 5s countdown running
  | 'fighting'       // round in progress
  | 'round_result'   // round ended, showing result before next
  | 'match_result'   // match ended, showing winner

export type RoundOutcome = 'red' | 'white' | 'draw'

export interface LiveStateB {
  // The shape is shared across all 4 categories — the `category` field
  // identifies which one this row belongs to. (Name preserved for backwards
  // compat with existing imports.)
  category: Category
  city_code: string
  active_match_id: string | null
  phase: LivePhaseB
  round_number: number              // 1, 2, 3, or 4 (golden match)
  wins_red: number
  wins_white: number
  starting_position: StartingPosition | null
  last_round_winner: RoundOutcome | null
  match_winner: 1 | 2 | 0 | null    // 1=red, 2=white, 0=draw, null=ongoing
  countdown_started_at: string | null  // ISO timestamp; client computes remaining
  fight_started_at: string | null      // ISO timestamp set by server when fighting begins; elapsed computed server-side
  fouls_red: number
  fouls_white: number
  round_history: RoundOutcome[]
  finals_visible: boolean
  updated_at: string
}

// ── Computed standings rows ─────────────────────────────

export type StatusA = 'finalist' | 'qualified' | 'elim' | 'dnf' | 'disq'

export interface StandingA {
  rank: number
  team: Team
  run1: number | null
  run2: number | null
  penalty: string
  total: number | null
  status: StatusA
}

export type StatusB = 'finalist' | 'qualified' | 'elim'

export interface StandingB {
  rank: number
  team: Team
  wins: number
  draws: number
  losses: number
  round_wins: number
  points: number
  status: StatusB
}

export interface StandingC {
  rank: number
  team: Team
  wins: number
  draws: number
  losses: number
  points: number
  judge_score: number
  knockouts: number
}

export interface StandingD {
  rank: number
  team: Team
  wins: number
  draws: number
  losses: number
  points: number
  goals_for: number
  goals_against: number
  goal_diff: number
}

// Single-row settings table for the running event (city + year + optional name).
// Edited by admin once per regional event; consumed by all field displays / PDFs.
export interface EventSettings {
  id: 1
  city_code: string         // UZ_CITIES[].code — 3-letter slug (e.g. "TSH", "BUX")
  year: number
  event_name: string | null
  updated_at: string
}
