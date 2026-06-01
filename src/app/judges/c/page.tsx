'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Team, FightC } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'
import { StatsBar } from '@/components/judges/StatsBar'
import { RecentActivity, type RecentEntry } from '@/components/judges/RecentActivity'
import LiveControlsC from '@/components/judges/LiveControlsC'
import { useEventSettings } from '@/lib/use-event-settings'
import { useConfirm } from '@/components/judges/useConfirm'
import { ThemeToggle } from '@/components/judges/ThemeToggle'
import FinalsBracketB from '@/components/public/FinalsBracketB'

type View = 'schedule' | 'teams'

export default function JudgeCPage() {
  const router = useRouter()
  const { cityName: eventCity } = useEventSettings('en')
  const [view, setView] = useState<View>('schedule')
  const [teams, setTeams] = useState<Team[]>([])
  const [schedule, setSchedule] = useState<ScheduledMatch[]>([])
  const [fights, setFights] = useState<FightC[]>([])
  const [loading, setLoading] = useState(true)
  const { confirm, modal } = useConfirm()
  const [isAdmin, setIsAdmin] = useState(false)
  const [canGenerate, setCanGenerate] = useState(false)

  const [tName, setTName] = useState(''); const [tSchool, setTSchool] = useState(''); const [addingTeam, setAddingTeam] = useState(false)
  const [smId, setSmId] = useState(''); const [smT1, setSmT1] = useState(''); const [smT2, setSmT2] = useState(''); const [addingSm, setAddingSm] = useState(false); const [smErr, setSmErr] = useState('')
  const [genN, setGenN] = useState('2'); const [generating, setGenerating] = useState(false); const [resetting, setResetting] = useState(false); const [genError, setGenError] = useState('')
  const [genSemis, setGenSemis] = useState(false); const [genSemisErr, setGenSemisErr] = useState('')
  const [genFinal, setGenFinal] = useState(false); const [genFinalErr, setGenFinalErr] = useState('')
  const [matchFilter, setMatchFilter] = useState<'all' | 'qualification' | 'semi' | 'final'>('all')

  const [activeMatch, setActiveMatch] = useState<ScheduledMatch | null>(null)
  const [finalsVisible, setFinalsVisible] = useState(false)
  const [standbyMode, setStandbyMode] = useState(false)

  useEffect(() => {
    fetch('/api/judges/c/live').then(r => r.json()).then(s => {
      setFinalsVisible(s.finals_visible ?? false)
      setStandbyMode(s.standby_mode ?? false)
    })
  }, [])

  const toggleFinals = async () => {
    const res = await fetch('/api/judges/c/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'toggle_finals' }) })
    if (res.ok) { const s = await res.json(); setFinalsVisible(s.finals_visible ?? false) }
  }

  const toggleStandby = async () => {
    const res = await fetch('/api/judges/c/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'toggle_standby' }) })
    if (res.ok) { const s = await res.json(); setStandbyMode(s.standby_mode ?? false) }
  }

  const teamName = (id: string) => teams.find(t => t.id === id)?.name ?? id

  const load = useCallback(async () => {
    const [tr, sc, fr] = await Promise.all([
      fetch('/api/judges/c/teams', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/schedule?category=c', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/c/fights', { cache: 'no-store' }).then(r => r.json()),
    ])
    setTeams(Array.isArray(tr) ? tr : [])
    const sorted = (Array.isArray(sc) ? sc : []).sort((a: { match_id: string }, b: { match_id: string }) =>
      a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
    setSchedule(sorted)
    setFights(Array.isArray(fr) ? fr : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetch('/api/auth/me').then(r => r.json()).then(s => { if (s?.role) setCanGenerate(true); if (s?.role === 'admin') setIsAdmin(true) })
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [load])

  const handleGenerate = async () => {
    const n = parseInt(genN)
    if (!n || n < 1 || n > 20) { setGenError('Enter a number between 1 and 20'); return }
    setGenerating(true); setGenError('')
    const res = await fetch('/api/judges/schedule/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'c', n }) })
    if (!res.ok) { const e = await res.json(); setGenError(e.error ?? 'Failed'); setGenerating(false); return }
    await load(); setGenerating(false)
  }

  const handleGenerateSemis = async () => {
    if (!await confirm('Generate SEMI-FINALS from current Top-4 standings? FC-SF1 (1v4) and FC-SF2 (2v3) will be created.')) return
    setGenSemis(true); setGenSemisErr('')
    const res = await fetch('/api/judges/schedule/finals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'c', step: 'semi', confirm: true }) })
    if (!res.ok) { const e = await res.json(); setGenSemisErr(e.error ?? 'Failed'); setGenSemis(false); return }
    await load(); setGenSemis(false)
  }

  const handleGenerateFinal = async () => {
    if (!await confirm('Generate FINAL + 3RD PLACE from semi-final results?')) return
    setGenFinal(true); setGenFinalErr('')
    const res = await fetch('/api/judges/schedule/finals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'c', step: 'final', confirm: true }) })
    if (!res.ok) { const e = await res.json(); setGenFinalErr(e.error ?? 'Failed'); setGenFinal(false); return }
    await load(); setGenFinal(false)
  }

  const handleReset = async () => {
    if (!await confirm('Delete all scheduled matches AND clear all match results for this category? This cannot be undone.')) return
    setResetting(true)
    try {
      const resR = await fetch('/api/admin/reset-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'c' }) })
      if (!resR.ok) { const err = await resR.json().catch(() => null); alert(`Reset results failed (${resR.status}): ${err?.error ?? 'unknown'}`); return }
      const resS = await fetch('/api/judges/schedule', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'c', all: true }) })
      if (!resS.ok) { const err = await resS.json().catch(() => null); alert(`Reset schedule failed (${resS.status}): ${err?.error ?? 'unknown'}`); return }
      setFights([]); setSchedule([])
      await load()
    } finally {
      setResetting(false)
    }
  }

  const resultFor = (m: ScheduledMatch) =>
    fights.find(f => f.scheduled_match_id === m.id) ??
    fights.find(f =>
      !f.scheduled_match_id &&
      ((f.team1_id === m.team1_id && f.team2_id === m.team2_id) ||
       (f.team1_id === m.team2_id && f.team2_id === m.team1_id))
    )

  const addTeam = async () => {
    if (!tName.trim()) return
    setAddingTeam(true)
    await fetch('/api/judges/c/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: tName, school: tSchool, category: 'c' }) })
    setTName(''); setTSchool(''); await load(); setAddingTeam(false)
  }

  const deleteTeam = async (id: string) => {
    if (!await confirm('Delete team?')) return
    await fetch('/api/judges/c/teams', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  const nextAutoMatchId = () => {
    const nums = schedule.map(m => { const x = m.match_id.match(/^Q-(\d+)$/); return x ? parseInt(x[1]) : 0 })
    return `Q-${nums.length ? Math.max(...nums) + 1 : 1}`
  }

  const addScheduledMatch = async () => {
    if (!smT1 || !smT2) { setSmErr('Both teams required'); return }
    if (smT1 === smT2) { setSmErr('Teams must differ'); return }
    if (isAdmin && !smId.trim()) { setSmErr('Match ID required'); return }
    const matchId = isAdmin ? smId.toUpperCase() : nextAutoMatchId()
    setAddingSm(true); setSmErr('')
    const res = await fetch('/api/judges/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'c', match_id: matchId, team1_id: smT1, team2_id: smT2 }) })
    if (!res.ok) { const e = await res.json(); setSmErr(e.error); setAddingSm(false); return }
    setSmId(''); setSmT1(''); setSmT2(''); await load(); setAddingSm(false)
  }

  const deleteScheduledMatch = async (id: string) => {
    await fetch('/api/judges/schedule', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  const replayMatch = async (id: string, matchId: string) => {
    if (!await confirm(`Reset ${matchId} and delete its result? The match will go back to PENDING.`)) return
    await fetch(`/api/judges/schedule/${id}/replay`, { method: 'POST' })
    await load()
  }

  const setStatus = async (id: string, status: ScheduledMatch['status']) => {
    await fetch(`/api/judges/schedule/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setSchedule(prev => prev.map(m => m.id === id ? { ...m, status } : m))
  }

  return (
    <>{modal}<div className="min-h-screen bg-gray-100 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 h-14 flex items-center px-3 sm:px-6 gap-4 sticky top-0 z-10">
        <a href="/judges/dashboard" className="text-sm text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200">← Dashboard</a>
        <span className="font-black text-sm text-gray-900 dark:text-zinc-100">⚔️ MiniRoboWar</span>
        <span className="hidden sm:inline text-xs text-gray-400 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-950 px-2 py-0.5 rounded-full">📍 {eventCity}</span>
        <div className="ml-auto flex gap-1 overflow-x-auto">
          {(['schedule', 'teams'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === v ? 'bg-gray-900 text-white' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>
              {v === 'schedule' ? 'Fights' : 'Teams'}
            </button>
          ))}
          <button onClick={toggleStandby}
            className={`ml-2 text-xs font-bold px-3 py-1.5 rounded border transition-colors ${standbyMode ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'}`}>
            {standbyMode ? '⏸ Standby ON' : '⏸ Standby'}
          </button>
          <button onClick={toggleFinals}
            className={`ml-2 text-xs font-bold px-3 py-1.5 rounded border transition-colors ${finalsVisible ? 'bg-amber-500 text-white border-amber-500' : 'text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400'}`}>
            {finalsVisible ? '🏆 Finals ON' : '🏆 Finals'}
          </button>
          <a href="/c" target="_blank" className="ml-2 text-xs text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 px-3 py-1.5 rounded border border-gray-200 dark:border-zinc-700">Public ↗</a>
          <ThemeToggle />
        </div>
      </header>

      <div className="p-3 sm:p-6 max-w-5xl mx-auto">
        {loading && <p className="text-sm text-gray-400 dark:text-zinc-400 py-8 text-center">Loading…</p>}

        {!loading && view === 'schedule' && (
          <div className="mb-4">
            <LiveControlsC schedule={schedule} teamName={(id) => id ? teamName(id) : '—'} onChange={load} />
          </div>
        )}

        {!loading && view === 'schedule' && schedule.length > 0 && (
          <StatsBar
            done={schedule.filter(m => resultFor(m)).length}
            total={schedule.length}
            label="Fights"
          />
        )}

        {!loading && view === 'schedule' && (() => {
          const recent: RecentEntry[] = schedule
            .map(m => {
              const r = resultFor(m)
              if (!r) return null
              const winnerTeam = r.winner === 1 ? teamName(m.team1_id) : teamName(m.team2_id!)
              return {
                matchId: m.match_id,
                scheduleId: m.id,
                team: `${teamName(m.team1_id)} vs ${teamName(m.team2_id!)}`,
                result: `${winnerTeam} (${r.method})`,
                ts: r.created_at,
              }
            })
            .filter((x): x is RecentEntry => x !== null)
          return <RecentActivity category="c" entries={recent} />
        })()}

        {!loading && view === 'schedule' && (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 lg:items-start">
            <div className="flex-1 min-w-0 space-y-3">
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide">Generate Schedule</h2>
                  {schedule.length > 0 && <span className="text-xs text-gray-400 dark:text-zinc-400">{schedule.length} fight{schedule.length !== 1 ? 's' : ''} scheduled</span>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-zinc-400 shrink-0">Fights per team:</span>
                  <input type="number" min="1" max="20" value={genN} onChange={e => setGenN(e.target.value)}
                    className="border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm w-16 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 dark:placeholder-zinc-500" />
                  <button onClick={handleGenerate} disabled={!canGenerate || generating || teams.length < 2}
                    title={teams.length < 2 ? 'Add teams first' : ''}
                    className="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-gray-700 transition-colors">
                    {generating ? 'Generating…' : 'Generate'}
                  </button>
                  {schedule.length > 0 && (
                    <button onClick={handleReset} disabled={!isAdmin || resetting}
                      title={!isAdmin ? 'Admin only' : ''}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 dark:bg-red-950/30 disabled:opacity-40 transition-colors">
                      {resetting ? 'Resetting…' : 'Reset ×'}
                    </button>
                  )}
                  {teams.length < 2 && <span className="text-xs text-amber-500 dark:text-amber-400">Add teams first</span>}
                </div>
                {genError && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{genError}</p>}
              </div>

              {/* Finals panel */}
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm p-4 space-y-3">
                <h2 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">🏆 Finals Bracket</h2>
                <div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">Step 1 — generate semifinals from Top-4.</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleGenerateSemis} disabled={!isAdmin || genSemis}
                      className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-amber-700 transition-colors">
                      {genSemis ? 'Generating…' : 'Generate Semifinals'}
                    </button>
                    {schedule.filter(m => (m as {round?:string}).round === 'semi').length > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">✓ FC-SF1, FC-SF2 exist</span>
                    )}
                  </div>
                  {genSemisErr && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{genSemisErr}</p>}
                </div>
                <div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">Step 2 — after both semifinals played, generate final + 3rd place.</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleGenerateFinal} disabled={!isAdmin || genFinal}
                      className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-amber-700 transition-colors">
                      {genFinal ? 'Generating…' : 'Generate Final + 3rd Place'}
                    </button>
                    {schedule.filter(m => (m as {round?:string}).round === 'final').length > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">✓ FC-F1, FC-3RD exist</span>
                    )}
                  </div>
                  {genFinalErr && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{genFinalErr}</p>}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
                <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide mb-3">Add Fight to Schedule</h2>
                <div className="flex flex-wrap gap-2">
                  {isAdmin && (
                    <input value={smId} onChange={e => setSmId(e.target.value)} placeholder="F-1"
                      onKeyDown={e => e.key === 'Enter' && addScheduledMatch()}
                      className="border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm w-28 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 uppercase bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 dark:placeholder-zinc-500" />
                  )}
                  {!isAdmin && (
                    <span className="border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-gray-400 dark:text-zinc-400">{nextAutoMatchId()}</span>
                  )}
                  <select value={smT1} onChange={e => setSmT1(e.target.value)}
                    className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-300">
                    <option value="">Team 1…</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={smT2} onChange={e => setSmT2(e.target.value)}
                    className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-300">
                    <option value="">Team 2…</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button onClick={addScheduledMatch} disabled={addingSm}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-gray-700">
                    {addingSm ? '…' : '+'}
                  </button>
                </div>
                {smErr && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{smErr}</p>}
              </div>

              {/* Match filter tabs */}
              {schedule.length > 0 && (() => {
                const tabs: { key: typeof matchFilter; label: string; count: number }[] = [
                  { key: 'all',           label: 'All',            count: schedule.length },
                  { key: 'qualification', label: 'Qualification',  count: schedule.filter(m => m.phase !== 'finals').length },
                  { key: 'semi',          label: 'Semifinals',     count: schedule.filter(m => (m as {round?:string}).round === 'semi').length },
                  { key: 'final',         label: 'Finals',         count: schedule.filter(m => ['final','third_place'].includes((m as {round?:string}).round ?? '')).length },
                ]
                return (
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {tabs.map(tab => (
                      <button key={tab.key} onClick={() => setMatchFilter(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                          matchFilter === tab.key
                            ? tab.key === 'final' ? 'bg-amber-500 text-white' : 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                            : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100'
                        }`}>
                        {tab.label}
                        <span className={`text-[10px] px-1 py-0.5 rounded ${matchFilter === tab.key ? 'bg-white/20' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'}`}>{tab.count}</span>
                      </button>
                    ))}
                  </div>
                )
              })()}

              {/* Finals bracket — shown when Finals tab is active */}
              {matchFilter === 'final' && (() => {
                const byId = (id: string) => schedule.find(m => m.match_id === id) ?? null
                const sf1 = byId('FC-SF1'); const sf2 = byId('FC-SF2')
                const fin = byId('FC-F1');  const trd = byId('FC-3RD')

                const toCard = (m: typeof sf1) => {
                  if (!m) return null
                  const r = resultFor(m)
                  return {
                    match_id: m.match_id, status: m.status,
                    red:   { id: m.team1_id, name: teamName(m.team1_id), school: null },
                    white: m.team2_id ? { id: m.team2_id, name: teamName(m.team2_id), school: null } : null,
                    winner: (r?.winner ?? null) as 1 | 2 | 0 | null,
                    rounds1: r?.judge_score1 ?? null,
                    rounds2: r?.judge_score2 ?? null,
                  }
                }
                const sf1c = toCard(sf1); const sf2c = toCard(sf2)

                const nameOf = (c: ReturnType<typeof toCard>, side: 'winner' | 'loser') => {
                  if (!c?.winner) return null
                  const w = c.winner === 1 ? c.red?.name : c.white?.name
                  const l = c.winner === 1 ? c.white?.name : c.red?.name
                  return side === 'winner' ? (w ?? null) : (l ?? null)
                }
                const tbd = (id: string, n: string | null) => ({ id, name: n ?? '', school: null })

                const bracketMatches = [
                  ...(sf1c ? [sf1c] : []),
                  ...(sf2c ? [sf2c] : []),
                  toCard(fin) ?? { match_id: 'FC-F1', status: 'pending', red: tbd('f-r', nameOf(sf1c, 'winner')), white: tbd('f-w', nameOf(sf2c, 'winner')), winner: null, rounds1: null, rounds2: null },
                  toCard(trd) ?? { match_id: 'FC-3RD', status: 'pending', red: tbd('t-r', nameOf(sf1c, 'loser')), white: tbd('t-w', nameOf(sf2c, 'loser')), winner: null, rounds1: null, rounds2: null },
                ]

                return (
                  <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4 overflow-x-auto">
                    <FinalsBracketB matches={bracketMatches} scale={0.9} />
                  </div>
                )
              })()}

              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                {schedule.length === 0
                  ? <p className="text-center text-sm text-gray-300 dark:text-zinc-400 py-10">No fights scheduled yet</p>
                  : (
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[300px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-zinc-800 text-xs text-gray-400 dark:text-zinc-400 uppercase tracking-wide">
                          <th className="text-left px-3 py-3 w-16">Fight</th>
                          <th className="text-left px-3 py-3">Teams</th>
                          <th className="hidden sm:table-cell text-center px-3 py-3 w-20">Status</th>
                          <th className="text-center px-2 py-3 w-16">Method</th>
                          <th className="px-2 py-3 w-28"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {(() => {
                          const filtered = schedule.filter(m => {
                            if (matchFilter === 'all') return true
                            if (matchFilter === 'qualification') return m.phase !== 'finals'
                            if (matchFilter === 'semi') return (m as {round?:string}).round === 'semi'
                            if (matchFilter === 'final') return ['final','third_place'].includes((m as {round?:string}).round ?? '')
                            return true
                          })
                          const nextUpId = schedule.find(m => !resultFor(m))?.id
                          return filtered.map(m => {
                          const r = resultFor(m)
                          const done = !!r
                          const isNext = m.id === nextUpId
                          const isOpen = activeMatch?.id === m.id
                          return (
                            <tr key={m.id} className={`hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors ${isNext ? 'bg-blue-50/60 dark:bg-blue-950/30 border-l-4 border-l-blue-500' : isOpen ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono ${isNext ? 'text-blue-900 font-black text-base' : 'font-black text-gray-900 dark:text-zinc-100'}`}>{m.match_id}</span>
                                  {isNext && <span className="text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Next</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-medium text-gray-800 dark:text-zinc-200">{teamName(m.team1_id)}</span>
                                <span className="text-gray-400 dark:text-zinc-400 mx-1.5">vs</span>
                                <span className="font-medium text-gray-800 dark:text-zinc-200">{teamName(m.team2_id!)}</span>
                              </td>
                              <td className="hidden sm:table-cell px-3 py-3 text-center">
                                {done ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400">DONE</span>
                                ) : m.status === 'active' ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white animate-pulse">▶ ACTIVE</span>
                                ) : m.status === 'waiting' ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400">⏳ WAITING</span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">PENDING</span>
                                )}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {r
                                  ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{r.method}</span>
                                  : <span className="text-gray-300 dark:text-zinc-400 text-xs">—</span>}
                              </td>
                              <td className="px-2 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {!done && (
                                    <button onClick={() => setStatus(m.id, m.status === 'waiting' ? 'pending' : 'waiting')}
                                      className={`hidden sm:inline-flex px-2.5 py-2 rounded text-xs font-bold border transition-colors min-h-[36px] items-center ${m.status === 'waiting' ? 'bg-orange-100 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900' : 'border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-400 hover:text-orange-600 hover:border-orange-200 dark:hover:border-orange-900 dark:border-orange-900 hover:bg-orange-50 dark:hover:bg-orange-950/30 dark:bg-orange-950/30'}`}>
                                      {m.status === 'waiting' ? '⏳' : 'Wait'}
                                    </button>
                                  )}
                                  <button onClick={() => router.push('/judges/c/record/' + m.id)}
                                    className="px-3 py-2 rounded text-xs font-bold border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors min-h-[36px]">
                                    {done ? 'Edit' : 'Record'}
                                  </button>
                                  {done && isAdmin && (
                                    <button onClick={() => replayMatch(m.id, m.match_id)}
                                      className="px-2.5 py-2 rounded text-xs font-bold border border-orange-200 dark:border-orange-900 text-orange-500 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 dark:bg-orange-950/30 transition-colors min-h-[36px]">
                                      ↩
                                    </button>
                                  )}
                                  {r && (
                                    <button onClick={() => setActiveMatch(isOpen ? null : m)}
                                      className={`hidden sm:inline-flex px-2.5 py-2 rounded text-xs font-bold border transition-colors min-h-[36px] items-center ${isOpen ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>
                                      See
                                    </button>
                                  )}
                                  <button onClick={async () => { if (await confirm(`Delete ${m.match_id}?`)) deleteScheduledMatch(m.id) }}
                                    className="px-2 py-2 rounded text-xs text-red-300 hover:text-red-500 dark:text-red-400 border border-transparent hover:border-red-200 dark:hover:border-red-900 dark:border-red-900 transition-colors min-h-[36px]">✕</button>
                                </div>
                              </td>
                            </tr>
                          )
                          })
                        })()}
                      </tbody>
                    </table>
                    </div>
                  )}
              </div>
            </div>
            <div className="w-full lg:w-72 lg:shrink-0 lg:sticky lg:top-16 lg:self-start">
              {activeMatch && (() => {
                const r = resultFor(activeMatch)
                if (!r) return null
                return (
                  <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-gray-400 dark:text-zinc-400 uppercase tracking-wide">{activeMatch.match_id}</span>
                      <button onClick={() => setActiveMatch(null)} className="text-gray-300 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-300 text-sm leading-none">✕</button>
                    </div>
                    <div className="text-sm font-medium text-gray-800 dark:text-zinc-200">
                      {teamName(activeMatch.team1_id)} <span className="text-gray-400 dark:text-zinc-400">vs</span> {teamName(activeMatch.team2_id!)}
                    </div>
                    <div className="space-y-2">
                      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2 text-xs">
                        <div className="text-gray-400 dark:text-zinc-400 font-bold uppercase mb-0.5">Winner</div>
                        <div className="font-black text-gray-900 dark:text-zinc-100">{r.winner === 1 ? teamName(r.team1_id) : teamName(r.team2_id)}</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2 text-xs">
                        <div className="text-gray-400 dark:text-zinc-400 font-bold uppercase mb-0.5">Method</div>
                        <div className="font-bold text-gray-900 dark:text-zinc-100">{r.method}</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2 text-xs">
                        <div className="text-gray-400 dark:text-zinc-400 font-bold uppercase mb-0.5">Score</div>
                        <div className="font-mono font-bold text-gray-900 dark:text-zinc-100">{r.judge_score1} – {r.judge_score2}</div>
                      </div>
                      {r.notes && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2 text-xs">
                          <div className="text-amber-600 dark:text-amber-400 font-bold uppercase mb-0.5">Notes</div>
                          <div className="text-amber-900 dark:text-amber-200">{r.notes}</div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => router.push('/judges/c/record/' + activeMatch.id)}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                      Edit Result
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {!loading && view === 'teams' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
              <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide mb-3">Add Team</h2>
              <div className="flex gap-2">
                <input value={tName} onChange={e => setTName(e.target.value)} placeholder="Team name"
                  onKeyDown={e => e.key === 'Enter' && addTeam()}
                  className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 dark:placeholder-zinc-500" />
                <input value={tSchool} onChange={e => setTSchool(e.target.value)} placeholder="School"
                  onKeyDown={e => e.key === 'Enter' && addTeam()}
                  className="w-36 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 dark:placeholder-zinc-500" />
                <button onClick={addTeam} disabled={addingTeam || !tName.trim()}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-gray-700">
                  {addingTeam ? '…' : 'Add'}
                </button>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
              {teams.length === 0
                ? <p className="text-center text-sm text-gray-300 dark:text-zinc-400 py-10">No teams yet</p>
                : <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 dark:border-zinc-800 text-xs text-gray-400 dark:text-zinc-400 uppercase tracking-wide">
                    <th className="text-left px-5 py-3 w-8">#</th>
                    <th className="text-left px-4 py-3">Team</th>
                    <th className="text-left px-4 py-3">School</th>
                    <th className="text-center px-4 py-3">Pts</th>
                    <th className="text-center px-4 py-3 hidden sm:table-cell">Wins</th>
                    <th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody>
                    {teams.map((t, i) => {
                      const wins = fights.filter(f =>
                        (f.team1_id === t.id && f.winner === 1) || (f.team2_id === t.id && f.winner === 2)
                      ).length
                      const pts = wins * 3
                      return (
                        <tr key={t.id} className="border-b border-gray-50 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800">
                          <td className="px-5 py-3 text-gray-400 dark:text-zinc-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">{t.name}</td>
                          <td className="px-4 py-3 text-gray-400 dark:text-zinc-400">{t.school || '—'}</td>
                          <td className="px-4 py-3 text-center font-bold text-gray-800 dark:text-zinc-200">{pts}</td>
                          <td className="px-4 py-3 text-center text-gray-400 dark:text-zinc-500 hidden sm:table-cell">{wins}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => deleteTeam(t.id)} className="text-xs text-red-300 hover:text-red-500 dark:text-red-400">Del</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>}
            </div>
          </div>
        )}
      </div>
    </div></>
  )
}
