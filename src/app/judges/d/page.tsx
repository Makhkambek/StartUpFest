'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Team, MatchD } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'
import { StatsBar } from '@/components/judges/StatsBar'
import { RecentActivity, type RecentEntry } from '@/components/judges/RecentActivity'

type View = 'schedule' | 'teams'

export default function JudgeDPage() {
  const router = useRouter()
  const [view, setView] = useState<View>('schedule')
  const [teams, setTeams] = useState<Team[]>([])
  const [schedule, setSchedule] = useState<ScheduledMatch[]>([])
  const [matches, setMatches] = useState<MatchD[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const [tName, setTName] = useState(''); const [tSchool, setTSchool] = useState(''); const [addingTeam, setAddingTeam] = useState(false)
  const [smId, setSmId] = useState(''); const [smT1, setSmT1] = useState(''); const [smT2, setSmT2] = useState(''); const [addingSm, setAddingSm] = useState(false); const [smErr, setSmErr] = useState('')
  const [genN, setGenN] = useState('2'); const [generating, setGenerating] = useState(false); const [resetting, setResetting] = useState(false); const [genError, setGenError] = useState('')

  const [activeMatch, setActiveMatch] = useState<ScheduledMatch | null>(null)

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
    fetch('/api/auth/me').then(r => r.json()).then(s => { if (s?.role === 'admin') setIsAdmin(true) })
  }, [load])

  const handleGenerate = async () => {
    setGenerating(true); setGenError('')
    const res = await fetch('/api/judges/schedule/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'd', n: parseInt(genN) || 2 }) })
    if (!res.ok) { const e = await res.json(); setGenError(e.error ?? 'Failed'); setGenerating(false); return }
    await load(); setGenerating(false)
  }

  const [genFinalsErr, setGenFinalsErr] = useState('')
  const [genFinals, setGenFinals] = useState(false)
  const handleGenerateFinals = async () => {
    if (!confirm('Generate FINALS bracket from current standings? Existing finals will be replaced.')) return
    setGenFinals(true); setGenFinalsErr('')
    const res = await fetch('/api/judges/schedule/finals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'd' }) })
    if (!res.ok) { const e = await res.json(); setGenFinalsErr(e.error ?? 'Failed'); setGenFinals(false); return }
    await load(); setGenFinals(false)
  }

  const handleReset = async () => {
    if (!confirm('Delete all scheduled matches for this category? This cannot be undone.')) return
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
    if (!confirm('Delete team?')) return
    await fetch('/api/judges/d/teams', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  const addScheduledMatch = async () => {
    if (!smId.trim() || !smT1 || !smT2) { setSmErr('Fill all fields'); return }
    if (smT1 === smT2) { setSmErr('Teams must differ'); return }
    setAddingSm(true); setSmErr('')
    const res = await fetch('/api/judges/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'd', match_id: smId.toUpperCase(), team1_id: smT1, team2_id: smT2 }) })
    if (!res.ok) { const e = await res.json(); setSmErr(e.error); setAddingSm(false); return }
    setSmId(''); setSmT1(''); setSmT2(''); await load(); setAddingSm(false)
  }

  const deleteScheduledMatch = async (id: string) => {
    await fetch('/api/judges/schedule', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  const setStatus = async (id: string, status: ScheduledMatch['status']) => {
    await fetch(`/api/judges/schedule/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setSchedule(prev => prev.map(m => m.id === id ? { ...m, status } : m))
  }

  const scoreLabel = (r: MatchD) => `${r.goals1} : ${r.goals2}`

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 h-14 flex items-center px-6 gap-4 sticky top-0 z-10">
        <a href="/judges/dashboard" className="text-sm text-gray-400 hover:text-gray-700">← Dashboard</a>
        <span className="font-black text-sm text-gray-900">⚽ Robo Football</span>
        <div className="ml-auto flex gap-1">
          {(['schedule', 'teams'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
              {v === 'schedule' ? 'Matches' : 'Teams'}
            </button>
          ))}
          <a href="/d" target="_blank" className="ml-2 text-xs text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200">Public ↗</a>
        </div>
      </header>

      <div className="p-6 max-w-5xl mx-auto">
        {loading && <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>}

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
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-3">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Generate Schedule</h2>
                  {schedule.length > 0 && <span className="text-xs text-gray-400">{schedule.length} match{schedule.length !== 1 ? 'es' : ''} scheduled</span>}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">Matches per team:</span>
                  <input type="number" min="1" max="20" value={genN} onChange={e => setGenN(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-16 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  <button onClick={handleGenerate} disabled={!isAdmin || generating || teams.length < 2}
                    title={!isAdmin ? 'Admin only' : teams.length < 2 ? 'Add teams first' : ''}
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
                  {!isAdmin && <span className="text-xs text-gray-400">Admin only</span>}
                  {teams.length < 2 && isAdmin && <span className="text-xs text-amber-500">Add teams first</span>}
                </div>
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
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={handleGenerateFinals} disabled={!isAdmin || genFinals}
                    title={!isAdmin ? 'Admin only' : ''}
                    className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-amber-700 transition-colors">
                    {genFinals ? 'Generating…' : 'Generate Finals'}
                  </button>
                </div>
                {genFinalsErr && <p className="text-xs text-red-500 mt-2">{genFinalsErr}</p>}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Add Match to Schedule</h2>
                <div className="flex gap-2">
                  <input value={smId} onChange={e => setSmId(e.target.value)} placeholder="G-1"
                    onKeyDown={e => e.key === 'Enter' && addScheduledMatch()}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 uppercase" />
                  <select value={smT1} onChange={e => setSmT1(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                    <option value="">Team 1…</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={smT2} onChange={e => setSmT2(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                    <option value="">Team 2…</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button onClick={addScheduledMatch} disabled={addingSm}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-gray-700">
                    {addingSm ? '…' : '+'}
                  </button>
                </div>
                {smErr && <p className="text-xs text-red-500 mt-2">{smErr}</p>}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {schedule.length === 0
                  ? <p className="text-center text-sm text-gray-300 py-10">No matches scheduled yet</p>
                  : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                          <th className="text-left px-4 py-3 w-20">Match</th>
                          <th className="text-left px-4 py-3">Teams</th>
                          <th className="text-center px-3 py-3 w-20">Status</th>
                          <th className="text-center px-3 py-3 w-20">Score</th>
                          <th className="px-4 py-3 w-36"></th>
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
                                <span className="font-medium text-gray-800">{teamName(m.team1_id)}</span>
                                <span className="text-gray-400 mx-1.5">vs</span>
                                <span className="font-medium text-gray-800">{teamName(m.team2_id!)}</span>
                              </td>
                              <td className="px-3 py-3 text-center">
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
                              <td className="px-3 py-3 text-center font-mono font-bold text-gray-700 text-xs">
                                {r ? scoreLabel(r) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {!done && (
                                    <button onClick={() => setStatus(m.id, m.status === 'waiting' ? 'pending' : 'waiting')}
                                      className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${m.status === 'waiting' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'border-gray-200 text-gray-400 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50'}`}>
                                      {m.status === 'waiting' ? '⏳' : 'Wait'}
                                    </button>
                                  )}
                                  <button onClick={() => router.push('/judges/d/record/' + m.id)}
                                    className="px-2.5 py-1 rounded text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                                    {done ? 'Edit' : 'Record'}
                                  </button>
                                  {r && (
                                    <button onClick={() => setActiveMatch(isOpen ? null : m)}
                                      className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${isOpen ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                      See
                                    </button>
                                  )}
                                  <button onClick={() => { if (confirm(`Delete ${m.match_id}?`)) deleteScheduledMatch(m.id) }}
                                    className="px-2 py-1 rounded text-xs text-red-300 hover:text-red-500 border border-transparent hover:border-red-200 transition-colors">✕</button>
                                </div>
                              </td>
                            </tr>
                          )
                          })
                        })()}
                      </tbody>
                    </table>
                  )}
              </div>
            </div>
            <div className="w-72 shrink-0 sticky top-16 self-start">
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
    </div>
  )
}
