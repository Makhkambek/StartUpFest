import { NextRequest, NextResponse } from 'next/server'
import { getTeams, getResultsA, getMatchesB, getFightsC, getMatchesD } from '@/lib/data'
import { computeStandingsA } from '@/lib/standings/a'
import { computeStandingsB } from '@/lib/standings/b'
import { computeStandingsC } from '@/lib/standings/c'
import { computeStandingsD } from '@/lib/standings/d'

// Short CDN cache + stale-while-revalidate so the public scoreboard can be
// hammered without recomputing on every request. Tuned to keep the public
// page responsive while still surfacing new judge entries within ~10s.
const CACHE_HEADER = 'public, s-maxage=10, stale-while-revalidate=30'

function withCache(body: unknown): NextResponse {
  const res = NextResponse.json(body)
  res.headers.set('Cache-Control', CACHE_HEADER)
  return res
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params

  if (category === 'a') {
    const [teams, results] = await Promise.all([getTeams('a'), getResultsA()])
    return withCache(computeStandingsA(teams, results))
  }
  if (category === 'b') {
    const [teams, matches] = await Promise.all([getTeams('b'), getMatchesB()])
    return withCache(computeStandingsB(teams, matches))
  }
  if (category === 'c') {
    const [teams, fights] = await Promise.all([getTeams('c'), getFightsC()])
    return withCache(computeStandingsC(teams, fights))
  }
  if (category === 'd') {
    const [teams, matches] = await Promise.all([getTeams('d'), getMatchesD()])
    return withCache(computeStandingsD(teams, matches))
  }

  return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
}
