'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import type { Team, MatchD } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'
import { StatsBar } from '@/components/judges/StatsBar'
import { RecentActivity, type RecentEntry } from '@/components/judges/RecentActivity'
import LiveControlsD from '@/components/judges/LiveControlsD'
import { useEventSettings } from '@/lib/use-event-settings'
import { useConfirm } from '@/components/judges/useConfirm'
import { ThemeToggle } from '@/components/judges/ThemeToggle'

type View = 'schedule' | 'teams'
type TeamsTab = 'all' | 'finalists'

export default function JudgeDPage() {
  const router = useRouter()
  const { cityName: eventCity } = useEventSettings('en')
  const [view, setView] = useState<View>('schedule')
  const [teams, setTeams] = useState<Team[]>([])
  const [schedule, setSchedule] = useState<ScheduledMatch[]>([])
  const [matches, setMatches] = useState<MatchD[]>([])
  const [loading, setLoading] = useState(true)
  const { confirm, modal } = useConfirm()
  const [isAdmin, setIsAdmin] = useState(false)
  const [canGenerate, setCanGenerate] = useState(false)

  const [tName, setTName] = useState(''); const [tSchool, setTSchool] = useState(''); const [addingTeam, setAddingTeam] = useState(false)
  const [smId, setSmId] = useState(''); const [smT1, setSmT1] = useState(''); const [smT1b, setSmT1b] = useState(''); const [smT2, setSmT2] = useState(''); const [smT2b, setSmT2b] = useState(''); const [addingSm, setAddingSm] = useState(false); const [smErr, setSmErr] = useState('')
  const [genN, setGenN] = useState('2'); const [generating, setGenerating] = useState(false); const [resetting, setResetting] = useState(false); const [genError, setGenError] = useState('')
  const [matchFilter, setMatchFilter] = useState<'all' | 'group' | 'finals'>('all')
  const [teamsTab, setTeamsTab] = useState<TeamsTab>('all')
  const [allianceNames, setAllianceNames] = useState<Record<string, string>>({})
  const [savingName, setSavingName] = useState<Record<string, boolean>>({})

  const [activeMatch, setActiveMatch] = useState<ScheduledMatch | null>(null)
  const [finalsVisible, setFinalsVisible] = useState(false)
  const [standbyMode, setStandbyMode] = useState(false)
  useEffect(() => {
    fetch('/api/judges/d/live').then(r => r.json()).then(s => {
      setFinalsVisible(s.finals_visible ?? false)
      setStandbyMode(s.standby_mode ?? false)
    })
  }, [])
  const toggleFinals = async () => {
    const res = await fetch('/api/judges/d/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'toggle_finals' }) })
    if (res.ok) { const s = await res.json(); setFinalsVisible(s.finals_visible ?? false) }
  }
  const toggleStandby = async () => {
    const res = await fetch('/api/judges/d/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'toggle_standby' }) })
    if (res.ok) { const s = await res.json(); setStandbyMode(s.standby_mode ?? false) }
  }

  const teamName = (id: string) => teams.find(t => t.id === id)?.name ?? id

  const load = useCallback(async () => {
    const [tr, sc, mr] = await Promise.all([
      fetch('/api/judges/d/teams', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/schedule?category=d', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/d/matches', { cache: 'no-store' }).then(r => r.json()),
    ])
    const teamList: Team[] = Array.isArray(tr) ? tr : []
    setTeams(teamList)
    setAllianceNames(prev => {
      const next: Record<string, string> = { ...prev }
      for (const t of teamList) {
        // Only set initial value if judge hasn't started typing (not in prev)
        if (!(t.id in prev)) next[t.id] = t.alliance_name ?? ''
      }
      return next
    })
    const sorted = (Array.isArray(sc) ? sc : []).sort((a: { match_id: string }, b: { match_id: string }) =>
      a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
    setSchedule(sorted)
    setMatches(Array.isArray(mr) ? mr : [])
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
    if (!await confirm('Delete all scheduled matches for this category? This cannot be undone.')) return
    setGenerating(true); setGenError('')
    const res = await fetch('/api/judges/schedule/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'd', n }) })
    if (!res.ok) { const e = await res.json(); setGenError(e.error ?? 'Failed'); setGenerating(false); return }
    await load(); setGenerating(false)
  }

  const [genFinalsErr, setGenFinalsErr] = useState('')
  const [genFinals, setGenFinals] = useState(false)
  const handleGenerateFinals = async () => {
    if (!await confirm('Generate FINALS bracket from current standings? Existing finals will be replaced.')) return
    setGenFinals(true); setGenFinalsErr('')
    const res = await fetch('/api/judges/schedule/finals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'd' }) })
    if (!res.ok) { const e = await res.json(); setGenFinalsErr(e.error ?? 'Failed'); setGenFinals(false); return }
    await load(); setGenFinals(false)
  }

  const [resettingFinals, setResettingFinals] = useState(false)
  const handleResetFinals = async () => {
    if (!await confirm('Delete all Finals matches and their results? This cannot be undone.')) return
    setResettingFinals(true); setGenFinalsErr('')
    // 'semi' cascade also covers round_robin (used by Cat D)
    const res = await fetch('/api/judges/schedule/finals', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'd', round: 'semi' }) })
    if (!res.ok) { const e = await res.json(); setGenFinalsErr(e.error ?? 'Failed') }
    await load(); setResettingFinals(false)
  }

  const [advancing, setAdvancing] = useState(false)
  const handleAdvance = async () => {
    if (!await confirm('Generate the NEXT finals round from winners of completed matches? You can edit/delete the generated matches afterwards.')) return
    setAdvancing(true); setGenFinalsErr('')
    const res = await fetch('/api/judges/schedule/advance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'd' }) })
    if (!res.ok) { const e = await res.json(); setGenFinalsErr(e.error ?? 'Failed'); setAdvancing(false); return }
    await load(); setAdvancing(false)
  }

  const handleReset = async () => {
    if (!await confirm('Delete all scheduled matches AND clear all match results for this category? This cannot be undone.')) return
    setResetting(true)
    try {
      const resR = await fetch('/api/admin/reset-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'd' }) })
      if (!resR.ok) {
        const err = await resR.json().catch(() => null)
        alert(`Reset results failed (${resR.status}): ${err?.error ?? 'unknown'}`)
        setResetting(false)
        return
      }
      const resS = await fetch('/api/judges/schedule', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'd', all: true }) })
      if (!resS.ok) {
        const err = await resS.json().catch(() => null)
        alert(`Reset schedule failed (${resS.status}): ${err?.error ?? 'unknown'}`)
        setResetting(false)
        return
      }
      // Optimistically clear local state so Teams tab shows 0 goals immediately,
      // even if load() races with a stale poll.
      setMatches([])
      setSchedule([])
      await load()
    } finally {
      setResetting(false)
    }
  }

  const resultFor = (m: ScheduledMatch) =>
    matches.find(r => r.scheduled_match_id === m.id) ??
    matches.find(r =>
      !r.scheduled_match_id &&
      ((r.team1_id === m.team1_id && r.team2_id === m.team2_id) ||
       (r.team1_id === m.team2_id && r.team2_id === m.team1_id))
    )

  const addTeam = async () => {
    if (!tName.trim()) return
    setAddingTeam(true)
    await fetch('/api/judges/d/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: tName, school: tSchool, category: 'd' }) })
    setTName(''); setTSchool(''); await load(); setAddingTeam(false)
  }

  const deleteTeam = async (id: string) => {
    if (!await confirm('Delete team?')) return
    await fetch('/api/judges/d/teams', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  const nextAutoMatchId = () => {
    const nums = schedule.map(m => { const x = m.match_id.match(/^Q-(\d+)$/); return x ? parseInt(x[1]) : 0 })
    return `Q-${nums.length ? Math.max(...nums) + 1 : 1}`
  }

  const addScheduledMatch = async () => {
    if (!smT1 || !smT1b || !smT2 || !smT2b) { setSmErr('Fill all 4 team fields'); return }
    const ids = [smT1, smT1b, smT2, smT2b]
    if (new Set(ids).size !== 4) { setSmErr('All 4 teams must be different'); return }
    if (isAdmin && !smId.trim()) { setSmErr('Match ID required'); return }
    const matchId = isAdmin ? smId.toUpperCase() : nextAutoMatchId()
    setAddingSm(true); setSmErr('')
    const res = await fetch('/api/judges/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'd', match_id: matchId, team1_id: smT1, team1b_id: smT1b, team2_id: smT2, team2b_id: smT2b }) })
    if (!res.ok) { const e = await res.json(); setSmErr(e.error); setAddingSm(false); return }
    setSmId(''); setSmT1(''); setSmT1b(''); setSmT2(''); setSmT2b(''); await load(); setAddingSm(false)
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

  const scoreLabel = (r: MatchD) => `${r.goals1} : ${r.goals2}`

  return (
    <>{modal}<div className="min-h-screen bg-gray-100 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 h-14 flex items-center px-3 sm:px-6 gap-4 sticky top-0 z-10">
        <a href="/judges/dashboard" className="text-sm text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200">← Dashboard</a>
        <span className="font-black text-sm text-gray-900 dark:text-zinc-100">⚽ Robo Football</span>
        <span className="hidden sm:inline text-xs text-gray-400 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">📍 {eventCity}</span>
        <div className="ml-auto flex gap-1 overflow-x-auto">
          {(['schedule', 'teams'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === v ? 'bg-gray-900 text-white' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>
              {v === 'schedule' ? 'Matches' : 'Teams'}
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
          <a href="/d" target="_blank" className="ml-2 text-xs text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 px-3 py-1.5 rounded border border-gray-200 dark:border-zinc-700">Public ↗</a>
          <ThemeToggle />
        </div>
      </header>

      <div className="p-3 sm:p-6 max-w-5xl mx-auto">
        {loading && <p className="text-sm text-gray-400 dark:text-zinc-400 py-8 text-center">Loading…</p>}

        {!loading && view === 'schedule' && (
          <div className="mb-4">
            <LiveControlsD schedule={schedule} teamName={(id) => id ? teamName(id) : '—'} onChange={load} />
          </div>
        )}

        {!loading && view === 'schedule' && schedule.length > 0 && (
          <StatsBar
            done={schedule.filter(m => resultFor(m)).length}
            total={schedule.length}
            label="Matches"
          />
        )}

        {!loading && view === 'schedule' && (() => {
          const filteredSchedule = schedule.filter(m => {
            if (matchFilter === 'group') return m.phase !== 'finals'
            if (matchFilter === 'finals') return m.phase === 'finals'
            return true
          })
          const recent: RecentEntry[] = filteredSchedule
            .map(m => {
              const r = resultFor(m)
              if (!r) return null
              return {
                matchId: m.match_id,
                scheduleId: m.id,
                team: `${teamName(m.team1_id)}${m.team1b_id ? ` + ${teamName(m.team1b_id)}` : ''} vs ${teamName(m.team2_id!)}${m.team2b_id ? ` + ${teamName(m.team2b_id)}` : ''}`,
                result: scoreLabel(r),
                ts: r.created_at,
              }
            })
            .filter((x): x is RecentEntry => x !== null)
          return <RecentActivity category="d" entries={recent} />
        })()}

        {!loading && view === 'schedule' && (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 lg:items-start">
            <div className="flex-1 min-w-0 space-y-3">
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide">Generate Schedule</h2>
                  {schedule.length > 0 && <span className="text-xs text-gray-400 dark:text-zinc-400">{schedule.length} match{schedule.length !== 1 ? 'es' : ''} scheduled</span>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-zinc-400 shrink-0">Matches per team:</span>
                  <input type="number" min="1" max="20" value={genN} onChange={e => setGenN(e.target.value)}
                    className="border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm w-16 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 dark:bg-zinc-800 dark:text-zinc-100" />
                  <button onClick={handleGenerate} disabled={!canGenerate || generating || teams.length < 4}
                    title={teams.length < 4 ? 'Need at least 4 teams for alliance matches' : ''}
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
                  {teams.length < 4 && <span className="text-xs text-amber-500 dark:text-amber-400">Need 4+ teams · {teams.length} added</span>}
                </div>
                <p className="text-[11px] text-gray-400 dark:text-zinc-400 mt-2">
                  Robo Football matches are <strong>4-team alliances</strong> (2 vs 2). Each generated match takes 4 random teams.
                </p>
                {genError && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{genError}</p>}
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">🏆 Generate FINALS Bracket</h2>
                  {schedule.filter(m => m.phase === 'finals').length > 0 && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">{schedule.filter(m => m.phase === 'finals').length} finals scheduled</span>
                  )}
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">Top 3 teams by standings → each picks an alliance partner → 3 round-robin matches (A1 vs A2, A1 vs A3, A2 vs A3).</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={handleGenerateFinals} disabled={!isAdmin || genFinals}
                    title={!isAdmin ? 'Admin only' : ''}
                    className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-amber-700 transition-colors">
                    {genFinals ? 'Generating…' : 'Generate Finals'}
                  </button>
                  {isAdmin && schedule.some(m => m.phase === 'finals') && (
                    <button onClick={handleResetFinals} disabled={resettingFinals}
                      title="Delete all Finals matches and their results"
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 transition-colors">
                      {resettingFinals ? '…' : '↩ Reset Finals'}
                    </button>
                  )}
                </div>
                {genFinalsErr && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{genFinalsErr}</p>}
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
                <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide mb-3">Add Match to Schedule</h2>
                <div className="flex flex-wrap gap-2 items-start">
                  {isAdmin && (
                    <input value={smId} onChange={e => setSmId(e.target.value)} placeholder="G-1"
                      onKeyDown={e => e.key === 'Enter' && addScheduledMatch()}
                      className="border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm w-28 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 uppercase dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500" />
                  )}
                  {!isAdmin && (
                    <span className="border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-gray-400 dark:text-zinc-400">{nextAutoMatchId()}</span>
                  )}
                  <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                    <div className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">🔴 Red Alliance</div>
                    <select value={smT1} onChange={e => setSmT1(e.target.value)}
                      className="border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-300">
                      <option value="">Team 1…</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select value={smT1b} onChange={e => setSmT1b(e.target.value)}
                      className="border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-300">
                      <option value="">Team 1b…</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                    <div className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider">🔵 Blue Alliance</div>
                    <select value={smT2} onChange={e => setSmT2(e.target.value)}
                      className="border border-blue-200 dark:border-blue-900 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="">Team 2…</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select value={smT2b} onChange={e => setSmT2b(e.target.value)}
                      className="border border-blue-200 dark:border-blue-900 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="">Team 2b…</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <button onClick={addScheduledMatch} disabled={addingSm}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-gray-700 self-end">
                    {addingSm ? '…' : '+'}
                  </button>
                </div>
                {smErr && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{smErr}</p>}
              </div>

              {schedule.length > 0 && (() => {
                const tabs: { key: typeof matchFilter; label: string; count: number }[] = [
                  { key: 'all', label: 'All', count: schedule.length },
                  { key: 'group', label: 'Qualification', count: schedule.filter(m => m.phase !== 'finals').length },
                  { key: 'finals', label: 'Finals Round-Robin', count: schedule.filter(m => m.phase === 'finals').length },
                ]
                return (
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {tabs.map(tab => (
                      <button key={tab.key} onClick={() => setMatchFilter(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                          matchFilter === tab.key
                            ? tab.key === 'finals' ? 'bg-amber-500 text-white' : 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                            : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100'
                        }`}>
                        {tab.label}
                        <span className={`text-[10px] px-1 py-0.5 rounded ${matchFilter === tab.key ? 'bg-white/20' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'}`}>{tab.count}</span>
                      </button>
                    ))}
                  </div>
                )
              })()}

              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                {schedule.length === 0
                  ? <p className="text-center text-sm text-gray-300 dark:text-zinc-400 py-10">No matches scheduled yet</p>
                  : (
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[300px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-zinc-800 text-xs text-gray-400 dark:text-zinc-400 uppercase tracking-wide">
                          <th className="text-left px-3 py-3 w-16">Match</th>
                          <th className="text-left px-3 py-3">Teams</th>
                          <th className="hidden sm:table-cell text-center px-3 py-3 w-20">Status</th>
                          <th className="text-center px-2 py-3 w-16">Score</th>
                          <th className="px-2 py-3 w-28"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {(() => {
                          const filtered = schedule.filter(m => {
                            if (matchFilter === 'group') return m.phase !== 'finals'
                            if (matchFilter === 'finals') return m.phase === 'finals'
                            return true
                          })
                          const nextUpId = filtered.find(m => !resultFor(m))?.id
                          if (filtered.length === 0) return (
                            <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-300 dark:text-zinc-600">No matches yet</td></tr>
                          )
                          let lastSection = ''
                          return filtered.map(m => {
                          const section = m.phase === 'finals' ? 'Finals · Round-Robin' : 'Qualification'
                          const showHeader = section !== lastSection
                          if (showHeader) lastSection = section
                          const r = resultFor(m)
                          const done = !!r
                          const isNext = m.id === nextUpId
                          const isOpen = activeMatch?.id === m.id
                          return (
                            <Fragment key={m.id}>
                            {showHeader && (
                              <tr>
                                <td colSpan={5} className="px-4 pt-4 pb-1">
                                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                    section === 'Qualification' ? 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400' : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                                  }`}>{section}</span>
                                </td>
                              </tr>
                            )}
                            <tr className={`hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors ${isNext ? 'bg-blue-50/60 dark:bg-blue-950/30 border-l-4 border-l-blue-500' : isOpen ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono ${isNext ? 'text-blue-900 font-black text-base' : 'font-black text-gray-900 dark:text-zinc-100'}`}>{m.match_id}</span>
                                  {isNext && <span className="text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Next</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-medium text-rose-700 dark:text-rose-400">
                                  {teamName(m.team1_id)}{m.surrogate_team_ids?.includes(m.team1_id) && <sup className="ml-0.5 text-[9px] font-black text-amber-500">S</sup>}
                                  {m.team1b_id && <>{' + '}{teamName(m.team1b_id)}{m.surrogate_team_ids?.includes(m.team1b_id) && <sup className="ml-0.5 text-[9px] font-black text-amber-500">S</sup>}</>}
                                </span>
                                <span className="text-gray-400 dark:text-zinc-400 mx-1.5">vs</span>
                                <span className="font-medium text-blue-700 dark:text-blue-400">
                                  {teamName(m.team2_id!)}{m.surrogate_team_ids?.includes(m.team2_id!) && <sup className="ml-0.5 text-[9px] font-black text-amber-500">S</sup>}
                                  {m.team2b_id && <>{' + '}{teamName(m.team2b_id)}{m.surrogate_team_ids?.includes(m.team2b_id) && <sup className="ml-0.5 text-[9px] font-black text-amber-500">S</sup>}</>}
                                </span>
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
                              <td className="px-2 py-3 text-center font-mono font-bold text-gray-700 dark:text-zinc-300 text-xs">
                                {r ? scoreLabel(r) : <span className="text-gray-300 dark:text-zinc-400">—</span>}
                              </td>
                              <td className="px-2 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {!done && (
                                    <button onClick={() => setStatus(m.id, m.status === 'waiting' ? 'pending' : 'waiting')}
                                      className={`hidden sm:inline-flex px-2.5 py-2 rounded text-xs font-bold border transition-colors min-h-[36px] items-center ${m.status === 'waiting' ? 'bg-orange-100 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900' : 'border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-400 hover:text-orange-600 hover:border-orange-200 dark:hover:border-orange-900 dark:border-orange-900 hover:bg-orange-50 dark:hover:bg-orange-950/30 dark:bg-orange-950/30'}`}>
                                      {m.status === 'waiting' ? '⏳' : 'Wait'}
                                    </button>
                                  )}
                                  {done && (
                                    <button onClick={() => router.push('/judges/d/record/' + m.id)}
                                      className="px-3 py-2 rounded text-xs font-bold border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors min-h-[36px]">
                                      Edit
                                    </button>
                                  )}
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
                            </Fragment>
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
                      <button onClick={() => setActiveMatch(null)} className="text-gray-300 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 text-sm leading-none">✕</button>
                    </div>
                    <div className="text-sm font-medium text-gray-800 dark:text-zinc-200">
                      {teamName(activeMatch.team1_id)}{activeMatch.team1b_id ? ` + ${teamName(activeMatch.team1b_id)}` : ''} <span className="text-gray-400 dark:text-zinc-400">vs</span> {teamName(activeMatch.team2_id!)}{activeMatch.team2b_id ? ` + ${teamName(activeMatch.team2b_id)}` : ''}
                    </div>
                    <div className="space-y-2">
                      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2 text-xs">
                        <div className="text-gray-400 dark:text-zinc-400 font-bold uppercase mb-0.5">Score</div>
                        <div className="font-mono font-black text-2xl text-gray-900 dark:text-zinc-100">{r.goals1} : {r.goals2}</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2 text-xs">
                        <div className="text-gray-400 dark:text-zinc-400 font-bold uppercase mb-0.5">Phase</div>
                        <div className="font-bold text-gray-900 dark:text-zinc-100 capitalize">{r.match_phase}</div>
                      </div>
                      {r.notes && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2 text-xs">
                          <div className="text-amber-600 dark:text-amber-400 font-bold uppercase mb-0.5">Notes</div>
                          <div className="text-amber-900 dark:text-amber-200">{r.notes}</div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => router.push('/judges/d/record/' + activeMatch.id)}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                      Edit Result
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {!loading && view === 'teams' && (() => {
          // Extract unique finalist alliances from finals schedule
          const finalsMatches = schedule.filter(m => m.phase === 'finals')
          const allianceMap = new Map<string, { captainId: string; partnerId: string | null | undefined }>()
          for (const fm of finalsMatches) {
            if (fm.team1_id && !allianceMap.has(fm.team1_id)) allianceMap.set(fm.team1_id, { captainId: fm.team1_id, partnerId: fm.team1b_id })
            if (fm.team2_id && !allianceMap.has(fm.team2_id)) allianceMap.set(fm.team2_id, { captainId: fm.team2_id, partnerId: fm.team2b_id })
          }
          const alliances = [...allianceMap.values()]
          const hasFinalists = alliances.length > 0

          return (
          <div className="space-y-4">
            {/* Add team form */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
              <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide mb-3">Add Team</h2>
              <div className="flex gap-2">
                <input value={tName} onChange={e => setTName(e.target.value)} placeholder="Team name"
                  onKeyDown={e => e.key === 'Enter' && addTeam()}
                  className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500" />
                <input value={tSchool} onChange={e => setTSchool(e.target.value)} placeholder="School"
                  onKeyDown={e => e.key === 'Enter' && addTeam()}
                  className="w-36 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500" />
                <button onClick={addTeam} disabled={addingTeam || !tName.trim()}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-gray-700">
                  {addingTeam ? '…' : 'Add'}
                </button>
              </div>
            </div>

            {/* Sub-tabs */}
            {hasFinalists && (
              <div className="flex gap-1">
                {([['all', 'All Teams'], ['finalists', '🏆 Finalists']] as [TeamsTab, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setTeamsTab(key)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      teamsTab === key
                        ? key === 'finalists' ? 'bg-amber-500 text-white' : 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                        : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100'
                    }`}>
                    {label}
                    {key === 'finalists' && <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-white/20">{alliances.length}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* All Teams table */}
            {teamsTab === 'all' && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                {teams.length === 0
                  ? <p className="text-center text-sm text-gray-300 dark:text-zinc-400 py-10">No teams yet</p>
                  : <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 dark:border-zinc-800 text-xs text-gray-400 dark:text-zinc-400 uppercase tracking-wide">
                      <th className="text-left px-5 py-3 w-8">#</th>
                      <th className="text-left px-4 py-3">Team</th>
                      <th className="text-left px-4 py-3">School</th>
                      <th className="text-center px-4 py-3">Pts</th>
                      <th className="text-center px-4 py-3 hidden sm:table-cell">Goals</th>
                      <th className="px-4 py-3"></th>
                    </tr></thead>
                    <tbody>
                      {teams.map((t, i) => {
                        const pts = matches.reduce((sum, m) => {
                          const inA1 = m.team1_id === t.id || m.team1b_id === t.id
                          const inA2 = m.team2_id === t.id || m.team2b_id === t.id
                          if (!inA1 && !inA2) return sum
                          const won = inA1 ? m.goals1 > m.goals2 : m.goals2 > m.goals1
                          const drew = m.goals1 === m.goals2
                          return sum + (won ? 3 : drew ? 1 : 0)
                        }, 0)
                        const goalsScored = matches.reduce((sum, m) => {
                          if (m.team1_id === t.id || m.team1b_id === t.id) return sum + m.goals1
                          if (m.team2_id === t.id || m.team2b_id === t.id) return sum + m.goals2
                          return sum
                        }, 0)
                        return (
                          <tr key={t.id} className="border-b border-gray-50 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800">
                            <td className="px-5 py-3 text-gray-400 dark:text-zinc-400 text-xs">{i + 1}</td>
                            <td className="px-4 py-3 font-medium dark:text-zinc-200">{t.name}</td>
                            <td className="px-4 py-3 text-gray-400 dark:text-zinc-400">{t.school || '—'}</td>
                            <td className="px-4 py-3 text-center font-bold text-gray-800 dark:text-zinc-200">{pts}</td>
                            <td className="px-4 py-3 text-center text-gray-400 dark:text-zinc-500 hidden sm:table-cell">{goalsScored}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => deleteTeam(t.id)} className="text-xs text-red-300 hover:text-red-500 dark:text-red-400">Del</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>}
              </div>
            )}

            {/* Finalists tab */}
            {teamsTab === 'finalists' && (
              <div className="space-y-3">
                {alliances.map((a, i) => {
                  const captain = teams.find(t => t.id === a.captainId)
                  if (!captain) return null
                  const captainIds = new Set(alliances.map(x => x.captainId))
                  const available = teams.filter(t => !captainIds.has(t.id))
                  const currentName = allianceNames[captain.id] ?? captain.alliance_name ?? ''
                  const savedName = captain.alliance_name ?? ''
                  const nameChanged = currentName !== savedName

                  const saveAllianceName = async () => {
                    const val = currentName.trim() || null
                    setSavingName(p => ({ ...p, [captain.id]: true }))
                    await fetch('/api/judges/d/teams', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: captain.id, alliance_name: val }) })
                    await load()
                    setSavingName(p => ({ ...p, [captain.id]: false }))
                  }

                  return (
                    <div key={a.captainId} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
                      {/* Captain header */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
                        <span className="font-bold text-sm text-gray-900 dark:text-zinc-100">{captain.name}</span>
                        {captain.school && <span className="text-xs text-gray-400 dark:text-zinc-500">· {captain.school}</span>}
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 rounded uppercase tracking-wide">Captain</span>
                      </div>

                      {/* Partner row */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wide w-28 shrink-0">Partner team</span>
                        <select
                          value={a.partnerId ?? ''}
                          onChange={async e => {
                            const val = e.target.value || null
                            await fetch('/api/judges/d/partner', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captain_id: captain.id, partner_id: val }) })
                            await load()
                          }}
                          className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-300">
                          <option value="">— Not picked yet —</option>
                          {available.map(t => (
                            <option key={t.id} value={t.id}>{t.name}{t.school ? ` (${t.school})` : ''}</option>
                          ))}
                        </select>
                      </div>

                      {/* Alliance name row */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wide w-28 shrink-0">Alliance name</span>
                        <input
                          value={currentName}
                          onChange={e => setAllianceNames(p => ({ ...p, [captain.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && nameChanged && saveAllianceName()}
                          placeholder="Optional…"
                          className="flex-1 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                        />
                        <button
                          onClick={saveAllianceName}
                          disabled={!nameChanged || savingName[captain.id]}
                          className="px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors disabled:opacity-30 disabled:cursor-default bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent hover:bg-gray-700 dark:hover:bg-zinc-300">
                          {savingName[captain.id] ? '…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          )
        })()}
      </div>
    </div></>
  )
}
