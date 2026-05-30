'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import type { Team, ResultA } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'
import { StatsBar } from '@/components/judges/StatsBar'
import { RecentActivity, type RecentEntry } from '@/components/judges/RecentActivity'
import { useConfirm } from '@/components/judges/useConfirm'
import LiveControlsA from '@/components/judges/LiveControlsA'
import { useEventSettings } from '@/lib/use-event-settings'
import { ThemeToggle } from '@/components/judges/ThemeToggle'

type View = 'schedule' | 'teams'

export default function JudgeAPage() {
  const router = useRouter()
  const { cityName: eventCity } = useEventSettings('en')
  const [view, setView] = useState<View>('schedule')
  const [teams, setTeams] = useState<Team[]>([])
  const [schedule, setSchedule] = useState<ScheduledMatch[]>([])
  const [results, setResults] = useState<ResultA[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canGenerate, setCanGenerate] = useState(false)
  const { confirm, modal } = useConfirm()

  const [tName, setTName] = useState(''); const [tSchool, setTSchool] = useState(''); const [addingTeam, setAddingTeam] = useState(false)
  const [smId, setSmId] = useState(''); const [smT1, setSmT1] = useState(''); const [smT2, setSmT2] = useState(''); const [addingSm, setAddingSm] = useState(false); const [smErr, setSmErr] = useState('')
  const [genN, setGenN] = useState('2'); const [generating, setGenerating] = useState(false); const [resetting, setResetting] = useState(false); const [genError, setGenError] = useState('')

  const [activeMatch, setActiveMatch] = useState<ScheduledMatch | null>(null)
  const [finalsVisible, setFinalsVisible] = useState(false)

  useEffect(() => {
    fetch('/api/judges/a/live').then(r => r.json()).then(s => setFinalsVisible(s.finals_visible ?? false))
  }, [])

  const toggleFinals = async () => {
    const res = await fetch('/api/judges/a/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'toggle_finals' }) })
    if (res.ok) { const s = await res.json(); setFinalsVisible(s.finals_visible ?? false) }
  }

  const teamName = (id: string) => teams.find(t => t.id === id)?.name ?? id

  const load = useCallback(async () => {
    setLoading(true)
    const [tr, sc, re] = await Promise.all([
      fetch('/api/judges/a/teams', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/schedule?category=a', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/a/results', { cache: 'no-store' }).then(r => r.json()),
    ])
    setTeams(Array.isArray(tr) ? tr : [])
    const sorted = (Array.isArray(sc) ? sc : []).sort((a: { match_id: string }, b: { match_id: string }) =>
      a.match_id.localeCompare(b.match_id, undefined, { numeric: true }))
    setSchedule(sorted)
    setResults(Array.isArray(re) ? re : [])
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
    const res = await fetch('/api/judges/schedule/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'a', n }) })
    if (!res.ok) { const e = await res.json(); setGenError(e.error ?? 'Failed'); setGenerating(false); return }
    await load(); setGenerating(false)
  }

  const handleReset = async () => {
    if (!await confirm('Delete all scheduled matches for this category? This cannot be undone.')) return
    setResetting(true)
    await fetch('/api/judges/schedule', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'a', all: true }) })
    await load(); setResetting(false)
  }

  const [genFinalsErr, setGenFinalsErr] = useState('')
  const [genFinals, setGenFinals] = useState(false)
  const handleGenerateFinals = async () => {
    if (!await confirm('Generate FINALS bracket from current Top-4 standings? Existing finals will be replaced.')) return
    setGenFinals(true); setGenFinalsErr('')
    const res = await fetch('/api/judges/schedule/finals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'a' }) })
    if (!res.ok) { const e = await res.json(); setGenFinalsErr(e.error ?? 'Failed'); setGenFinals(false); return }
    await load(); setGenFinals(false)
  }

  const openDetail = (m: ScheduledMatch) => { setActiveMatch(m) }

  const addTeam = async () => {
    if (!tName.trim()) return
    setAddingTeam(true)
    await fetch('/api/judges/a/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: tName, school: tSchool, category: 'a' }) })
    setTName(''); setTSchool(''); await load(); setAddingTeam(false)
  }

  const deleteTeam = async (id: string) => {
    if (!await confirm('Delete team?')) return
    await fetch('/api/judges/a/teams', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  const nextAutoMatchId = () => {
    const nums = schedule.map(m => { const x = m.match_id.match(/^Q-(\d+)$/); return x ? parseInt(x[1]) : 0 })
    return `Q-${nums.length ? Math.max(...nums) + 1 : 1}`
  }

  const addMatch = async () => {
    if (!smT1) { setSmErr('Team required'); return }
    if (isAdmin && !smId.trim()) { setSmErr('Match ID required'); return }
    const matchId = isAdmin ? smId.toUpperCase() : nextAutoMatchId()
    setAddingSm(true); setSmErr('')
    const res = await fetch('/api/judges/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'a', match_id: matchId, team1_id: smT1, team2_id: null }) })
    if (!res.ok) { const e = await res.json(); setSmErr(e.error); setAddingSm(false); return }
    setSmId(''); setSmT1(''); setSmT2(''); await load(); setAddingSm(false)
  }

  const deleteMatch = async (id: string) => {
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

  const resultFor = (m: ScheduledMatch) => results.find(r => r.scheduled_match_id === m.id)

  const resultLabel = (r: ResultA) => {
    if (r.penalty === 'dnf') return 'DNF'
    if (r.penalty === 'disq') return 'DISQ'
    return r.total !== null ? r.total.toFixed(2) + 's' : '—'
  }

  return (
    <>{modal}<div className="min-h-screen bg-gray-100 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 h-14 flex items-center px-3 sm:px-6 gap-4 sticky top-0 z-10">
        <a href="/judges/dashboard" className="text-sm text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200">← Dashboard</a>
        <span className="font-black text-sm text-gray-900 dark:text-zinc-100">🏎️ Line Follower</span>
        <span className="hidden sm:inline text-xs text-gray-400 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">📍 {eventCity}</span>
        <div className="ml-auto flex gap-1 overflow-x-auto">
          {(['schedule', 'teams'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === v ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>
              {v === 'schedule' ? 'Matches' : 'Teams'}
            </button>
          ))}
          <button onClick={toggleFinals}
            className={`ml-2 text-xs font-bold px-3 py-1.5 rounded border transition-colors ${finalsVisible ? 'bg-amber-500 text-white border-amber-500' : 'text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400'}`}>
            {finalsVisible ? '🏆 Finals ON' : '🏆 Finals'}
          </button>
          <a href="/judges/view/a" className="ml-2 text-xs text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 px-3 py-1.5 rounded border border-gray-200 dark:border-zinc-700">Public ↗</a>
          <ThemeToggle />
        </div>
      </header>

      <div className="p-3 sm:p-6 max-w-5xl mx-auto">
        {loading && <p className="text-sm text-gray-400 dark:text-zinc-400 py-8 text-center">Loading…</p>}

        {!loading && view === 'schedule' && (
          <div className="mb-4">
            <LiveControlsA schedule={schedule} teamName={(id) => id ? teamName(id) : '—'} onChange={load} />
          </div>
        )}

        {!loading && view === 'schedule' && schedule.length > 0 && (
          <StatsBar
            done={schedule.filter(m => results.some(r => r.scheduled_match_id === m.id)).length}
            total={schedule.length}
            label="Runs"
          />
        )}

        {!loading && view === 'schedule' && (() => {
          const recent: RecentEntry[] = schedule
            .map(m => {
              const r = results.find(x => x.scheduled_match_id === m.id)
              if (!r) return null
              return {
                matchId: m.match_id,
                scheduleId: m.id,
                team: teamName(m.team1_id),
                result: resultLabel(r),
                ts: r.updated_at,
              }
            })
            .filter((x): x is RecentEntry => x !== null)
          return <RecentActivity category="a" entries={recent} />
        })()}

        {!loading && view === 'schedule' && (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 lg:items-start">
            <div className="flex-1 min-w-0 space-y-3">
              {/* Generate panel */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide">Generate Schedule</h2>
                  {schedule.length > 0 && (
                    <span className="text-xs text-gray-400 dark:text-zinc-400">{schedule.length} match{schedule.length !== 1 ? 'es' : ''} scheduled</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-zinc-400 shrink-0">Matches per team:</span>
                  <input type="number" min="1" max="20" value={genN} onChange={e => setGenN(e.target.value)}
                    className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 rounded-lg px-3 py-1.5 text-sm w-16 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
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
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">🏆 Generate FINALS Bracket</h2>
                  {schedule.filter(m => m.phase === 'finals').length > 0 && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">{schedule.filter(m => m.phase === 'finals').length} finals scheduled</span>
                  )}
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">Auto-picks Top 4 from current standings (Double Elimination).</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={handleGenerateFinals} disabled={!isAdmin || genFinals}
                    title={!isAdmin ? 'Admin only' : ''}
                    className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-amber-700 transition-colors">
                    {genFinals ? 'Generating…' : 'Generate Finals'}
                  </button>
                </div>
                {genFinalsErr && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{genFinalsErr}</p>}
              </div>

              {/* Add form */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
                <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide mb-3">Add Match to Schedule</h2>
                <div className="flex flex-wrap gap-2">
                  {isAdmin && (
                    <input value={smId} onChange={e => setSmId(e.target.value)} placeholder="Q-77"
                      onKeyDown={e => e.key === 'Enter' && addMatch()}
                      className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 rounded-lg px-3 py-2 text-sm w-28 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 uppercase" />
                  )}
                  {!isAdmin && (
                    <span className="border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-gray-400 dark:text-zinc-400">{nextAutoMatchId()}</span>
                  )}
                  <select value={smT1} onChange={e => setSmT1(e.target.value)}
                    className="flex-1 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                    <option value="">Team…</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button onClick={addMatch} disabled={addingSm}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-gray-700">
                    {addingSm ? '…' : '+ Add'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-zinc-400 mt-2">{isAdmin ? 'Use this to add tie-break runs (e.g. T-1, EX-1) or extra qualification slots.' : 'Adds the next match in sequence.'}</p>
                {smErr && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{smErr}</p>}
              </div>

              {/* Match table */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                {schedule.length === 0
                  ? <p className="text-center text-sm text-gray-300 dark:text-zinc-400 py-10">No matches scheduled yet</p>
                  : (
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[300px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-zinc-800 text-xs text-gray-400 dark:text-zinc-400 uppercase tracking-wide">
                          <th className="text-left px-3 py-3 w-16">Match</th>
                          <th className="text-left px-3 py-3">Team</th>
                          <th className="hidden sm:table-cell text-center px-3 py-3 w-20">Status</th>
                          <th className="text-center px-2 py-3 w-16">Result</th>
                          <th className="px-2 py-3 w-28"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {(() => {
                          const nextUpId = schedule.find(m => !resultFor(m))?.id
                          return schedule.map(m => {
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
                                <div className={`font-medium truncate ${isNext ? 'text-gray-900 dark:text-zinc-100 font-bold' : 'text-gray-800 dark:text-zinc-200'}`}>{teamName(m.team1_id)}</div>
                                {m.team2_id && <div className="text-xs text-gray-400 dark:text-zinc-400">ref: {teamName(m.team2_id)}</div>}
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
                                {r ? resultLabel(r) : <span className="text-gray-300 dark:text-zinc-400">—</span>}
                              </td>
                              <td className="px-2 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {!done && (
                                    <button onClick={() => setStatus(m.id, m.status === 'waiting' ? 'pending' : 'waiting')}
                                      className={`hidden sm:inline-flex px-2.5 py-2 rounded text-xs font-bold border transition-colors min-h-[36px] items-center ${m.status === 'waiting' ? 'bg-orange-100 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900' : 'border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-400 hover:text-orange-600 hover:border-orange-200 dark:hover:border-orange-900 dark:border-orange-900 hover:bg-orange-50 dark:hover:bg-orange-950/30 dark:bg-orange-950/30'}`}>
                                      {m.status === 'waiting' ? '⏳' : 'Wait'}
                                    </button>
                                  )}
                                  <button onClick={() => router.push('/judges/a/record/' + m.id)}
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
                                  <button onClick={async () => { if (await confirm(`Delete ${m.match_id}?`)) deleteMatch(m.id) }}
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

            {/* Detail panel — sticky so it stays at viewport level */}
            <div className="w-full lg:w-72 lg:shrink-0 lg:sticky lg:top-16 lg:self-start">
              {!activeMatch ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-6 text-center">
                  <div className="text-3xl mb-2">👆</div>
                  <p className="text-sm text-gray-400 dark:text-zinc-400">Click See on a match to view details</p>
                </div>
              ) : (() => {
                const r = resultFor(activeMatch)
                return (
                  <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-black font-mono text-lg text-gray-900 dark:text-zinc-100">{activeMatch.match_id}</span>
                      <button onClick={() => setActiveMatch(null)} className="text-xs text-gray-300 dark:text-zinc-400 hover:text-gray-500 dark:hover:text-zinc-300">✕</button>
                    </div>
                    <div className="text-sm font-medium text-gray-700 dark:text-zinc-300">{teamName(activeMatch.team1_id)}</div>
                    {r ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                            <div className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase mb-1">Run 1</div>
                            <div className="font-mono font-bold text-gray-900 dark:text-zinc-100">{r.run1 !== null ? r.run1 + 's' : '—'}</div>
                          </div>
                          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                            <div className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase mb-1">Run 2</div>
                            <div className="font-mono font-bold text-gray-900 dark:text-zinc-100">{r.run2 !== null ? r.run2 + 's' : '—'}</div>
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                          <div className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase mb-1">Best / Total</div>
                          <div className="font-mono font-black text-xl text-gray-900 dark:text-zinc-100">{resultLabel(r)}</div>
                        </div>
                        <div className="flex gap-2">
                          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 flex-1">
                            <div className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase mb-1">Penalty</div>
                            <div className="font-bold text-gray-900 dark:text-zinc-100">{r.penalty === '0' ? '+0s' : r.penalty === '20' ? '+20s' : r.penalty === '40' ? '+40s' : r.penalty.toUpperCase()}</div>
                          </div>
                          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 flex-1">
                            <div className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase mb-1">Phase</div>
                            <div className="font-bold text-gray-900 dark:text-zinc-100 capitalize">{r.run_phase ?? '—'}</div>
                          </div>
                        </div>
                        {r.notes && (
                          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                            <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">Judge Notes</div>
                            <div className="text-sm text-amber-900 dark:text-amber-200">{r.notes}</div>
                          </div>
                        )}
                        <button onClick={() => router.push('/judges/a/record/' + activeMatch.id)}
                          className="w-full py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                          Edit Result
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 dark:text-zinc-400">No result recorded yet.</p>
                    )}
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
                  className="flex-1 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                <input value={tSchool} onChange={e => setTSchool(e.target.value)} placeholder="School"
                  onKeyDown={e => e.key === 'Enter' && addTeam()}
                  className="w-36 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
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
                    <th className="text-center px-4 py-3">Best time</th>
                    <th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody>
                    {teams.map((t, i) => {
                      const teamResults = results.filter(r => r.team_id === t.id)
                      const r = teamResults.reduce<ResultA | null>((best, curr) => {
                        if (!best) return curr
                        if (curr.penalty === 'dnf' || curr.penalty === 'disq') return best
                        if (best.penalty === 'dnf' || best.penalty === 'disq') return curr
                        return curr.total !== null && best.total !== null && curr.total < best.total ? curr : best
                      }, null)
                      return (
                        <tr key={t.id} className="border-b border-gray-50 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800">
                          <td className="px-5 py-3 text-gray-400 dark:text-zinc-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-3 font-medium dark:text-zinc-200">{t.name}</td>
                          <td className="px-4 py-3 text-gray-400 dark:text-zinc-400">{t.school || '—'}</td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-gray-800 dark:text-zinc-200">
                            {r ? resultLabel(r) : '—'}
                          </td>
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
