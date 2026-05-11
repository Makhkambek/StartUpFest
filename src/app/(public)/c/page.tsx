export const dynamic = 'force-dynamic'

import { getTeams, getFightsC } from '@/lib/data'
import { computeStandingsC } from '@/lib/standings/c'
import RealtimeStandings from '@/components/public/RealtimeStandings'

export default async function MiniRoboWarPage() {
  const [teams, fights] = await Promise.all([getTeams('c'), getFightsC()])
  const standings = computeStandingsC(teams, fights)
  return <RealtimeStandings category="c" data={standings} />
}
