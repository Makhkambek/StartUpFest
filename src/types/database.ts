export type Category = 'a' | 'b' | 'c' | 'd'

export interface Team {
  id: string
  category: Category
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
  match_number: number | null
  team1_id: string
  team2_id: string
  goals1: number
  goals2: number
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
