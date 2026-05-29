import type { Category, Team, ResultA, MatchB, FightC, MatchD, LiveStateB } from '@/types/database'
import { MOCK_TEAMS_A, MOCK_TEAMS_B, MOCK_TEAMS_C, MOCK_TEAMS_D, getMockResultsA, getMockMatchesB, getMockFightsC, getMockMatchesD } from './mock-data'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function getSupabaseServer() {
  if (!hasSupabase) return null
  const { createClient } = await import('./supabase/server')
  return createClient()
}

async function fetchCityCode(supabase: Awaited<ReturnType<typeof getSupabaseServer>>): Promise<string> {
  if (!supabase) return 'TSH'
  const { data } = await supabase.from('event_settings').select('city_code').eq('id', 1).single()
  return data?.city_code ?? 'TSH'
}

export async function getTeams(category: Category): Promise<Team[]> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getTeams: storeGet } = await import('./mock-store')
    const stored = storeGet(category)
    if (stored.length > 0) return stored
    return ({ a: MOCK_TEAMS_A, b: MOCK_TEAMS_B, c: MOCK_TEAMS_C, d: MOCK_TEAMS_D })[category] ?? []
  }
  const cityCode = await fetchCityCode(supabase)
  const { data } = await supabase.from('teams').select('*')
    .eq('category', category)
    .eq('city_code', cityCode)
    .order('created_at')
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
  const cityCode = await fetchCityCode(supabase)
  const { data } = await supabase.from('results_a').select('*').eq('city_code', cityCode)
  return (data ?? []) as ResultA[]
}

export async function getMatchesB(): Promise<MatchB[]> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getTeams, getMatchesB: storeGet } = await import('./mock-store')
    return getTeams('b').length > 0 ? storeGet() : getMockMatchesB()
  }
  const cityCode = await fetchCityCode(supabase)
  const { data } = await supabase.from('matches_b').select('*')
    .eq('city_code', cityCode)
    .order('created_at')
  return (data ?? []) as MatchB[]
}

export async function getFightsC(): Promise<FightC[]> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getTeams, getFightsC: storeGet } = await import('./mock-store')
    return getTeams('c').length > 0 ? storeGet() : getMockFightsC()
  }
  const cityCode = await fetchCityCode(supabase)
  const { data } = await supabase.from('fights_c').select('*')
    .eq('city_code', cityCode)
    .order('created_at')
  return (data ?? []) as FightC[]
}

export async function getMatchesD(): Promise<MatchD[]> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getTeams, getMatchesD: storeGet } = await import('./mock-store')
    return getTeams('d').length > 0 ? storeGet() : getMockMatchesD()
  }
  const cityCode = await fetchCityCode(supabase)
  const { data } = await supabase.from('matches_d').select('*')
    .eq('city_code', cityCode)
    .order('created_at')
  return (data ?? []) as MatchD[]
}

function defaultLiveState(category: string, cityCode = 'TSH'): LiveStateB {
  return {
    category: category as LiveStateB['category'],
    city_code: cityCode,
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
}

export async function getLiveStateB(): Promise<LiveStateB> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getLiveB } = await import('./mock-store')
    return getLiveB()
  }
  const cityCode = await fetchCityCode(supabase)
  const { data } = await supabase.from('live_match_state').select('*')
    .eq('category', 'b').eq('city_code', cityCode).maybeSingle()
  return (data as LiveStateB | null) ?? defaultLiveState('b', cityCode)
}

export async function getLiveStateA(): Promise<LiveStateB> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getLiveA } = await import('./mock-store')
    return getLiveA()
  }
  const cityCode = await fetchCityCode(supabase)
  const { data } = await supabase.from('live_match_state').select('*')
    .eq('category', 'a').eq('city_code', cityCode).maybeSingle()
  return (data as LiveStateB | null) ?? defaultLiveState('a', cityCode)
}

export async function getLiveStateD(): Promise<LiveStateB> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getLiveD } = await import('./mock-store')
    return getLiveD()
  }
  const cityCode = await fetchCityCode(supabase)
  const { data } = await supabase.from('live_match_state').select('*')
    .eq('category', 'd').eq('city_code', cityCode).maybeSingle()
  return (data as LiveStateB | null) ?? defaultLiveState('d', cityCode)
}

export async function getLiveStateC(): Promise<LiveStateB> {
  const supabase = await getSupabaseServer()
  if (!supabase) {
    const { getLiveC } = await import('./mock-store')
    return getLiveC()
  }
  const cityCode = await fetchCityCode(supabase)
  const { data } = await supabase.from('live_match_state').select('*')
    .eq('category', 'c').eq('city_code', cityCode).maybeSingle()
  return (data as LiveStateB | null) ?? defaultLiveState('c', cityCode)
}
