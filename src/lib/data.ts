import type { Category, Team, ResultA, MatchB, FightC, MatchD, LiveStateB } from '@/types/database'
import { MOCK_TEAMS_A, MOCK_TEAMS_B, MOCK_TEAMS_C, MOCK_TEAMS_D, getMockResultsA, getMockMatchesB, getMockFightsC, getMockMatchesD } from './mock-data'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function getSupabaseServer() {
  if (!hasSupabase) return null
  const { createClient } = await import('./supabase/server')
  return createClient()
}

export async function getTeams(category: Category): Promise<Team[]> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getTeams: storeGet } = await import('./mock-store')
    const stored = storeGet(category)
    if (stored.length > 0) return stored
    return ({ a: MOCK_TEAMS_A, b: MOCK_TEAMS_B, c: MOCK_TEAMS_C, d: MOCK_TEAMS_D })[category] ?? []
  }
  const { data } = await supabase.from('teams').select('*').eq('category', category).order('created_at')
  return (data ?? []) as Team[]
}

export async function getResultsA(): Promise<ResultA[]> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getTeams: storeGet, getResultsA: storeResults } = await import('./mock-store')
    const stored = storeGet('a')
    if (stored.length > 0) return storeResults()
    return getMockResultsA()
  }
  const { data } = await supabase.from('results_a').select('*')
  return (data ?? []) as ResultA[]
}

export async function getMatchesB(): Promise<MatchB[]> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getTeams, getMatchesB: storeGet } = await import('./mock-store')
    return getTeams('b').length > 0 ? storeGet() : getMockMatchesB()
  }
  const { data } = await supabase.from('matches_b').select('*').order('created_at')
  return (data ?? []) as MatchB[]
}

export async function getFightsC(): Promise<FightC[]> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getTeams, getFightsC: storeGet } = await import('./mock-store')
    return getTeams('c').length > 0 ? storeGet() : getMockFightsC()
  }
  const { data } = await supabase.from('fights_c').select('*').order('created_at')
  return (data ?? []) as FightC[]
}

export async function getMatchesD(): Promise<MatchD[]> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getTeams, getMatchesD: storeGet } = await import('./mock-store')
    return getTeams('d').length > 0 ? storeGet() : getMockMatchesD()
  }
  const { data } = await supabase.from('matches_d').select('*').order('created_at')
  return (data ?? []) as MatchD[]
}

export async function getLiveStateB(): Promise<LiveStateB> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getLiveB } = await import('./mock-store')
    return getLiveB()
  }
  const { data } = await supabase.from('live_match_state').select('*').eq('category', 'b').maybeSingle()
  if (!data) {
    return {
      category: 'b',
      active_match_id: null,
      phase: 'idle',
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
      updated_at: new Date().toISOString(),
    }
  }
  return data as LiveStateB
}

// Live state for category A. Same shape as B (re-used for MVP) but isolated row.
export async function getLiveStateA(): Promise<LiveStateB> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getLiveA } = await import('./mock-store')
    return getLiveA()
  }
  const { data } = await supabase.from('live_match_state').select('*').eq('category', 'a').maybeSingle()
  if (!data) {
    return {
      category: 'a',
      active_match_id: null,
      phase: 'idle',
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
      updated_at: new Date().toISOString(),
    }
  }
  return data as LiveStateB
}

// Live state for category D. Mapping:
// wins_red = goals red, wins_white = goals blue
// round_number = 1 (1st half) | 2 (2nd half) | 3 (ET) | 4 (penalties)
// round_history = [{time:'01:23', side:'red', half:1}, ...]
export async function getLiveStateD(): Promise<LiveStateB> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getLiveD } = await import('./mock-store')
    return getLiveD()
  }
  const { data } = await supabase.from('live_match_state').select('*').eq('category', 'd').maybeSingle()
  if (!data) {
    return {
      category: 'd',
      active_match_id: null,
      phase: 'idle',
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
      updated_at: new Date().toISOString(),
    }
  }
  return data as LiveStateB
}

// Live state for category C. Same shape as B, isolated row. Mapping:
// wins_red = judge score team1 (0-100), wins_white = team2, round_history[0] = {method:'KO'|'IMM'|'JD',score_a,score_b,winner}
export async function getLiveStateC(): Promise<LiveStateB> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getLiveC } = await import('./mock-store')
    return getLiveC()
  }
  const { data } = await supabase.from('live_match_state').select('*').eq('category', 'c').maybeSingle()
  if (!data) {
    return {
      category: 'c',
      active_match_id: null,
      phase: 'idle',
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
      updated_at: new Date().toISOString(),
    }
  }
  return data as LiveStateB
}
