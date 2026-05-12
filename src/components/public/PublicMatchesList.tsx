'use client'
import { useEffect, useState, useCallback } from 'react'
import type { Category, Team, ResultA, MatchB, FightC, MatchD } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'

interface Props {
  category: Category
}

interface MatchRow {
  match: ScheduledMatch
  team1: string
  team2: string | null
  result: string | null
  winnerSide: 1 | 2 | 0 | null
  status: ScheduledMatch['status']
}

const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function PublicMatchesList({ category }: Props) {
  const [rows, setRows] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const [scheduleRaw, teamsRaw, resultsRaw] = await Promise.all([
      fetch(`/api/judges/schedule?category=${category}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/judges/${category}/teams`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/judges/${category}/${category === 'a' ? 'results' : category === 'c' ? 'fights' : 'matches'}`, { cache: 'no-store' }).then(r => r.json()),
    ])
    const schedule: ScheduledMatch[] = Array.isArray(scheduleRaw) ? scheduleRaw : []
    const teams: Team[] = Array.isArray(teamsRaw) ? teamsRaw : []
    const results: unknown[] = Array.isArray(resultsRaw) ? resultsRaw : []
    const name = (id: string | null) => id ? teams.find(t => t.id === id)?.name ?? '—' : null

    schedule.sort((a, b) => a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))

    const built = schedule.map(m => {
      let result: string | null = null
      let winnerSide: 1 | 2 | 0 | null = null

      if (category === 'a') {
        const r = (results as ResultA[]).find(x => x.scheduled_match_id === m.id)
        if (r) {
          if (r.penalty === 'dnf') result = 'DNF'
          else if (r.penalty === 'disq') result = 'DISQ'
          else result = r.total !== null ? `${r.total.toFixed(2)}s` : '—'
        }
      } else if (category === 'b') {
        const r = (results as MatchB[]).find(x =>
          (x.team1_id === m.team1_id && x.team2_id === m.team2_id) ||
          (x.team1_id === m.team2_id && x.team2_id === m.team1_id)
        )
        if (r) {
          result = `${r.rounds1} : ${r.rounds2}`
          winnerSide = r.winner
        }
      } else if (category === 'c') {
        const r = (results as FightC[]).find(x =>
          (x.team1_id === m.team1_id && x.team2_id === m.team2_id) ||
          (x.team1_id === m.team2_id && x.team2_id === m.team1_id)
        )
        if (r) {
          result = r.method
          winnerSide = r.winner
        }
      } else {
        const r = (results as MatchD[]).find(x =>
          (x.team1_id === m.team1_id && x.team2_id === m.team2_id) ||
          (x.team1_id === m.team2_id && x.team2_id === m.team1_id)
        )
        if (r) {
          result = `${r.goals1} : ${r.goals2}`
          winnerSide = r.goals1 > r.goals2 ? 1 : r.goals2 > r.goals1 ? 2 : 0
        }
      }

      return {
        match: m,
        team1: name(m.team1_id) ?? '—',
        team2: name(m.team2_id),
        result,
        winnerSide,
        status: m.status,
      }
    })

    setRows(built)
    setLoading(false)
  }, [category])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    if (!hasSupabase) {
      const id = setInterval(refetch, 10_000)
      return () => clearInterval(id)
    }
    let cancelled = false
    let channel: ReturnType<import('@supabase/supabase-js').SupabaseClient['channel']> | undefined
    let supabaseRef: import('@supabase/supabase-js').SupabaseClient | undefined
    async function subscribe() {
      const { createBrowserClient } = await import('@supabase/ssr')
      if (cancelled) return
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      supabaseRef = supabase
      channel = supabase.channel(`matches-${category}-${Date.now()}`)
      const tables = ['scheduled_matches', 'teams', category === 'a' ? 'results_a' : category === 'b' ? 'matches_b' : category === 'c' ? 'fights_c' : 'matches_d']
      for (const table of tables) {
        channel.on('postgres_changes' as never, { event: '*', schema: 'public', table }, () => refetch())
      }
      channel.subscribe()
    }
    subscribe()
    return () => {
      cancelled = true
      if (channel && supabaseRef) supabaseRef.removeChannel(channel)
    }
  }, [category, refetch])

  if (loading) {
    return <div className="text-sm text-gray-400 py-10 text-center">Loading matches…</div>
  }
  if (rows.length === 0) {
    return <div className="text-sm text-gray-400 py-10 text-center">No matches scheduled yet.</div>
  }

  const qualMatches = rows.filter(r => r.match.phase !== 'finals')
  const finalMatches = rows.filter(r => r.match.phase === 'finals')

  return (
    <div className="px-2">
      {finalMatches.length > 0 && (
        <MatchSection title="Playoffs" rows={finalMatches} highlight />
      )}
      <MatchSection title="Qualification Matches" rows={qualMatches} />
    </div>
  )
}

function MatchSection({ title, rows, highlight = false }: { title: string; rows: MatchRow[]; highlight?: boolean }) {
  return (
    <div className="mb-6">
      <div className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${highlight ? 'text-amber-700 bg-amber-50 border-y border-amber-200' : 'text-gray-500 bg-gray-50 border-y border-gray-200'}`}>
        {title}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
            <th className="text-left px-4 py-2 w-24">Match</th>
            <th className="text-left px-4 py-2 w-24">Status</th>
            <th className="text-left px-4 py-2">Teams</th>
            <th className="text-right px-4 py-2 w-32">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => (
            <tr key={r.match.id} className={`${r.status === 'active' ? 'bg-blue-50' : ''}`}>
              <td className="px-4 py-2.5 font-mono font-black text-gray-900">{r.match.match_id}</td>
              <td className="px-4 py-2.5">
                {r.status === 'completed' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">DONE</span>}
                {r.status === 'active' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white animate-pulse">▶ LIVE</span>}
                {r.status === 'waiting' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 animate-pulse">⏳ WAITING</span>}
                {r.status === 'pending' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">PENDING</span>}
              </td>
              <td className="px-4 py-2.5">
                <span className={`text-gray-800 ${r.winnerSide === 1 ? 'font-black' : 'font-medium'}`}>{r.team1}</span>
                {r.team2 && (
                  <>
                    <span className="text-gray-300 mx-2">vs</span>
                    <span className={`text-gray-800 ${r.winnerSide === 2 ? 'font-black' : 'font-medium'}`}>{r.team2}</span>
                  </>
                )}
                {r.winnerSide === 0 && <span className="ml-2 text-[10px] font-bold text-gray-500 uppercase">draw</span>}
              </td>
              <td className="px-4 py-2.5 text-right">
                {r.result ? (
                  <span className="font-mono font-bold text-gray-900">{r.result}</span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
