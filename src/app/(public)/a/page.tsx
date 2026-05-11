export const dynamic = 'force-dynamic'

import { getTeams, getResultsA } from '@/lib/data'
import { computeStandingsA } from '@/lib/standings/a'
import RealtimeStandings from '@/components/public/RealtimeStandings'

export default async function LineFollowerPage() {
  const [teams, results] = await Promise.all([getTeams('a'), getResultsA()])
  const standings = computeStandingsA(teams, results)
  return <RealtimeStandings category="a" data={standings} />
}
