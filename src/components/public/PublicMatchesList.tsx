'use client'
import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { Category, Team, ResultA, MatchB, FightC, MatchD } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'
import { SkeletonTableRow } from '@/components/ui/Skeleton'

interface Props {
  category: Category
}

function friendlyId(matchId: string): string {
  const id = matchId.replace(/^F[A-D]-/, '')
  if (id === '3RD' || id === '3rd')         return '3rd Place'
  if (id === 'F1' || id === 'FINAL')        return 'Grand Final'
  const r1 = id.match(/^R1-(\d+)$/)
  if (r1)                                   return `Round 1 · ${r1[1]}`
  const r2 = id.match(/^R2-(\d+)$/)
  if (r2)                                   return `Round 2 · ${r2[1]}`
  const sf = id.match(/^SF(\d+)$/)
  if (sf)                                   return `Semi-Final ${sf[1]}`
  const qf = id.match(/^QF(\d+)$/)
  if (qf)                                   return `Quarter-Final ${qf[1]}`
  const tri = id.match(/^T(\d+)$/)
  if (tri)                                  return `Play-off ${tri[1]}`
  const rr = id.match(/^RR(\d+)$/)
  if (rr)                                   return `Final Match ${rr[1]}`
  return matchId
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
  const t = useTranslations('matchesList')
  const [rows, setRows] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

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

    const roundOrder: Record<string, number> = {
      group: 0, r1: 1, r2: 2, quarter: 1, semi: 2, round_robin: 3, triangle: 3, third_place: 4, final: 5,
    }
    schedule.sort((a, b) => {
      const phaseA = a.phase === 'finals' ? 1 : 0
      const phaseB = b.phase === 'finals' ? 1 : 0
      if (phaseA !== phaseB) return phaseA - phaseB
      if (phaseA === 1) {
        const rA = roundOrder[a.round ?? ''] ?? 3
        const rB = roundOrder[b.round ?? ''] ?? 3
        if (rA !== rB) return rA - rB
      }
      return a.match_id.localeCompare(b.match_id, undefined, { numeric: true })
    })

    const built = schedule.map(m => {
      let result: string | null = null
      let winnerSide: 1 | 2 | 0 | null = null

      // Prefer scheduled_match_id match (correct, post-migration 014).
      // Only fall back to team-pair match if scheduled match status === 'completed' AND
      // no row has scheduled_match_id set — avoids old test fixtures sticking to new schedules.
      const matchByScheduled = <T extends { scheduled_match_id?: string | null }>(arr: T[]): T | undefined =>
        arr.find((x) => x.scheduled_match_id === m.id)
      const matchByPair = <T extends { team1_id: string; team2_id: string }>(arr: T[]): T | undefined => {
        if (m.status !== 'completed') return undefined
        return arr.find((x) =>
          (x.team1_id === m.team1_id && x.team2_id === m.team2_id) ||
          (x.team1_id === m.team2_id && x.team2_id === m.team1_id),
        )
      }

      if (category === 'a') {
        const r = (results as ResultA[]).find(x => x.scheduled_match_id === m.id)
        if (r) {
          if (r.penalty === 'dnf') result = 'DNF'
          else if (r.penalty === 'disq') result = 'DISQ'
          else result = r.total !== null ? `${r.total.toFixed(2)}s` : '—'
        }
      } else if (category === 'b') {
        const all = results as MatchB[]
        const r = matchByScheduled(all) ?? matchByPair(all)
        if (r) {
          result = `${r.rounds1} : ${r.rounds2}`
          winnerSide = r.winner
        }
      } else if (category === 'c') {
        const all = results as FightC[]
        const r = matchByScheduled(all) ?? matchByPair(all)
        if (r) {
          result = r.method
          winnerSide = r.winner
        }
      } else {
        const all = results as MatchD[]
        const r = matchByScheduled(all) ?? matchByPair(all)
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
    return (
      <div className="px-1 sm:px-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                <th className="text-left px-3 sm:px-4 py-2 w-20 sm:w-24">{t('colMatch')}</th>
                <th className="text-left px-3 sm:px-4 py-2 w-20 sm:w-24">{t('colStatus')}</th>
                <th className="text-left px-3 sm:px-4 py-2">{t('colTeams')}</th>
                <th className="text-right px-3 sm:px-4 py-2 w-24 sm:w-32">{t('colResult')}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonTableRow key={i} cols={4} />)}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  if (rows.length === 0) {
    return <div className="text-sm text-gray-400 py-10 text-center">{t('empty')}</div>
  }

  const q = query.trim().toLowerCase()
  // Whole-word match: "bla" matches "bla bla" but not "blaaa".
  // Boundary = string start/end OR any non-alphanumeric char (incl. spaces, punctuation, Cyrillic OK via \p{L}).
  const wordRe = q ? new RegExp(`(^|[^\\p{L}\\p{N}])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'iu') : null

  // Build Q-N display IDs for qualification matches (A-1 → Q-1, B-1 → Q-2, …)
  const qualRows = rows.filter(r => r.match.phase !== 'finals')
  const qDisplayMap = new Map<string, { displayId: string; group: string | null }>()
  qualRows.forEach((r, i) => {
    const groupMatch = r.match.match_id.match(/^([A-F])-\d+$/i)
    qDisplayMap.set(r.match.id, {
      displayId: `Q-${i + 1}`,
      group: groupMatch ? groupMatch[1].toUpperCase() : null,
    })
  })

  const qualMatches = qualRows
  const finalMatches = rows.filter(r => r.match.phase === 'finals')

  const matchesSearch = (r: MatchRow) => {
    if (!wordRe) return false
    const qInfo = qDisplayMap.get(r.match.id)
    return wordRe.test(r.team1) ||
      wordRe.test(r.team2 ?? '') ||
      wordRe.test(r.match.match_id) ||
      (qInfo ? wordRe.test(qInfo.displayId) : false)
  }
  const totalHits = q.length > 0 ? rows.filter(matchesSearch).length : 0

  return (
    <div className="px-1 sm:px-2">
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-3">
        <div className="text-xs text-gray-400">
          {q.length > 0 && (
            <span className="font-semibold text-gray-600">
              {t('found', { n: totalHits })}
            </span>
          )}
        </div>
        <div className="relative w-full max-w-[260px] sm:max-w-xs">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
          </svg>
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 text-sm">
              ✕
            </button>
          )}
        </div>
      </div>
      {finalMatches.length > 0 && (
        <MatchSection title={t('sectionPlayoffs')} rows={finalMatches} highlight matchFn={matchesSearch} />
      )}
      <MatchSection title={t('sectionQualification')} rows={qualMatches} matchFn={matchesSearch} displayMap={qDisplayMap} />
    </div>
  )
}

function MatchSection({ title, rows, highlight = false, matchFn, displayMap }: {
  title: string
  rows: MatchRow[]
  highlight?: boolean
  matchFn?: (r: MatchRow) => boolean
  displayMap?: Map<string, { displayId: string; group: string | null }>
}) {
  const t = useTranslations('matchesList')
  return (
    <div className="mb-6">
      <div className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${highlight ? 'text-amber-700 bg-amber-50 border-y border-amber-200' : 'text-gray-500 bg-gray-50 border-y border-gray-200'}`}>
        {title}
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
            <th className="text-left px-3 sm:px-4 py-2 w-20 sm:w-24">{t('colMatch')}</th>
            <th className="text-left px-3 sm:px-4 py-2 w-20 sm:w-24">{t('colStatus')}</th>
            <th className="text-left px-3 sm:px-4 py-2">{t('colTeams')}</th>
            <th className="text-right px-3 sm:px-4 py-2 w-24 sm:w-32">{t('colResult')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => {
            const isMatch = matchFn?.(r) ?? false
            const qInfo = displayMap?.get(r.match.id)
            const displayId = qInfo?.displayId ?? friendlyId(r.match.match_id)
            const groupLetter = qInfo?.group ?? null
            return (
            <tr key={r.match.id} className={`${isMatch ? 'bg-yellow-100 ring-2 ring-yellow-300 ring-inset' : r.status === 'active' ? 'bg-blue-50' : ''}`}>
              <td className="px-3 sm:px-4 py-2 sm:py-2.5 whitespace-nowrap">
                <span className="font-mono font-black text-gray-900 text-xs sm:text-sm">{displayId}</span>
                {groupLetter && (
                  <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 align-middle">
                    Grp {groupLetter}
                  </span>
                )}
              </td>
              <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                {r.status === 'completed' && <span className="text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t('statusDone')}</span>}
                {r.status === 'active' && <span className="text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-600 text-white animate-pulse">{t('statusLive')}</span>}
                {r.status === 'waiting' && <span className="text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 animate-pulse">{t('statusWait')}</span>}
                {r.status === 'pending' && <span className="text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t('statusPending')}</span>}
              </td>
              <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                <span className={`text-gray-800 text-xs sm:text-sm ${r.winnerSide === 1 ? 'font-black' : 'font-medium'}`}>{r.team1}</span>
                {r.team2 && (
                  <>
                    <span className="text-gray-300 mx-1 sm:mx-2">{t('vs')}</span>
                    <span className={`text-gray-800 text-xs sm:text-sm ${r.winnerSide === 2 ? 'font-black' : 'font-medium'}`}>{r.team2}</span>
                  </>
                )}
                {r.winnerSide === 0 && <span className="ml-1 sm:ml-2 text-[10px] font-bold text-gray-500 uppercase">{t('draw')}</span>}
              </td>
              <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-right">
                {r.result ? (
                  <span className="font-mono font-bold text-gray-900 text-xs sm:text-sm">{r.result}</span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}
