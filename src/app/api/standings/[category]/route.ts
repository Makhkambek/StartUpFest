import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { Team, ResultA, MatchB, FightC, MatchD } from '@/types/database'
import { computeStandingsA } from '@/lib/standings/a'
import { computeStandingsB } from '@/lib/standings/b'
import { computeStandingsC } from '@/lib/standings/c'
import { computeStandingsD } from '@/lib/standings/d'
import { getActiveCityCode } from '@/lib/get-active-city-code'

// In-process cache for the public scoreboard. Without a CDN in front, the
// browser/CDN Cache-Control header alone doesn't protect us — every cold hit
// would recompute. unstable_cache deduplicates across concurrent requests and
// re-runs at most every `revalidate` seconds, so a 1000 req/s flood collapses
// to one DB read per 5s. Tag-based revalidation lets judge mutations punch
// through the cache when they need to (call revalidateTag('standings-X')).
const CACHE_HEADER = 'public, s-maxage=5, stale-while-revalidate=5'
const REVALIDATE_SECONDS = 5

// cookies() cannot be called inside unstable_cache (runs outside request context
// in Next.js 16). Standings are public reads so we use a plain anon client.
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function withCache(body: unknown): NextResponse {
  const res = NextResponse.json(body)
  res.headers.set('Cache-Control', CACHE_HEADER)
  return res
}

const standingsA = unstable_cache(
  async () => {
    const cityCode = await getActiveCityCode()
    const supabase = db()
    const [{ data: teams }, { data: results }] = await Promise.all([
      supabase.from('teams').select('*').eq('category', 'a').eq('city_code', cityCode).order('created_at'),
      supabase.from('results_a').select('*').eq('city_code', cityCode),
    ])
    return computeStandingsA((teams ?? []) as Team[], (results ?? []) as ResultA[])
  },
  ['standings-a'],
  { revalidate: REVALIDATE_SECONDS, tags: ['standings', 'standings-a'] },
)

const standingsB = unstable_cache(
  async () => {
    const cityCode = await getActiveCityCode()
    const supabase = db()
    const [{ data: teams }, { data: matches }] = await Promise.all([
      supabase.from('teams').select('*').eq('category', 'b').eq('city_code', cityCode).order('created_at'),
      supabase.from('matches_b').select('*').eq('city_code', cityCode).order('created_at'),
    ])
    return computeStandingsB((teams ?? []) as Team[], (matches ?? []) as MatchB[])
  },
  ['standings-b'],
  { revalidate: REVALIDATE_SECONDS, tags: ['standings', 'standings-b'] },
)

const standingsC = unstable_cache(
  async () => {
    const cityCode = await getActiveCityCode()
    const supabase = db()
    const [{ data: teams }, { data: fights }] = await Promise.all([
      supabase.from('teams').select('*').eq('category', 'c').eq('city_code', cityCode).order('created_at'),
      supabase.from('fights_c').select('*').eq('city_code', cityCode).order('created_at'),
    ])
    return computeStandingsC((teams ?? []) as Team[], (fights ?? []) as FightC[])
  },
  ['standings-c'],
  { revalidate: REVALIDATE_SECONDS, tags: ['standings', 'standings-c'] },
)

const standingsD = unstable_cache(
  async () => {
    const cityCode = await getActiveCityCode()
    const supabase = db()
    const [{ data: teams }, { data: matches }] = await Promise.all([
      supabase.from('teams').select('*').eq('category', 'd').eq('city_code', cityCode).order('created_at'),
      supabase.from('matches_d').select('*').eq('city_code', cityCode).order('created_at'),
    ])
    return computeStandingsD((teams ?? []) as Team[], (matches ?? []) as MatchD[])
  },
  ['standings-d'],
  { revalidate: REVALIDATE_SECONDS, tags: ['standings', 'standings-d'] },
)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params

  if (category === 'a') return withCache(await standingsA())
  if (category === 'b') return withCache(await standingsB())
  if (category === 'c') return withCache(await standingsC())
  if (category === 'd') return withCache(await standingsD())

  return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
}
