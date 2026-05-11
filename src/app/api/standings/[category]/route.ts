import { NextRequest, NextResponse } from 'next/server'
import { getTeams, getResultsA, getMatchesB, getFightsC, getMatchesD } from '@/lib/data'
import { computeStandingsA } from '@/lib/standings/a'
import { computeStandingsB } from '@/lib/standings/b'
import { computeStandingsC } from '@/lib/standings/c'
import { computeStandingsD } from '@/lib/standings/d'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params

  if (category === 'a') {
    const [teams, results] = await Promise.all([getTeams('a'), getResultsA()])
    return NextResponse.json(computeStandingsA(teams, results))
  }
  if (category === 'b') {
    const [teams, matches] = await Promise.all([getTeams('b'), getMatchesB()])
    return NextResponse.json(computeStandingsB(teams, matches))
  }
  if (category === 'c') {
    const [teams, fights] = await Promise.all([getTeams('c'), getFightsC()])
    return NextResponse.json(computeStandingsC(teams, fights))
  }
  if (category === 'd') {
    const [teams, matches] = await Promise.all([getTeams('d'), getMatchesD()])
    return NextResponse.json(computeStandingsD(teams, matches))
  }

  return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
}
