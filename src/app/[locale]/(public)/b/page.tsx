export const dynamic = 'force-dynamic'

import { getTeams, getMatchesB } from '@/lib/data'
import { computeStandingsB } from '@/lib/standings/b'
import RealtimeStandings from '@/components/public/RealtimeStandings'

export default async function MiniSumoPage() {
  const [teams, matches] = await Promise.all([getTeams('b'), getMatchesB()])
  const standings = computeStandingsB(teams, matches)
  return <RealtimeStandings category="b" data={standings} />
}
