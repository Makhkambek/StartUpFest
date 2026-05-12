import type { Category, Team, ResultA, MatchB, FightC, MatchD } from '@/types/database'
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
    if (category !== 'a') {
      return { b: MOCK_TEAMS_B, c: MOCK_TEAMS_C, d: MOCK_TEAMS_D }[category] ?? []
    }
    const { getTeams: storeGet } = await import('./mock-store')
    const stored = storeGet('a')
    return stored.length > 0 ? stored : MOCK_TEAMS_A
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
