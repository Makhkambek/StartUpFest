import type {
  Team,
  ResultA,
  MatchB,
  FightC,
  MatchD,
  Category,
  PenaltyA,
  StartingPosition,
  RunPhase,
  MatchPhase,
} from '@/types/database'

let counter = 0
const nextId = () => `t-${++counter}`

export function makeTeam(opts: Partial<Team> & { category: Category }): Team {
  const id = opts.id ?? nextId()
  return {
    id,
    category: opts.category,
    city_code: opts.city_code ?? 'TSH',
    name: opts.name ?? `Team ${id}`,
    school: opts.school ?? 'School X',
    group_letter: opts.group_letter ?? null,
    created_at: opts.created_at ?? new Date(2026, 4, 1).toISOString(),
  }
}

export function makeResultA(opts: Partial<ResultA> & { team_id: string }): ResultA {
  return {
    scheduled_match_id: opts.scheduled_match_id ?? null,
    team_id: opts.team_id,
    run1: opts.run1 ?? null,
    run2: opts.run2 ?? null,
    penalty: opts.penalty ?? ('0' as PenaltyA),
    total: opts.total ?? null,
    notes: opts.notes ?? null,
    run_phase: opts.run_phase ?? ('qualification' as RunPhase),
    updated_at: opts.updated_at ?? new Date().toISOString(),
  }
}

export function makeMatchB(opts: Partial<MatchB> & { team1_id: string; team2_id: string }): MatchB {
  return {
    id: opts.id ?? nextId(),
    scheduled_match_id: opts.scheduled_match_id ?? null,
    match_number: opts.match_number ?? null,
    team1_id: opts.team1_id,
    team2_id: opts.team2_id,
    winner: opts.winner ?? 0,
    rounds1: opts.rounds1 ?? 0,
    rounds2: opts.rounds2 ?? 0,
    starting_position: opts.starting_position ?? ('face' as StartingPosition),
    notes: opts.notes ?? null,
    created_at: opts.created_at ?? new Date().toISOString(),
  }
}

export function makeFightC(opts: Partial<FightC> & { team1_id: string; team2_id: string }): FightC {
  return {
    id: opts.id ?? nextId(),
    scheduled_match_id: opts.scheduled_match_id ?? null,
    fight_number: opts.fight_number ?? null,
    team1_id: opts.team1_id,
    team2_id: opts.team2_id,
    winner: opts.winner ?? 1,
    method: opts.method ?? 'JD',
    judge_score1: opts.judge_score1 ?? 0,
    judge_score2: opts.judge_score2 ?? 0,
    notes: opts.notes ?? null,
    created_at: opts.created_at ?? new Date().toISOString(),
  }
}

export function makeMatchD(opts: Partial<MatchD> & { team1_id: string; team2_id: string }): MatchD {
  return {
    id: opts.id ?? nextId(),
    scheduled_match_id: opts.scheduled_match_id ?? null,
    match_number: opts.match_number ?? null,
    team1_id: opts.team1_id,
    team2_id: opts.team2_id,
    goals1: opts.goals1 ?? 0,
    goals2: opts.goals2 ?? 0,
    match_phase: opts.match_phase ?? ('group' as MatchPhase),
    notes: opts.notes ?? null,
    created_at: opts.created_at ?? new Date().toISOString(),
  }
}
