import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getTeams, getResultsA, getMatchesB, getFightsC, getMatchesD } from '@/lib/data'
import { computeStandingsA } from '@/lib/standings/a'
import { computeStandingsB } from '@/lib/standings/b'
import { computeStandingsC } from '@/lib/standings/c'
import { computeStandingsD } from '@/lib/standings/d'

// In-process cache for the public scoreboard. Without a CDN in front, the
// browser/CDN Cache-Control header alone doesn't protect us — every cold hit
// would recompute. unstable_cache deduplicates across concurrent requests and
// re-runs at most every `revalidate` seconds, so a 1000 req/s flood collapses
// to one DB read per 5s. Tag-based revalidation lets judge mutations punch
// through the cache when they need to (call revalidateTag('standings-X')).
const CACHE_HEADER = 'public, s-maxage=10, stale-while-revalidate=30'
const REVALIDATE_SECONDS = 5

function withCache(body: unknown): NextResponse {
  const res = NextResponse.json(body)
  res.headers.set('Cache-Control', CACHE_HEADER)
  return res
}

const standingsA = unstable_cache(
  async () => {
    const [teams, results] = await Promise.all([getTeams('a'), getResultsA()])
    return computeStandingsA(teams, results)
  },
  ['standings-a'],
  { revalidate: REVALIDATE_SECONDS, tags: ['standings', 'standings-a'] },
)

const standingsB = unstable_cache(
  async () => {
    const [teams, matches] = await Promise.all([getTeams('b'), getMatchesB()])
    return computeStandingsB(teams, matches)
  },
  ['standings-b'],
  { revalidate: REVALIDATE_SECONDS, tags: ['standings', 'standings-b'] },
)

const standingsC = unstable_cache(
  async () => {
    const [teams, fights] = await Promise.all([getTeams('c'), getFightsC()])
    return computeStandingsC(teams, fights)
  },
  ['standings-c'],
  { revalidate: REVALIDATE_SECONDS, tags: ['standings', 'standings-c'] },
)

const standingsD = unstable_cache(
  async () => {
    const [teams, matches] = await Promise.all([getTeams('d'), getMatchesD()])
    return computeStandingsD(teams, matches)
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
