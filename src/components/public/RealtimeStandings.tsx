'use client'
import { useEffect, useState, useCallback } from 'react'
import type { Category, StandingA, StandingB, StandingC, StandingD } from '@/types/database'
import StandingsTableA from './StandingsTableA'
import StandingsTableB from './StandingsTableB'
import StandingsTableC from './StandingsTableC'
import StandingsTableD from './StandingsTableD'
import PublicMatchesList from './PublicMatchesList'

type Standings =
  | { category: 'a'; data: StandingA[] }
  | { category: 'b'; data: StandingB[] }
  | { category: 'c'; data: StandingC[] }
  | { category: 'd'; data: StandingD[] }

// Tables to watch per category
const WATCHED: Record<Category, string[]> = {
  a: ['teams', 'results_a'],
  b: ['teams', 'matches_b'],
  c: ['teams', 'fights_c'],
  d: ['teams', 'matches_d'],
}

const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function RealtimeStandings(props: Standings) {
  const [standings, setStandings] = useState(props.data as never[])
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [view, setView] = useState<'standings' | 'matches'>('standings')

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/standings/${props.category}`, { cache: 'no-store' })
    if (res.ok) {
      setStandings(await res.json())
      setLastUpdate(new Date())
    }
  }, [props.category])

  useEffect(() => {
    if (!hasSupabase) return

    let channel: ReturnType<import('@supabase/supabase-js').SupabaseClient['channel']>

    async function subscribe() {
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      channel = supabase.channel(`standings-${props.category}`)

      for (const table of WATCHED[props.category]) {
        channel.on(
          'postgres_changes' as never,
          { event: '*', schema: 'public', table },
          () => { refetch() },
        )
      }

      channel.subscribe()
    }

    subscribe()
    return () => { channel?.unsubscribe() }
  }, [props.category, refetch])

  const table = () => {
    if (props.category === 'a') return <StandingsTableA standings={standings as StandingA[]} />
    if (props.category === 'b') return <StandingsTableB standings={standings as StandingB[]} />
    if (props.category === 'c') return <StandingsTableC standings={standings as StandingC[]} />
    return <StandingsTableD standings={standings as StandingD[]} />
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between border-b border-gray-200 px-4">
        <div className="flex gap-1">
          <button onClick={() => setView('standings')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px uppercase tracking-wider transition-colors ${
              view === 'standings' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-700'
            }`}>
            Standings
          </button>
          <button onClick={() => setView('matches')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px uppercase tracking-wider transition-colors ${
              view === 'matches' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-700'
            }`}>
            Matches
          </button>
        </div>
        {lastUpdate && (
          <span className="text-[10px] text-green-600 font-semibold animate-pulse">● LIVE</span>
        )}
      </div>
      {view === 'standings' ? table() : <PublicMatchesList category={props.category} />}
    </div>
  )
}
