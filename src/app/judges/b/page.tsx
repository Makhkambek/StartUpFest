'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import type { Team, MatchB } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'
import { StatsBar } from '@/components/judges/StatsBar'
import { RecentActivity, type RecentEntry } from '@/components/judges/RecentActivity'
import LiveControlsB from '@/components/judges/LiveControlsB'
import { useEventSettings } from '@/lib/use-event-settings'
import { useConfirm } from '@/components/judges/useConfirm'
import { ThemeToggle } from '@/components/judges/ThemeToggle'

type View = 'schedule' | 'teams'

export default function JudgeBPage() {
  const router = useRouter()
  const { cityName: eventCity } = useEventSettings('en')
  const [view, setView] = useState<View>('schedule')
  const [teams, setTeams] = useState<Team[]>([])
  const [schedule, setSchedule] = useState<ScheduledMatch[]>([])
  const [matches, setMatches] = useState<MatchB[]>([])
  const [loading, setLoading] = useState(true)
  const { confirm, modal } = useConfirm()
  const [isAdmin, setIsAdmin] = useState(false)
  const [canGenerate, setCanGenerate] = useState(false)

  const [tName, setTName] = useState(''); const [tSchool, setTSchool] = useState(''); const [addingTeam, setAddingTeam] = useState(false)
  const [smId, setSmId] = useState(''); const [smT1, setSmT1] = useState(''); const [smT2, setSmT2] = useState(''); const [addingSm, setAddingSm] = useState(false); const [smErr, setSmErr] = useState('')
  const [genN, setGenN] = useState('2'); const [generating, setGenerating] = useState(false); const [resetting, setResetting] = useState(false); const [genError, setGenError] = useState('')
  const [matchFilter, setMatchFilter] = useState<'all' | 'group' | 'quarter' | 'semi' | 'final'>('all')

  const [activeMatch, setActiveMatch] = useState<ScheduledMatch | null>(null)
  const [finalsVisible, setFinalsVisible] = useState(false)
  const [standbyMode, setStandbyMode] = useState(false)

  useEffect(() => {
    fetch('/api/judges/b/live').then(r => r.json()).then(s => {
      setFinalsVisible(s.finals_visible ?? false)
      setStandbyMode(s.standby_mode ?? false)
    })
  }, [])

  const toggleFinals = async () => {
    const res = await fetch('/api/judges/b/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'toggle_finals' }) })
    if (res.ok) { const s = await res.json(); setFinalsVisible(s.finals_visible ?? false) }
  }

  const toggleStandby = async () => {
    const res = await fetch('/api/judges/b/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'toggle_standby' }) })
    if (res.ok) { const s = await res.json(); setStandbyMode(s.standby_mode ?? false) }
  }

  const teamName = (id: string) => teams.find(t => t.id === id)?.name ?? id

  const load = useCallback(async () => {
    const [tr, sc, mr] = await Promise.all([
      fetch('/api/judges/b/teams', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/schedule?category=b', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/b/matches', { cache: 'no-store' }).then(r => r.json()),
    ])
    setTeams(Array.isArray(tr) ? tr : [])
    const sorted = (Array.isArray(sc) ? sc : []).sort((a: { match_id: string }, b: { match_id: string }) => {
      const na = parseInt(a.match_id.match(/(\d+)/)?.[1] ?? '0')
      const nb = parseInt(b.match_id.match(/(\d+)/)?.[1] ?? '0')
      if (na !== nb) return na - nb
      return a.match_id.localeCompare(b.match_id)
    })
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
    setGenerating(true); setGenError('')
    const res = await fetch('/api/judges/schedule/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'b', n }) })
    if (!res.ok) { const e = await res.json(); setGenError(e.error ?? 'Failed'); setGenerating(false); return }
    await load(); setGenerating(false)
  }

  const handleReset = async () => {
    if (!await confirm('Delete all scheduled matches AND clear all match results for this category? This cannot be undone.')) return
    setResetting(true)
    try {
      const resR = await fetch('/api/admin/reset-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'b' }) })
      if (!resR.ok) { const err = await resR.json().catch(() => null); alert(`Reset results failed (${resR.status}): ${err?.error ?? 'unknown'}`); return }
      const resS = await fetch('/api/judges/schedule', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'b', all: true }) })
      if (!resS.ok) { const err = await resS.json().catch(() => null); alert(`Reset schedule failed (${resS.status}): ${err?.error ?? 'unknown'}`); return }
      setMatches([]); setSchedule([])
      await load()
    } finally {
      setResetting(false)
    }
  }

  const [genFinalsErr, setGenFinalsErr] = useState('')
  const [genFinals, setGenFinals] = useState(false)
  const handleGenerateFinals = async () => {
    if (!await confirm('Generate SEMI-FINALS from current standings? Top 8 teams will be seeded into 4 R1 matches. Existing finals will be replaced.')) return
    setGenFinals(true); setGenFinalsErr('')
    const res = await fetch('/api/judges/schedule/finals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'b' }) })
    if (!res.ok) { const e = await res.json(); setGenFinalsErr(e.error ?? 'Failed'); setGenFinals(false); return }
    await load(); setGenFinals(false)
  }

  const [advancing, setAdvancing] = useState(false)
  const handleAdvance = async () => {
    if (!await confirm('Generate the NEXT finals round from winners of completed matches? You can edit/delete the generated matches afterwards.')) return
    setAdvancing(true); setGenFinalsErr('')
    const res = await fetch('/api/judges/schedule/advance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'b' }) })
    if (!res.ok) { const e = await res.json(); setGenFinalsErr(e.error ?? 'Failed'); setAdvancing(false); return }
    await load(); setAdvancing(false)
  }

  const [resettingSF, setResettingSF] = useState(false)
  const [resettingFinal, setResettingFinal] = useState(false)

  const handleResetRound = async (round: 'semi' | 'final') => {
    const label = round === 'semi' ? 'Semi-Finals R1+R2 (and Triangle Final)' : 'Triangle Final'
    if (!await confirm(`Delete all ${label} matches and their results? This cannot be undone.`)) return
    const setter = round === 'semi' ? setResettingSF : setResettingFinal
    setter(true); setGenFinalsErr('')
    const res = await fetch('/api/judges/schedule/finals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'b', round }),
    })
    if (!res.ok) { const e = await res.json(); setGenFinalsErr(e.error ?? 'Failed') }
    await load(); setter(false)
  }

  const resultFor = (m: ScheduledMatch) =>
    matches.find(r => r.scheduled_match_id === m.id) ??
    matches.find(r =>
      !r.scheduled_match_id &&
      ((r.team1_id === m.team1_id && r.team2_id === m.team2_id) ||
       (r.team1_id === m.team2_id && r.team2_id === m.team1_id))
    )

  const openDetail = (m: ScheduledMatch) => { setActiveMatch(m) }

  const addTeam = async () => {
    if (!tName.trim()) return
    setAddingTeam(true)
    await fetch('/api/judges/b/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: tName, school: tSchool, category: 'b' }) })
    setTName(''); setTSchool(''); await load(); setAddingTeam(false)
  }

  const deleteTeam = async (id: string) => {
    if (!await confirm('Delete team?')) return
    await fetch('/api/judges/b/teams', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
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
    const res = await fetch('/api/judges/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'b', match_id: matchId, team1_id: smT1, team2_id: smT2 }) })
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

  const winnerLabel = (r: MatchB) =>
    r.winner === 0 ? 'Draw' : r.winner === 1 ? teamName(r.team1_id) : teamName(r.team2_id)

  return (
    <>{modal}<div className="min-h-screen bg-gray-100 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 h-14 flex items-center px-3 sm:px-6 gap-4 sticky top-0 z-10">
        <a href="/judges/dashboard" className="text-sm text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200">← Dashboard</a>
        <span className="font-black text-sm text-gray-900 dark:text-zinc-100">🤼 Mini Sumo</span>
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
          <a href="/b" target="_blank" className="ml-2 text-xs text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 px-3 py-1.5 rounded border border-gray-200 dark:border-zinc-700">Public ↗</a>
          <ThemeToggle />
        </div>
      </header>

      <div className="p-3 sm:p-6 max-w-5xl mx-auto">
        {loading && <p className="text-sm text-gray-400 dark:text-zinc-400 py-8 text-center">Loading…</p>}

        {!loading && view === 'schedule' && (
          <div className="mb-4">
            <LiveControlsB schedule={schedule} teamName={(id) => id ? teamName(id) : '—'} onChange={load} />
          </div>
        )}

        {!loading && view === 'schedule' && schedule.length > 0 && (() => {
          const filtered = schedule.filter(m => {
            if (matchFilter === 'all') return true
            if (matchFilter === 'group') return m.phase !== 'finals'
            if (matchFilter === 'quarter') return m.round === 'quarter'
            if (matchFilter === 'semi') return m.phase === 'finals' && (m.round === 'semi' || m.round === 'r1' || m.round === 'r2')
            if (matchFilter === 'final') return m.phase === 'finals' && (m.round === 'final' || m.round === 'third_place' || m.round === 'triangle')
            return true
          })
          const sectionLabel: Record<typeof matchFilter, string> = {
            all: 'Matches', group: 'Group Stage', quarter: 'Quarter-Finals', semi: 'Semi-Finals', final: 'Finals'
          }
          return (
            <StatsBar
              done={filtered.filter(m => resultFor(m)).length}
              total={filtered.length}
              label={sectionLabel[matchFilter]}
            />
          )
        })()}

        {!loading && view === 'schedule' && (() => {
          const recent: RecentEntry[] = schedule
            .map(m => {
              const r = resultFor(m)
              if (!r) return null
              return {
                matchId: m.match_id,
                scheduleId: m.id,
                team: `${teamName(m.team1_id)} vs ${teamName(m.team2_id!)}`,
                result: winnerLabel(r),
                ts: r.created_at,
              }
            })
            .filter((x): x is RecentEntry => x !== null)
          return <RecentActivity category="b" entries={recent} />
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

              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">🏆 Finals Bracket</h2>
                  {schedule.filter(m => m.phase === 'finals').length > 0 && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">{schedule.filter(m => m.phase === 'finals').length} finals scheduled</span>
                  )}
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                  {teams.length >= 20
                    ? 'Top 12 from qualifications → R1 (6 matches) → R2 (3 matches) → Triangle Final.'
                    : 'Top 8 from qualifications → R1 (4 matches) → R2 (2 matches) → Final + 3rd Place.'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {/* Step 1: always visible — seed R1 from standings */}
                  {(() => {
                    const qualMatches = schedule.filter(m => m.phase !== 'finals')
                    const qualDone = qualMatches.length > 0 && qualMatches.every(m => !!resultFor(m))
                    return (
                      <button onClick={handleGenerateFinals} disabled={!isAdmin || genFinals || advancing || !qualDone}
                        title={!qualDone ? 'All qualification matches must be completed first' : !isAdmin ? 'Admin only' : ''}
                        className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-amber-700 transition-colors">
                        {genFinals ? 'Generating…' : 'Generate Semi-Finals'}
                      </button>
                    )
                  })()}
                  {/* Step 2: R1 → R2 */}
                  {schedule.some(m => m.phase === 'finals' && m.round === 'r1') && !schedule.some(m => m.phase === 'finals' && m.round === 'r2') && (
                    <button onClick={handleAdvance} disabled={!isAdmin || advancing || genFinals}
                      title={!isAdmin ? 'Admin only' : 'Generate R2 from R1 winners. You can edit/delete generated matches.'}
                      className="bg-white dark:bg-transparent border border-amber-600 text-amber-700 dark:text-amber-400 px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
                      {advancing ? 'Advancing…' : '→ Next Round'}
                    </button>
                  )}
                  {/* Step 3: R2 → Triangle Final */}
                  {schedule.some(m => m.phase === 'finals' && m.round === 'r2') && !schedule.some(m => m.phase === 'finals' && m.round === 'triangle') && (
                    <button onClick={handleAdvance} disabled={!isAdmin || advancing || genFinals}
                      title={!isAdmin ? 'Admin only' : 'Generate Triangle Final from R2 winners.'}
                      className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-amber-700 transition-colors">
                      {advancing ? 'Generating…' : 'Generate Finals'}
                    </button>
                  )}
                  {/* Reset buttons */}
                  {isAdmin && schedule.some(m => m.phase === 'finals') && (
                    <>
                      <button
                        onClick={() => handleResetRound('semi')}
                        disabled={resettingSF || resettingFinal}
                        title="Delete Semi-Finals R1+R2 and Triangle Final matches"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 transition-colors">
                        {resettingSF ? '…' : '↩ Reset Semis'}
                      </button>
                      {schedule.some(m => m.phase === 'finals' && m.round === 'triangle') && (
                        <button
                          onClick={() => handleResetRound('final')}
                          disabled={resettingFinal || resettingSF}
                          title="Delete Triangle Final matches and their results"
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 transition-colors">
                          {resettingFinal ? '…' : '↩ Reset Finals'}
                        </button>
                      )}
                    </>
                  )}
                </div>
                {genFinalsErr && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{genFinalsErr}</p>}
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
                <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide mb-3">Add Match to Schedule</h2>
                <div className="flex flex-wrap gap-2">
                  {isAdmin && (
                    <input value={smId} onChange={e => setSmId(e.target.value)} placeholder="Q-1"
                      onKeyDown={e => e.key === 'Enter' && addScheduledMatch()}
                      className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 rounded-lg px-3 py-2 text-sm w-28 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 uppercase" />
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

              {schedule.length > 0 && (() => {
                const hasR1 = schedule.some(m => m.phase === 'finals' && (m.round === 'r1' || m.round === 'r2'))
                const sfTabLabel = hasR1 ? 'Rounds 1 & 2' : 'Semi-Finals'
                const tabs: { key: typeof matchFilter; label: string; count: number }[] = [
                  { key: 'all', label: 'All', count: schedule.length },
                  { key: 'group', label: 'Group Stage', count: schedule.filter(m => m.phase !== 'finals').length },
                  { key: 'semi' as const, label: sfTabLabel, count: schedule.filter(m => m.phase === 'finals' && (m.round === 'semi' || m.round === 'r1' || m.round === 'r2')).length },
                  { key: 'final' as const, label: 'Finals', count: schedule.filter(m => m.phase === 'finals' && (m.round === 'final' || m.round === 'third_place' || m.round === 'triangle')).length },
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
                          <th className="text-center px-2 py-3 w-16">Result</th>
                          <th className="px-2 py-3 w-28"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {(() => {
                          const nextUpId = schedule.find(m => !resultFor(m))?.id

                          const sectionOf = (m: ScheduledMatch): string => {
                            if (m.phase !== 'finals') return 'Group Stage'
                            if (m.round === 'quarter') return 'Quarter-Finals'
                            if (m.round === 'semi') return 'Semi-Finals'
                            if (m.round === 'r1') return 'Round 1'
                            if (m.round === 'r2') return 'Round 2'
                            if (m.round === 'third_place') return '3rd Place'
                            if (m.round === 'final') return 'Final'
                            if (m.round === 'triangle') return 'Triangle Final'
                            return 'Finals'
                          }

                          const filtered = schedule.filter(m => {
                            if (matchFilter === 'all') return true
                            if (matchFilter === 'group') return m.phase !== 'finals'
                            if (matchFilter === 'quarter') return m.round === 'quarter'
                            if (matchFilter === 'semi') return m.phase === 'finals' && (m.round === 'semi' || m.round === 'r1' || m.round === 'r2')
                            if (matchFilter === 'final') return m.phase === 'finals' && (m.round === 'final' || m.round === 'third_place' || m.round === 'triangle')
                            return true
                          })
                          if (filtered.length === 0) return (
                            <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-300 dark:text-zinc-600">No matches yet</td></tr>
                          )
                          let lastSection = ''
                          return filtered.map(m => {
                          const section = sectionOf(m)
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
                                      section === 'Group Stage' ? 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400' :
                                      section === 'Final' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' :
                                      'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
                                    }`}>{section}</span>
                                  </td>
                                </tr>
                              )}
                            <tr onClick={() => { if (!done) router.push('/judges/b/record/' + m.id) }} className={`transition-colors ${!done ? 'cursor-pointer' : ''} hover:bg-gray-50 dark:hover:bg-zinc-800 ${isNext ? 'bg-blue-50/60 dark:bg-blue-950/30 border-l-4 border-l-blue-500' : isOpen ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
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
                              <td className="px-2 py-3 text-center text-xs font-bold text-gray-700 dark:text-zinc-300">
                                {r ? winnerLabel(r) : <span className="text-gray-300 dark:text-zinc-400">—</span>}
                              </td>
                              <td className="px-2 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {!done && (
                                    <button onClick={e => { e.stopPropagation(); setStatus(m.id, m.status === 'waiting' ? 'pending' : 'waiting') }}
                                      className={`hidden sm:inline-flex px-2.5 py-2 rounded text-xs font-bold border transition-colors min-h-[36px] items-center ${m.status === 'waiting' ? 'bg-orange-100 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900' : 'border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-400 hover:text-orange-600 hover:border-orange-200 dark:hover:border-orange-900 dark:border-orange-900 hover:bg-orange-50 dark:hover:bg-orange-950/30 dark:bg-orange-950/30'}`}>
                                      {m.status === 'waiting' ? '⏳' : 'Wait'}
                                    </button>
                                  )}
                                  {done && (
                                    <button onClick={e => { e.stopPropagation(); router.push('/judges/b/record/' + m.id) }}
                                      className="px-3 py-2 rounded text-xs font-bold border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors min-h-[36px]">
                                      Edit
                                    </button>
                                  )}
                                  {done && isAdmin && (
                                    <button onClick={e => { e.stopPropagation(); replayMatch(m.id, m.match_id) }}
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
                                  <button onClick={async e => { e.stopPropagation(); if (await confirm(`Delete ${m.match_id}?`)) deleteScheduledMatch(m.id) }}
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
                    <div className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                      {teamName(activeMatch.team1_id)} <span className="text-gray-400 dark:text-zinc-400 font-normal">vs</span> {teamName(activeMatch.team2_id!)}
                    </div>
                    {r ? (
                      <div className="space-y-3">
                        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                          <div className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase mb-1">Winner</div>
                          <div className="font-black text-gray-900 dark:text-zinc-100">{winnerLabel(r)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                            <div className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase mb-1">Rounds T1</div>
                            <div className="font-mono font-bold text-gray-900 dark:text-zinc-100 text-xl">{r.rounds1}</div>
                          </div>
                          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                            <div className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase mb-1">Rounds T2</div>
                            <div className="font-mono font-bold text-gray-900 dark:text-zinc-100 text-xl">{r.rounds2}</div>
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                          <div className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase mb-1">Starting Position</div>
                          <div className="font-bold text-gray-900 dark:text-zinc-100 capitalize">{r.starting_position}</div>
                        </div>
                        {r.notes && (
                          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                            <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">Judge Notes</div>
                            <div className="text-sm text-amber-900 dark:text-amber-200">{r.notes}</div>
                          </div>
                        )}
                        <button onClick={() => router.push('/judges/b/record/' + activeMatch.id)}
                          className="w-full py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                          Edit Result
                        </button>
                      </div>
                    ) : <p className="text-sm text-gray-400 dark:text-zinc-400">No result yet.</p>}
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {!loading && view === 'teams' && (
          <div className="space-y-4">
            {teams.length >= 2 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Auto-Assign Groups</h2>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">Randomly splits teams into 4 balanced groups (A–D)</p>
                  </div>
                  <button
                    onClick={async () => {
                      const hasGroups = teams.some(t => t.group_letter)
                      if (hasGroups && !isAdmin) { alert('Groups already assigned. Only admin can overwrite.'); return }
                      if (hasGroups && !await confirm(`Groups already exist. Overwrite all ${teams.length} teams?`)) return
                      const shuffled = [...teams].sort(() => Math.random() - 0.5)
                      const groupLetters = ['A', 'B', 'C', 'D']
                      await Promise.all(shuffled.map((t, i) =>
                        fetch('/api/judges/b/teams', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, group_letter: groupLetters[i % 4] }) })
                      ))
                      await load()
                    }}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                  >
                    Auto-assign
                  </button>
                </div>
              </div>
            )}
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
                    <th className="text-center px-3 py-3 w-20">Group</th>
                    <th className="text-center px-4 py-3">Pts</th>
                    <th className="text-center px-4 py-3 hidden sm:table-cell">W/D/L</th>
                    <th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody>
                    {teams.map((t, i) => {
                      const wins = matches.filter(m =>
                        (m.team1_id === t.id && m.winner === 1) || (m.team2_id === t.id && m.winner === 2)
                      ).length
                      const draws = matches.filter(m =>
                        (m.team1_id === t.id || m.team2_id === t.id) && m.winner === 0
                      ).length
                      const losses = matches.filter(m =>
                        (m.team1_id === t.id || m.team2_id === t.id)
                      ).length - wins - draws
                      const pts = wins * 3 + draws
                      return (
                        <tr key={t.id} className="border-b border-gray-50 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800">
                          <td className="px-5 py-3 text-gray-400 dark:text-zinc-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-3 font-medium dark:text-zinc-200">{t.name}</td>
                          <td className="px-4 py-3 text-gray-400 dark:text-zinc-400">{t.school || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <select
                              value={t.group_letter ?? ''}
                              disabled={!isAdmin}
                              onChange={async e => {
                                const g = e.target.value || null
                                await fetch(`/api/judges/b/teams`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, group_letter: g }) })
                                await load()
                              }}
                              className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded px-2 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50"
                            >
                              <option value="">—</option>
                              {['A', 'B', 'C', 'D'].map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-800 dark:text-zinc-200">{pts}</td>
                          <td className="px-4 py-3 text-center text-xs text-gray-500 dark:text-zinc-500 hidden sm:table-cell"><span className="text-green-600">{wins}</span>/<span className="text-amber-500">{draws}</span>/<span className="text-red-500">{losses}</span></td>
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
