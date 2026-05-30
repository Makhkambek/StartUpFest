export const dynamic = 'force-dynamic'

import type { Category } from '@/types/database'
import { getTeams, getResultsA, getMatchesB, getFightsC, getMatchesD } from '@/lib/data'
import { computeStandingsA } from '@/lib/standings/a'
import { computeStandingsB } from '@/lib/standings/b'
import { computeStandingsC } from '@/lib/standings/c'
import { computeStandingsD } from '@/lib/standings/d'
import RealtimeStandings from '@/components/public/RealtimeStandings'

const CAT_META: Record<string, { label: string; icon: string; back: string }> = {
  a: { label: 'A · Line Follower',  icon: '🏎️', back: '/judges/a' },
  b: { label: 'B · Mini Sumo',      icon: '🤼', back: '/judges/b' },
  c: { label: 'C · MiniRoboWar',   icon: '⚔️', back: '/judges/c' },
  d: { label: 'D · Robo Football',  icon: '⚽', back: '/judges/d' },
}

export default async function JudgesViewPage({ params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params
  if (!['a', 'b', 'c', 'd'].includes(cat)) return <div className="p-8 text-gray-400">Invalid category</div>

  const category = cat as Category
  const meta = CAT_META[cat]

  let node: React.ReactNode
  if (category === 'a') {
    const [teams, results] = await Promise.all([getTeams('a'), getResultsA()])
    node = <RealtimeStandings category="a" data={computeStandingsA(teams, results)} />
  } else if (category === 'b') {
    const [teams, matches] = await Promise.all([getTeams('b'), getMatchesB()])
    node = <RealtimeStandings category="b" data={computeStandingsB(teams, matches)} />
  } else if (category === 'c') {
    const [teams, fights] = await Promise.all([getTeams('c'), getFightsC()])
    node = <RealtimeStandings category="c" data={computeStandingsC(teams, fights)} />
  } else {
    const [teams, matches] = await Promise.all([getTeams('d'), getMatchesD()])
    node = <RealtimeStandings category="d" data={computeStandingsD(teams, matches)} />
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 h-14 flex items-center px-6 gap-4 sticky top-0 z-10">
        <a href={meta.back} className="text-sm text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200">← Back</a>
        <span className="font-black text-sm text-gray-900 dark:text-zinc-100">{meta.icon} {meta.label}</span>
        <span className="ml-2 text-[10px] font-bold text-green-600 animate-pulse">● LIVE</span>
      </header>
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
          {node}
        </div>
      </div>
    </div>
  )
}
