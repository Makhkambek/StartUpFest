'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { StandingA, StandingB, StandingC, StandingD, Team } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'
import { useEventSettings } from '@/lib/use-event-settings'

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
  return <span className="font-mono tabular-nums">{time}</span>
}

const CAT = {
  a: { label: 'Line Follower',  short: 'CAT A', icon: '🏎️', bg: 'bg-blue-600',    text: 'text-blue-600',    border: 'border-blue-600',    badge: 'bg-blue-50 text-blue-700'    },
  b: { label: 'Mini Sumo',      short: 'CAT B', icon: '🤼', bg: 'bg-violet-600',  text: 'text-violet-600',  border: 'border-violet-600',  badge: 'bg-violet-50 text-violet-700'  },
  c: { label: 'MiniRoboWar',   short: 'CAT C', icon: '⚔️', bg: 'bg-rose-600',    text: 'text-rose-600',    border: 'border-rose-600',    badge: 'bg-rose-50 text-rose-700'    },
  d: { label: 'Robo Football',  short: 'CAT D', icon: '⚽', bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-600', badge: 'bg-emerald-50 text-emerald-700' },
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

const RANK_COLORS = ['text-amber-500', 'text-slate-400', 'text-orange-400']

const SCROLL_SPEED = 20   // px/s
const PAUSE_LOOP_MS = 10_000  // pause when first item re-appears

// Seamless infinite scroll with pause at top every 2 loops.
// List is duplicated in DOM — seamless snap on loop 1, jump to top + pause on loop 2.
// Depends on dataLength so it starts only when data is loaded,
// but doesn't restart on every 15s refresh (array ref changes, length doesn't).
function useAutoScroll(ref: React.RefObject<HTMLDivElement | null>, dataLength: number) {
  useEffect(() => {
    const el = ref.current
    if (!el || dataLength === 0) return

    let animId: number
    let lastTime = 0
    let loopCount = 0
    let pauseTimer: ReturnType<typeof setTimeout> | null = null
    let state: 'scrolling' | 'paused' = 'scrolling'
    let halfH = 0

    const animate = (time: number) => {
      if (lastTime === 0) lastTime = time
      const delta = Math.min(time - lastTime, 50)
      lastTime = time

      if (state === 'scrolling' && halfH > 0) {
        el.scrollTop += (delta * SCROLL_SPEED) / 1000

        if (el.scrollTop >= halfH) {
          loopCount += 1
          if (loopCount >= 2) {
            loopCount = 0
            el.scrollTop = 0        // jump to top — rank 1 visible
            state = 'paused'
            pauseTimer = setTimeout(() => { state = 'scrolling' }, PAUSE_LOOP_MS)
          } else {
            el.scrollTop -= halfH   // seamless snap, invisible
          }
        }
      }

      animId = requestAnimationFrame(animate)
    }

    // Measure after layout settles, then kick off animation
    const initTimer = setTimeout(() => {
      halfH = el.scrollHeight / 2
      if (halfH === 0) return
      animId = requestAnimationFrame(animate)
    }, 150)

    return () => {
      clearTimeout(initTimer)
      if (pauseTimer) clearTimeout(pauseTimer)
      cancelAnimationFrame(animId)
    }
  // dataLength triggers start when data loads; stable across 15s refreshes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLength])
}

function CategoryPanel({ cat, data }: { cat: keyof typeof CAT; data: AnyStanding[] }) {
  const m = CAT[cat]
  const scrollRef = useRef<HTMLDivElement>(null)
  useAutoScroll(scrollRef, data.length)

  return (
    <div className={`flex flex-col bg-white rounded-xl overflow-hidden shadow-sm border-t-4 ${m.border}`}>
      {/* Header — fixed, never scrolls */}
      <div className="px-4 py-2.5 flex items-center gap-2.5 border-b border-gray-100 shrink-0">
        <span className="text-2xl leading-none">{m.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-black text-gray-900 text-sm leading-tight">{m.label}</div>
          <div className={`text-[10px] font-bold uppercase tracking-widest ${m.text} opacity-70`}>{m.short}</div>
        </div>
        {data.length > 0 && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.badge}`}>
            {data.length} teams
          </span>
        )}
      </div>

      {/* Scrollable list — no scrollbar visible */}
      <div ref={scrollRef} className="flex-1 overflow-hidden min-h-0">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-300 text-sm">No results yet</div>
        ) : (
          // Render twice for seamless infinite loop
          [0, 1].map(copy => (
            <div key={copy} className="divide-y divide-gray-50">
              {data.map((s, i) => (
                <div key={`${copy}-${s.team.id}`} className={`flex items-center gap-3 px-4 py-2.5 ${i === 0 ? 'bg-amber-50' : ''}`}>
                  <span className="text-base leading-none w-6 text-center shrink-0">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (
                      <span className="text-xs font-bold text-gray-300">{i + 1}</span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-gray-900 text-sm leading-tight truncate">{s.team.name}</div>
                    {s.team.school && (
                      <div className="text-[10px] text-gray-400 truncate">{s.team.school}</div>
                    )}
                  </div>
                  <span className={`font-mono text-xs font-bold shrink-0 ${i < 3 ? RANK_COLORS[i] : 'text-gray-400'}`}>
                    {statLine(s)}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function MatchCard({ b }: { b: ActiveBundle }) {
  const m = CAT[b.category]
  const isLive = b.status === 'active'
  return (
    <div className={`flex flex-col rounded-xl overflow-hidden bg-white shadow-sm border-2 ${isLive ? m.border : 'border-orange-300'}`}>
      {/* Category header */}
      <div className={`flex items-center justify-between px-3 py-1.5 ${isLive ? m.bg : 'bg-orange-400'}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{m.icon}</span>
          <span className="text-white font-black text-xs uppercase tracking-wide">{m.label}</span>
          <span className="text-white/60 font-mono text-xs">#{b.match.match_id}</span>
        </div>
        {isLive
          ? <span className="flex items-center gap-1 bg-white/25 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />LIVE
            </span>
          : <span className="flex items-center gap-1 bg-white/25 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />PREPARING
            </span>
        }
      </div>
      {/* Teams */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {b.team2Name ? (
          <>
            <span className="font-black text-sm text-gray-900 truncate flex-1 text-right">{b.team1Name}</span>
            <span className="text-[11px] font-black text-gray-400 shrink-0 bg-gray-100 px-2 py-0.5 rounded">VS</span>
            <span className="font-black text-sm text-gray-900 truncate flex-1">{b.team2Name}</span>
          </>
        ) : (
          <span className="font-black text-sm text-gray-900 truncate">{b.team1Name}</span>
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
  // /display is locale-agnostic (no [locale] segment) — use Uzbek city name for the venue display.
  const { settings: eventSettings, city: eventCity } = useEventSettings('uz')

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
    let cleanup: (() => void) | null = null
    import('@/lib/supabase/client')
      .then(({ createClient }) => {
        const supabase = createClient()
        const tables = ['results_a', 'matches_b', 'fights_c', 'matches_d', 'scheduled_matches']
        const channels = tables.map(table =>
          supabase.channel(`display-${table}`)
            .on('postgres_changes', { event: '*', schema: 'public', table }, () => refresh())
            .subscribe()
        )
        cleanup = () => channels.forEach(ch => supabase.removeChannel(ch))
      })
      .catch(err => {
        // Dynamic import failed (e.g. offline). The display still polls via the
        // refresh interval above — realtime is best-effort.
        console.warn('[display] supabase realtime unavailable:', err)
      })
    return () => { cleanup?.() }
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
    <div className="h-screen bg-gray-100 text-gray-900 flex flex-col overflow-hidden select-none">

      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center justify-between px-6 h-14 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center font-black text-[9px] text-white tracking-wider">
            SFRC
          </div>
          <div>
            <div className="font-black text-gray-900 text-sm tracking-tight leading-none">STARTUP FEST ROBOTICS CHALLENGE</div>
            <div className="text-gray-400 text-[11px] mt-0.5">{eventSettings.year} · {eventCity.uz}, O&apos;zbekiston</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {active.some(b => b.status === 'active') && (
            <div className="flex items-center gap-1.5 bg-red-600 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              <span className="text-white text-[11px] font-black tracking-widest">LIVE</span>
            </div>
          )}
          <div className="text-gray-600 text-sm font-medium"><Clock /></div>
          <div className="flex items-center gap-1">
            <button onClick={refresh}
              className="text-sm text-gray-400 hover:text-gray-700 px-2.5 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors">
              ↻
            </button>
            <button onClick={toggleFullscreen}
              className="text-sm text-gray-400 hover:text-gray-700 px-2.5 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors">
              {fullscreen ? '⊡' : '⊞'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Now Playing + Next Up ── */}
      {(active.length > 0 || nextUp.length > 0) && (
        <div className="shrink-0 px-5 pt-3 pb-2 space-y-2">

          {/* NOW PLAYING */}
          {active.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
                <span className="text-xs font-black uppercase tracking-widest text-gray-700">Now Playing</span>
              </div>
              <div className={`grid gap-2 ${
                active.length >= 4 ? 'grid-cols-4'
                : active.length === 3 ? 'grid-cols-3'
                : active.length === 2 ? 'grid-cols-2'
                : 'grid-cols-1 max-w-sm'
              }`}>
                {active.map(b => <MatchCard key={b.match.id} b={b} />)}
              </div>
            </div>
          )}

          {/* UP NEXT */}
          {nextUp.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-gray-400 text-xs">⏭</span>
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">Up Next</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {nextUp.map(b => {
                  const m = CAT[b.category]
                  return (
                    <div key={b.match.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                      <div className={`${m.bg} px-2 py-2 flex items-center gap-1 self-stretch`}>
                        <span className="text-sm leading-none">{m.icon}</span>
                        <span className="text-white font-black text-[10px] uppercase hidden sm:block">{m.short}</span>
                      </div>
                      <div className="px-2 py-1.5 flex items-center gap-1.5">
                        <span className={`font-mono text-xs font-black ${m.text}`}>#{b.match.match_id}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs font-semibold text-gray-700 max-w-[90px] truncate">{b.team1Name}</span>
                        {b.team2Name && <>
                          <span className="text-[10px] font-bold text-gray-300">vs</span>
                          <span className="text-xs font-semibold text-gray-700 max-w-[90px] truncate">{b.team2Name}</span>
                        </>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 2×2 Category grid ── */}
      <div className="flex-1 min-h-0 px-5 pb-3 grid grid-cols-2 grid-rows-2 gap-3">
        <CategoryPanel cat="a" data={standings.a} />
        <CategoryPanel cat="b" data={standings.b} />
        <CategoryPanel cat="c" data={standings.c} />
        <CategoryPanel cat="d" data={standings.d} />
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 text-center text-[10px] text-gray-400 pb-2 tracking-wider">
        Updated {lastUpdate || '—'} · auto-refreshes every 15s
      </div>
    </div>
  )
}
