'use client'
import { useEffect, useState, useCallback } from 'react'
import type { Category, StandingA, StandingB, StandingC, StandingD } from '@/types/database'
import StandingsTableA from './StandingsTableA'
import StandingsTableB from './StandingsTableB'
import StandingsTableC from './StandingsTableC'
import StandingsTableD from './StandingsTableD'

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
      {lastUpdate && (
        <div className="absolute top-0 right-0 text-[10px] text-green-600 font-semibold animate-pulse px-1">
          ● LIVE
        </div>
      )}
      {table()}
    </div>
  )
}
