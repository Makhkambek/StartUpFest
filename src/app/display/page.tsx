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
  return <span className="font-mono tabular-nums">{time}</span>
}

const CATEGORY_META = {
  a: { label: 'A · Line Follower',  icon: '🏎️', color: 'bg-blue-600',   light: 'bg-blue-50',   border: 'border-blue-200' },
  b: { label: 'B · Mini Sumo',      icon: '🤼', color: 'bg-purple-600', light: 'bg-purple-50', border: 'border-purple-200' },
  c: { label: 'C · MiniRoboWar',   icon: '⚔️', color: 'bg-red-600',    light: 'bg-red-50',    border: 'border-red-200' },
  d: { label: 'D · Robo Football',  icon: '⚽', color: 'bg-green-600',  light: 'bg-green-50',  border: 'border-green-200' },
} as const

function rankLabel(s: AnyStanding) {
  if ('total' in s) {
    if (s.total === null) return (s as StandingA).penalty === 'disq' ? 'DISQ' : 'DNF'
    return s.total.toFixed(2) + 's'
  }
  if ('goals_for' in s) {
    const d = s as StandingD
    return `${d.wins}W ${d.draws}D ${d.losses}L · ${d.goals_for}−${d.goals_against}`
  }
  if ('knockouts' in s) {
    const c = s as StandingC
    return `${c.wins}W ${c.losses}L · ${c.knockouts}KO`
  }
  const b = s as StandingB
  return `${b.wins}W ${b.draws}D ${b.losses}L · ${b.points}pts`
}

const MEDAL = ['🥇', '🥈', '🥉']
const PODIUM_BG = [
  'bg-amber-50 border-l-4 border-amber-400',
  'bg-gray-50 border-l-4 border-gray-300',
  'bg-orange-50 border-l-4 border-orange-300',
]

function PanelBlock({ cat, data }: { cat: keyof typeof CATEGORY_META; data: AnyStanding[] }) {
  const meta = CATEGORY_META[cat]
  const podium = data.slice(0, 3)
  const rest = data.slice(3, 10)
  return (
    <div className="bg-white rounded-2xl overflow-hidden flex flex-col shadow-lg border border-gray-100">
      <div className={`${meta.color} px-5 py-3 flex items-center gap-3`}>
        <span className="text-2xl">{meta.icon}</span>
        <span className="text-white font-black text-lg tracking-tight">{meta.label}</span>
      </div>

      <div className="flex-1 overflow-hidden">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-300 text-sm py-8">No results yet</div>
        ) : (
          <>
            {/* Podium — top 3 big */}
            <div className="divide-y divide-gray-100">
              {podium.map((s, i) => (
                <div key={s.team.id} className={`flex items-center px-4 py-3 gap-3 ${PODIUM_BG[i]}`}>
                  <span className="text-2xl shrink-0">{MEDAL[i]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-gray-900 text-base leading-tight truncate">{s.team.name}</div>
                    {s.team.school && <div className="text-xs text-gray-400 truncate mt-0.5">{s.team.school}</div>}
                  </div>
                  <span className="font-mono text-sm font-black text-gray-800 shrink-0">{rankLabel(s)}</span>
                </div>
              ))}
            </div>

            {/* Rest — compact */}
            {rest.length > 0 && (
              <div className="divide-y divide-gray-50">
                {rest.map((s, i) => (
                  <div key={s.team.id} className="flex items-center px-4 py-1.5 gap-2">
                    <span className="w-5 text-center text-xs font-bold text-gray-400 shrink-0">{i + 4}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-gray-700 truncate">{s.team.name}</span>
                    </div>
                    <span className="font-mono text-[11px] text-gray-500 shrink-0">{rankLabel(s)}</span>
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

export default function DisplayPage() {
  const [standings, setStandings] = useState<Standings>({ a: [], b: [], c: [], d: [] })
  const [active, setActive] = useState<ActiveBundle[]>([])
  const [nextUp, setNextUp] = useState<NextBundle[]>([])
  const [lastUpdate, setLastUpdate] = useState<string>('')
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
    const id = setInterval(refresh, 15_000) // refresh every 15s
    return () => clearInterval(id)
  }, [refresh])

  // Realtime via Supabase if available
  useEffect(() => {
    const hasSupa = !!(process.env.NEXT_PUBLIC_SUPABASE_URL)
    if (!hasSupa) return
    // Dynamic import to avoid build errors in mock mode
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
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 border-2 border-white rounded-md flex items-center justify-center font-black text-[10px]">SFRC</div>
          <div>
            <div className="font-black text-sm tracking-wide">STARTUP FEST ROBOTICS CHALLENGE</div>
            <div className="text-xs text-gray-400">Live Results · 2026 · Toshkent</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-bold">LIVE</span>
          </div>
          <div className="text-sm text-gray-300"><Clock /></div>
          <button onClick={toggleFullscreen}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500 transition-colors">
            {fullscreen ? '⊡ Exit' : '⊞ Fullscreen'}
          </button>
          <button onClick={refresh}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500 transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Active + Waiting strip */}
      {active.length > 0 && (
        <div className="px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-4 mb-2">
            {active.some(b => b.status === 'active') && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-red-400">Live Now</span>
              </div>
            )}
            {active.some(b => b.status === 'waiting') && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-orange-400">Preparing</span>
              </div>
            )}
          </div>
          <div className={`grid gap-3 ${active.length >= 4 ? 'grid-cols-4' : active.length === 3 ? 'grid-cols-3' : active.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {active.map(b => {
              const meta = CATEGORY_META[b.category]
              const isLive = b.status === 'active'
              return (
                <div key={b.match.id} className={`${isLive ? meta.color : 'bg-gray-800 border border-orange-500/40'} rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg`}>
                  <span className="text-2xl">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-white text-base">{b.match.match_id}</span>
                      <span className={`text-[10px] uppercase tracking-wider ${isLive ? 'text-white/70' : 'text-gray-400'}`}>{meta.label.split(' · ')[1]}</span>
                    </div>
                    <div className={`font-bold text-sm truncate mt-0.5 ${isLive ? 'text-white' : 'text-gray-200'}`}>
                      {b.team1Name}
                      {b.team2Name && <span className={`mx-1.5 font-normal ${isLive ? 'text-white/60' : 'text-gray-500'}`}>vs</span>}
                      {b.team2Name}
                    </div>
                  </div>
                  {isLive
                    ? <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">▶ LIVE</span>
                    : <span className="bg-orange-500/20 text-orange-300 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">⏳ WAIT</span>
                  }
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Next Up strip */}
      {nextUp.length > 0 && (
        <div className="px-4 py-2.5 bg-gray-950 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 shrink-0">Next Up:</span>
            {nextUp.map(b => {
              const meta = CATEGORY_META[b.category]
              return (
                <div key={b.match.id} className="flex items-center gap-1.5 bg-gray-900 rounded-lg px-3 py-1.5">
                  <span className="text-sm">{meta.icon}</span>
                  <span className="font-mono text-xs font-black text-gray-300">{b.match.match_id}</span>
                  <span className="text-gray-600 text-xs">·</span>
                  <span className="text-xs text-gray-400 truncate max-w-32">{b.team1Name}</span>
                  {b.team2Name && <><span className="text-gray-600 text-xs">vs</span><span className="text-xs text-gray-400 truncate max-w-32">{b.team2Name}</span></>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="flex-1 p-4 grid grid-cols-2 grid-rows-2 gap-4">
        <PanelBlock cat="a" data={standings.a} />
        <PanelBlock cat="b" data={standings.b} />
        <PanelBlock cat="c" data={standings.c} />
        <PanelBlock cat="d" data={standings.d} />
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 py-2 shrink-0">
        Updated {lastUpdate || '—'} · Auto-refreshes every 15s
      </div>
    </div>
  )
}
