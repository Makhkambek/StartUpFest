export const dynamic = 'force-dynamic'

import { getTeams, getMatchesD } from '@/lib/data'
import { computeStandingsD } from '@/lib/standings/d'
import RealtimeStandings from '@/components/public/RealtimeStandings'

export default async function RoboFootballPage() {
  const [teams, matches] = await Promise.all([getTeams('d'), getMatchesD()])
  const standings = computeStandingsD(teams, matches)
  return <RealtimeStandings category="d" data={standings} />
}
