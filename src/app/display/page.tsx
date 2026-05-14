'use client'

import { useEffect, useState, useCallback } from 'react'
import type { StandingA, StandingB, StandingC, StandingD, Team } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'

type AnyStanding = StandingA | StandingB | StandingC | StandingD
type Cat = 'a' | 'b' | 'c' | 'd'

interface Standings {
  a: StandingA[]
  b: StandingB[]
  c: StandingC[]
  d: StandingD[]
}

interface ActiveBundle {
  category: Cat
  match: ScheduledMatch
  team1Name: string
  team2Name: string | null
  status: 'active' | 'waiting'
}

interface NextBundle {
  category: Cat
  match: ScheduledMatch
  team1Name: string
  team2Name: string | null
}

function Clock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-mono tabular-nums tracking-widest">{time}</span>
}

const CAT = {
  a: { label: 'Line Follower', short: 'LINE FOLLOWER', icon: '🏎️', hue: 'from-blue-700 to-blue-600',   dot: 'bg-blue-400',   ring: 'ring-blue-500/30'  },
  b: { label: 'Mini Sumo',     short: 'MINI SUMO',     icon: '🤼', hue: 'from-violet-700 to-violet-600', dot: 'bg-violet-400', ring: 'ring-violet-500/30' },
  c: { label: 'MiniRoboWar',  short: 'MINIROBOWAR',   icon: '⚔️', hue: 'from-rose-700 to-rose-600',    dot: 'bg-rose-400',   ring: 'ring-rose-500/30'   },
  d: { label: 'Robo Football', short: 'ROBO FOOTBALL', icon: '⚽', hue: 'from-emerald-700 to-emerald-600', dot: 'bg-emerald-400', ring: 'ring-emerald-500/30' },
} as const

function statLine(s: AnyStanding): string {
  if ('total' in s) {
    if (s.total === null) return (s as StandingA).penalty === 'disq' ? 'DISQ' : 'DNF'
    return s.total.toFixed(2) + 's'
  }
  if ('goals_for' in s) {
    const d = s as StandingD
    return `${d.wins}W ${d.draws}D ${d.losses}L`
  }
  if ('knockouts' in s) {
    const c = s as StandingC
    return `${c.wins}W · ${c.knockouts} KO`
  }
  const b = s as StandingB
  return `${b.wins}W ${b.draws}D ${b.losses}L · ${b.points}pt`
}

const MEDALS = ['🥇', '🥈', '🥉']
const RANK_STYLE = [
  'text-amber-300 font-black',
  'text-slate-300 font-black',
  'text-orange-400 font-black',
]

function CategoryPanel({ cat, data }: { cat: keyof typeof CAT; data: AnyStanding[] }) {
  const m = CAT[cat]
  const top3 = data.slice(0, 3)
  const rest = data.slice(3, 8)
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden ring-1 ring-white/5 bg-gray-900">
      {/* Header */}
      <div className={`bg-gradient-to-r ${m.hue} px-5 py-3.5 flex items-center gap-3 shrink-0`}>
        <span className="text-3xl leading-none">{m.icon}</span>
        <div>
          <div className="text-white font-black text-base tracking-tight leading-none">{m.label}</div>
          <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-0.5">Category {cat.toUpperCase()}</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {data.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">No results yet</div>
        ) : (
          <>
            {/* Top 3 */}
            <div className="divide-y divide-white/5">
              {top3.map((s, i) => (
                <div key={s.team.id} className={`flex items-center gap-3 px-4 py-3 ${i === 0 ? 'bg-amber-500/8' : ''}`}>
                  <span className="text-xl shrink-0 leading-none w-7 text-center">{MEDALS[i]}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-black leading-tight truncate text-base ${i === 0 ? 'text-white' : 'text-gray-200'}`}>
                      {s.team.name}
                    </div>
                    {s.team.school && (
                      <div className="text-[11px] text-gray-500 truncate mt-0.5">{s.team.school}</div>
                    )}
                  </div>
                  <span className={`font-mono text-sm shrink-0 ${RANK_STYLE[i]}`}>{statLine(s)}</span>
                </div>
              ))}
            </div>

            {/* 4–8 compact */}
            {rest.length > 0 && (
              <div className="border-t border-white/5 divide-y divide-white/[0.03]">
                {rest.map((s, i) => (
                  <div key={s.team.id} className="flex items-center gap-2.5 px-4 py-2">
                    <span className="text-xs font-bold text-gray-600 w-5 text-center shrink-0">{i + 4}</span>
                    <span className="flex-1 text-xs font-medium text-gray-400 truncate">{s.team.name}</span>
                    <span className="font-mono text-[11px] text-gray-500 shrink-0">{statLine(s)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MatchCard({ b }: { b: ActiveBundle }) {
  const m = CAT[b.category]
  const isLive = b.status === 'active'
  return (
    <div className={`relative flex flex-col gap-2 rounded-xl px-5 py-4 overflow-hidden ring-1 ${
      isLive
        ? `bg-gradient-to-br ${m.hue} ring-white/10 shadow-lg`
        : 'bg-gray-800/80 ring-orange-500/30'
    }`}>
      {/* Glow effect for live */}
      {isLive && <div className={`absolute inset-0 opacity-20 blur-2xl ${m.dot} pointer-events-none`} />}

      <div className="flex items-center justify-between gap-2 relative">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{m.icon}</span>
          <div>
            <span className="font-mono font-black text-white text-sm">{b.match.match_id}</span>
            <span className="ml-2 text-white/50 text-[10px] uppercase tracking-wider">{m.short}</span>
          </div>
        </div>
        {isLive
          ? <span className="flex items-center gap-1.5 bg-white/20 text-white text-[10px] font-black px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />LIVE
            </span>
          : <span className="flex items-center gap-1.5 bg-orange-500/20 text-orange-300 text-[10px] font-black px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />WAIT
            </span>
        }
      </div>

      <div className="flex items-center gap-2 relative">
        <span className={`font-black text-lg leading-tight truncate flex-1 text-right ${isLive ? 'text-white' : 'text-gray-200'}`}>
          {b.team1Name}
        </span>
        {b.team2Name ? (
          <>
            <span className={`text-xs font-bold shrink-0 px-2 py-0.5 rounded ${isLive ? 'bg-white/15 text-white/60' : 'bg-white/5 text-gray-500'}`}>VS</span>
            <span className={`font-black text-lg leading-tight truncate flex-1 ${isLive ? 'text-white' : 'text-gray-200'}`}>
              {b.team2Name}
            </span>
          </>
        ) : (
          <span className="flex-1" />
        )}
      </div>
    </div>
  )
}

export default function DisplayPage() {
  const [standings, setStandings] = useState<Standings>({ a: [], b: [], c: [], d: [] })
  const [active, setActive] = useState<ActiveBundle[]>([])
  const [nextUp, setNextUp] = useState<NextBundle[]>([])
  const [lastUpdate, setLastUpdate] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  const refresh = useCallback(async () => {
    const cats: Cat[] = ['a', 'b', 'c', 'd']
    const [a, b, c, d, ...catData] = await Promise.all([
      fetch('/api/standings/a').then(r => r.json()),
      fetch('/api/standings/b').then(r => r.json()),
      fetch('/api/standings/c').then(r => r.json()),
      fetch('/api/standings/d').then(r => r.json()),
      ...cats.flatMap(cat => [
        fetch(`/api/judges/schedule?category=${cat}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/judges/${cat}/teams`, { cache: 'no-store' }).then(r => r.json()),
      ]),
    ])
    setStandings({ a, b, c, d })

    const bundles: ActiveBundle[] = []
    const nexts: NextBundle[] = []
    for (let i = 0; i < cats.length; i++) {
      const sched: ScheduledMatch[] = (Array.isArray(catData[i * 2]) ? catData[i * 2] : [])
        .sort((x: ScheduledMatch, y: ScheduledMatch) => x.match_id.localeCompare(y.match_id, undefined, { numeric: true }))
      const teams: Team[] = Array.isArray(catData[i * 2 + 1]) ? catData[i * 2 + 1] : []
      const name = (id: string | null) => id ? teams.find(t => t.id === id)?.name ?? '—' : null
      for (const m of sched) {
        if (m.status === 'active' || m.status === 'waiting') {
          bundles.push({ category: cats[i], match: m, team1Name: name(m.team1_id) ?? '—', team2Name: name(m.team2_id), status: m.status })
        }
      }
      const nextPending = sched.find(m => m.status === 'pending')
      if (nextPending) {
        nexts.push({ category: cats[i], match: nextPending, team1Name: name(nextPending.team1_id) ?? '—', team2Name: name(nextPending.team2_id) })
      }
    }
    setActive(bundles)
    setNextUp(nexts)
    setLastUpdate(new Date().toLocaleTimeString())
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 15_000)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      const tables = ['results_a', 'matches_b', 'fights_c', 'matches_d', 'scheduled_matches']
      const channels = tables.map(table =>
        supabase.channel(`display-${table}`)
          .on('postgres_changes', { event: '*', schema: 'public', table }, () => refresh())
          .subscribe()
      )
      return () => channels.forEach(ch => supabase.removeChannel(ch))
    })
  }, [refresh])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }

  return (
    <div className="h-screen bg-[#0b0d12] text-white flex flex-col overflow-hidden select-none">

      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center justify-between px-6 h-14 bg-[#0f1117] border-b border-white/[0.06]">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 border border-white/20 rounded flex items-center justify-center font-black text-[9px] text-white/70 tracking-wider">
            SFRC
          </div>
          <div>
            <span className="font-black text-white text-sm tracking-tight">STARTUP FEST ROBOTICS CHALLENGE</span>
            <span className="ml-3 text-gray-500 text-xs">2026 · Toshkent</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Live badge */}
          <div className="flex items-center gap-2 bg-red-600/90 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-white text-[11px] font-black tracking-widest">LIVE</span>
          </div>
          <div className="text-gray-300 text-sm"><Clock /></div>
          <div className="flex items-center gap-1.5">
            <button onClick={refresh}
              className="text-[11px] text-gray-500 hover:text-gray-300 px-2.5 py-1 rounded border border-white/10 hover:border-white/20 transition-colors">
              ↻
            </button>
            <button onClick={toggleFullscreen}
              className="text-[11px] text-gray-500 hover:text-gray-300 px-2.5 py-1 rounded border border-white/10 hover:border-white/20 transition-colors">
              {fullscreen ? '⊡' : '⊞'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Active / Waiting matches ── */}
      {active.length > 0 && (
        <div className="shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            {active.some(b => b.status === 'active') && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-red-400">Live Now</span>
              </div>
            )}
            {active.some(b => b.status === 'waiting') && (
              <div className="flex items-center gap-1.5 ml-2">
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-orange-400">Preparing</span>
              </div>
            )}
          </div>
          <div className={`grid gap-3 ${
            active.length >= 4 ? 'grid-cols-4'
            : active.length === 3 ? 'grid-cols-3'
            : active.length === 2 ? 'grid-cols-2'
            : 'grid-cols-1 max-w-lg'
          }`}>
            {active.map(b => <MatchCard key={b.match.id} b={b} />)}
          </div>
        </div>
      )}

      {/* ── Next Up ── */}
      {nextUp.length > 0 && (
        <div className="shrink-0 px-5 pb-3 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-600">Next:</span>
          {nextUp.map(b => {
            const m = CAT[b.category]
            return (
              <div key={b.match.id} className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-3 py-1.5 border border-white/[0.06]">
                <span className="text-sm leading-none">{m.icon}</span>
                <span className="font-mono text-xs font-bold text-gray-400">{b.match.match_id}</span>
                <span className="text-gray-600 text-xs">·</span>
                <span className="text-xs text-gray-400 max-w-[100px] truncate">{b.team1Name}</span>
                {b.team2Name && (
                  <><span className="text-gray-700 text-[10px]">vs</span>
                  <span className="text-xs text-gray-400 max-w-[100px] truncate">{b.team2Name}</span></>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 2×2 Category grid ── */}
      <div className="flex-1 min-h-0 px-5 pb-4 grid grid-cols-2 grid-rows-2 gap-3">
        <CategoryPanel cat="a" data={standings.a} />
        <CategoryPanel cat="b" data={standings.b} />
        <CategoryPanel cat="c" data={standings.c} />
        <CategoryPanel cat="d" data={standings.d} />
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 text-center text-[10px] text-gray-700 pb-2 tracking-wider">
        Updated {lastUpdate || '—'} · auto-refreshes every 15s
      </div>
    </div>
  )
}
