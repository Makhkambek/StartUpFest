'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Team, MatchD } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'
import { StatsBar } from '@/components/judges/StatsBar'
import { RecentActivity, type RecentEntry } from '@/components/judges/RecentActivity'
import LiveControlsD from '@/components/judges/LiveControlsD'
import { useEventSettings } from '@/lib/use-event-settings'
import { useConfirm } from '@/components/judges/useConfirm'

type View = 'schedule' | 'teams'

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

  const [activeMatch, setActiveMatch] = useState<ScheduledMatch | null>(null)
  const [finalsVisible, setFinalsVisible] = useState(false)
  useEffect(() => {
    fetch('/api/judges/d/live').then(r => r.json()).then(s => setFinalsVisible(s.finals_visible ?? false))
  }, [])
  const toggleFinals = async () => {
    const res = await fetch('/api/judges/d/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'toggle_finals' }) })
    if (res.ok) { const s = await res.json(); setFinalsVisible(s.finals_visible ?? false) }
  }

  const teamName = (id: string) => teams.find(t => t.id === id)?.name ?? id

  const load = useCallback(async () => {
    setLoading(true)
    const [tr, sc, mr] = await Promise.all([
      fetch('/api/judges/d/teams', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/schedule?category=d', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/d/matches', { cache: 'no-store' }).then(r => r.json()),
    ])
    setTeams(Array.isArray(tr) ? tr : [])
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

  const [advancing, setAdvancing] = useState(false)
  const handleAdvance = async () => {
    if (!await confirm('Generate the NEXT finals round from winners of completed matches? You can edit/delete the generated matches afterwards.')) return
    setAdvancing(true); setGenFinalsErr('')
    const res = await fetch('/api/judges/schedule/advance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'd' }) })
    if (!res.ok) { const e = await res.json(); setGenFinalsErr(e.error ?? 'Failed'); setAdvancing(false); return }
    await load(); setAdvancing(false)
  }

  const handleReset = async () => {
    if (!await confirm('Delete all scheduled matches for this category? This cannot be undone.')) return
    setResetting(true)
    await fetch('/api/judges/schedule', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'd', all: true }) })
    await load(); setResetting(false)
  }

  const resultFor = (m: ScheduledMatch) =>
    matches.find(r =>
      (r.team1_id === m.team1_id && r.team2_id === m.team2_id) ||
      (r.team1_id === m.team2_id && r.team2_id === m.team1_id)
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
    <>{modal}<div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 h-14 flex items-center px-3 sm:px-6 gap-4 sticky top-0 z-10">
        <a href="/judges/dashboard" className="text-sm text-gray-400 hover:text-gray-700">← Dashboard</a>
        <span className="font-black text-sm text-gray-900">⚽ Robo Football</span>
        <span className="hidden sm:inline text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">📍 {eventCity}</span>
        <div className="ml-auto flex gap-1 overflow-x-auto">
          {(['schedule', 'teams'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
              {v === 'schedule' ? 'Matches' : 'Teams'}
            </button>
          ))}
          <button onClick={toggleFinals}
            className={`ml-2 text-xs font-bold px-3 py-1.5 rounded border transition-colors ${finalsVisible ? 'bg-amber-500 text-white border-amber-500' : 'text-gray-500 border-gray-200 hover:border-amber-400 hover:text-amber-600'}`}>
            {finalsVisible ? '🏆 Finals ON' : '🏆 Finals'}
          </button>
          <a href="/judges/view/d" className="ml-2 text-xs text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200">Public ↗</a>
        </div>
      </header>

      <div className="p-3 sm:p-6 max-w-5xl mx-auto">
        {loading && <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>}

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
          const recent: RecentEntry[] = schedule
            .map(m => {
              const r = resultFor(m)
              if (!r) return null
              return {
                matchId: m.match_id,
                scheduleId: m.id,
                team: `${teamName(m.team1_id)} vs ${teamName(m.team2_id!)}`,
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
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Generate Schedule</h2>
                  {schedule.length > 0 && <span className="text-xs text-gray-400">{schedule.length} match{schedule.length !== 1 ? 'es' : ''} scheduled</span>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">Matches per team:</span>
                  <input type="number" min="1" max="20" value={genN} onChange={e => setGenN(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-16 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  <button onClick={handleGenerate} disabled={!canGenerate || generating || teams.length < 4}
                    title={teams.length < 4 ? 'Need at least 4 teams for alliance matches' : ''}
                    className="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-gray-700 transition-colors">
                    {generating ? 'Generating…' : 'Generate'}
                  </button>
                  {schedule.length > 0 && (
                    <button onClick={handleReset} disabled={!isAdmin || resetting}
                      title={!isAdmin ? 'Admin only' : ''}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">
                      {resetting ? 'Resetting…' : 'Reset ×'}
                    </button>
                  )}
                  {teams.length < 4 && <span className="text-xs text-amber-500">Need 4+ teams · {teams.length} added</span>}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Robo Football matches are <strong>4-team alliances</strong> (2 vs 2). Each generated match takes 4 random teams.
                </p>
                {genError && <p className="text-xs text-red-500 mt-2">{genError}</p>}
              </div>

              <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-amber-700 uppercase tracking-wide">🏆 Generate FINALS Bracket</h2>
                  {schedule.filter(m => m.phase === 'finals').length > 0 && (
                    <span className="text-xs text-amber-600">{schedule.filter(m => m.phase === 'finals').length} finals scheduled</span>
                  )}
                </div>
                <p className="text-[11px] text-amber-700 mt-1">Auto-picks Top 4 (or Top 8) from current standings → semi/quarter bracket.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={handleGenerateFinals} disabled={!isAdmin || genFinals || advancing}
                    title={!isAdmin ? 'Admin only' : ''}
                    className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-amber-700 transition-colors">
                    {genFinals ? 'Generating…' : 'Generate Finals'}
                  </button>
                  <button onClick={handleAdvance} disabled={!isAdmin || advancing || genFinals}
                    title={!isAdmin ? 'Admin only' : 'Generate next round from completed matches. You can edit/delete the generated matches.'}
                    className="bg-white border border-amber-600 text-amber-700 px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-amber-50 transition-colors">
                    {advancing ? 'Advancing…' : '→ Next Round'}
                  </button>
                </div>
                {genFinalsErr && <p className="text-xs text-red-500 mt-2">{genFinalsErr}</p>}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Add Match to Schedule</h2>
                <div className="flex flex-wrap gap-2 items-start">
                  {isAdmin && (
                    <input value={smId} onChange={e => setSmId(e.target.value)} placeholder="G-1"
                      onKeyDown={e => e.key === 'Enter' && addScheduledMatch()}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 uppercase" />
                  )}
                  {!isAdmin && (
                    <span className="border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm font-mono text-gray-400">{nextAutoMatchId()}</span>
                  )}
                  <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                    <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">🔴 Red Alliance</div>
                    <select value={smT1} onChange={e => setSmT1(e.target.value)}
                      className="border border-rose-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300">
                      <option value="">Team 1…</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select value={smT1b} onChange={e => setSmT1b(e.target.value)}
                      className="border border-rose-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300">
                      <option value="">Team 1b…</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">🔵 Blue Alliance</div>
                    <select value={smT2} onChange={e => setSmT2(e.target.value)}
                      className="border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="">Team 2…</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select value={smT2b} onChange={e => setSmT2b(e.target.value)}
                      className="border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="">Team 2b…</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <button onClick={addScheduledMatch} disabled={addingSm}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-gray-700 self-end">
                    {addingSm ? '…' : '+'}
                  </button>
                </div>
                {smErr && <p className="text-xs text-red-500 mt-2">{smErr}</p>}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {schedule.length === 0
                  ? <p className="text-center text-sm text-gray-300 py-10">No matches scheduled yet</p>
                  : (
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[300px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                          <th className="text-left px-3 py-3 w-16">Match</th>
                          <th className="text-left px-3 py-3">Teams</th>
                          <th className="hidden sm:table-cell text-center px-3 py-3 w-20">Status</th>
                          <th className="text-center px-2 py-3 w-16">Score</th>
                          <th className="px-2 py-3 w-28"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(() => {
                          const nextUpId = schedule.find(m => !resultFor(m))?.id
                          return schedule.map(m => {
                          const r = resultFor(m)
                          const done = !!r
                          const isNext = m.id === nextUpId
                          const isOpen = activeMatch?.id === m.id
                          return (
                            <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${isNext ? 'bg-blue-50/60 border-l-4 border-l-blue-500' : isOpen ? 'bg-amber-50' : ''}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono ${isNext ? 'text-blue-900 font-black text-base' : 'font-black text-gray-900'}`}>{m.match_id}</span>
                                  {isNext && <span className="text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Next</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-medium text-rose-700">{teamName(m.team1_id)}{m.team1b_id ? ` + ${teamName(m.team1b_id)}` : ''}</span>
                                <span className="text-gray-400 mx-1.5">vs</span>
                                <span className="font-medium text-blue-700">{teamName(m.team2_id!)}{m.team2b_id ? ` + ${teamName(m.team2b_id)}` : ''}</span>
                              </td>
                              <td className="hidden sm:table-cell px-3 py-3 text-center">
                                {done ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">DONE</span>
                                ) : m.status === 'active' ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white animate-pulse">▶ ACTIVE</span>
                                ) : m.status === 'waiting' ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">⏳ WAITING</span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">PENDING</span>
                                )}
                              </td>
                              <td className="px-2 py-3 text-center font-mono font-bold text-gray-700 text-xs">
                                {r ? scoreLabel(r) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-2 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {!done && (
                                    <button onClick={() => setStatus(m.id, m.status === 'waiting' ? 'pending' : 'waiting')}
                                      className={`hidden sm:inline-flex px-2.5 py-2 rounded text-xs font-bold border transition-colors min-h-[36px] items-center ${m.status === 'waiting' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'border-gray-200 text-gray-400 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50'}`}>
                                      {m.status === 'waiting' ? '⏳' : 'Wait'}
                                    </button>
                                  )}
                                  <button onClick={() => router.push('/judges/d/record/' + m.id)}
                                    className="px-3 py-2 rounded text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors min-h-[36px]">
                                    {done ? 'Edit' : 'Record'}
                                  </button>
                                  {done && isAdmin && (
                                    <button onClick={() => replayMatch(m.id, m.match_id)}
                                      className="px-2.5 py-2 rounded text-xs font-bold border border-orange-200 text-orange-500 hover:bg-orange-50 transition-colors min-h-[36px]">
                                      ↩
                                    </button>
                                  )}
                                  {r && (
                                    <button onClick={() => setActiveMatch(isOpen ? null : m)}
                                      className={`hidden sm:inline-flex px-2.5 py-2 rounded text-xs font-bold border transition-colors min-h-[36px] items-center ${isOpen ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                      See
                                    </button>
                                  )}
                                  <button onClick={async () => { if (await confirm(`Delete ${m.match_id}?`)) deleteScheduledMatch(m.id) }}
                                    className="px-2 py-2 rounded text-xs text-red-300 hover:text-red-500 border border-transparent hover:border-red-200 transition-colors min-h-[36px]">✕</button>
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
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-wide">{activeMatch.match_id}</span>
                      <button onClick={() => setActiveMatch(null)} className="text-gray-300 hover:text-gray-600 text-sm leading-none">✕</button>
                    </div>
                    <div className="text-sm font-medium text-gray-800">
                      {teamName(activeMatch.team1_id)} <span className="text-gray-400">vs</span> {teamName(activeMatch.team2_id!)}
                    </div>
                    <div className="space-y-2">
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                        <div className="text-gray-400 font-bold uppercase mb-0.5">Score</div>
                        <div className="font-mono font-black text-2xl text-gray-900">{r.goals1} : {r.goals2}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                        <div className="text-gray-400 font-bold uppercase mb-0.5">Phase</div>
                        <div className="font-bold text-gray-900 capitalize">{r.match_phase}</div>
                      </div>
                      {r.notes && (
                        <div className="bg-amber-50 rounded-lg px-3 py-2 text-xs">
                          <div className="text-amber-600 font-bold uppercase mb-0.5">Notes</div>
                          <div className="text-amber-900">{r.notes}</div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => router.push('/judges/d/record/' + activeMatch.id)}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
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
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Add Team</h2>
              <div className="flex gap-2">
                <input value={tName} onChange={e => setTName(e.target.value)} placeholder="Team name"
                  onKeyDown={e => e.key === 'Enter' && addTeam()}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                <input value={tSchool} onChange={e => setTSchool(e.target.value)} placeholder="School"
                  onKeyDown={e => e.key === 'Enter' && addTeam()}
                  className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                <button onClick={addTeam} disabled={addingTeam || !tName.trim()}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-gray-700">
                  {addingTeam ? '…' : 'Add'}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {teams.length === 0
                ? <p className="text-center text-sm text-gray-300 py-10">No teams yet</p>
                : <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-5 py-3 w-8">#</th>
                    <th className="text-left px-4 py-3">Team</th>
                    <th className="text-left px-4 py-3">School</th>
                    <th className="text-center px-4 py-3">Goals</th>
                    <th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody>
                    {teams.map((t, i) => {
                      const goalsScored = matches.reduce((sum, m) => {
                        if (m.team1_id === t.id) return sum + m.goals1
                        if (m.team2_id === t.id) return sum + m.goals2
                        return sum
                      }, 0)
                      return (
                        <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-3 font-medium">{t.name}</td>
                          <td className="px-4 py-3 text-gray-400">{t.school || '—'}</td>
                          <td className="px-4 py-3 text-center font-bold text-gray-800">{goalsScored}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => deleteTeam(t.id)} className="text-xs text-red-300 hover:text-red-500">Del</button>
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
