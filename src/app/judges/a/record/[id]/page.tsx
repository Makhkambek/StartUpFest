'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Team, ResultA } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'

export default function RecordAPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [match, setMatch] = useState<ScheduledMatch | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  // form state
  const [run1, setRun1] = useState('')
  const [run2, setRun2] = useState('')
  const [pen1, setPen1] = useState(0)
  const [pen2, setPen2] = useState(0)
  const [penalty, setPenalty] = useState<ResultA['penalty']>('0')
  const [phase, setPhase] = useState<ResultA['run_phase']>('qualification')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [isEdit, setIsEdit] = useState(false)
  const [savedJustNow, setSavedJustNow] = useState(false)
  const [undoCountdown, setUndoCountdown] = useState(30)
  const [matchStatus, setMatchStatus] = useState<'pending' | 'active' | 'completed'>('pending')

  async function updateMatchStatus(status: 'pending' | 'active' | 'completed') {
    setMatchStatus(status)
    await fetch(`/api/judges/schedule/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  useEffect(() => {
    if (!savedJustNow) return
    if (undoCountdown <= 0) {
      router.push('/judges/a')
      router.refresh()
      return
    }
    const t = setTimeout(() => setUndoCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [savedJustNow, undoCountdown, router])

  const undo = async () => {
    await fetch('/api/judges/a/results', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_match_id: id }),
    })
    setSavedJustNow(false)
    setSaveMsg('Undone')
    setTimeout(() => setSaveMsg(''), 1200)
  }

  function addPenalty(run: 1 | 2, sec: number) {
    if (run === 1) {
      const current = parseFloat(run1 || '0') || 0
      setRun1((current + sec).toFixed(2))
      setPen1(p => p + sec)
    } else {
      const current = parseFloat(run2 || '0') || 0
      setRun2((current + sec).toFixed(2))
      setPen2(p => p + sec)
    }
    // auto-update penalty class to highest tier
    const total = (run === 1 ? pen1 : pen2) + sec
    if (total >= 40) setPenalty('40')
    else if (total >= 20) setPenalty('20')
  }

  function resetPenalty(run: 1 | 2) {
    if (run === 1) {
      const current = parseFloat(run1 || '0') || 0
      setRun1((Math.max(0, current - pen1)).toFixed(2))
      setPen1(0)
    } else {
      const current = parseFloat(run2 || '0') || 0
      setRun2((Math.max(0, current - pen2)).toFixed(2))
      setPen2(0)
    }
    if (pen1 === 0 && pen2 === 0) setPenalty('0')
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/judges/schedule/${id}`, { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/a/teams', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/a/results', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([m, t, results]) => {
      setMatch(m)
      if (m?.status) setMatchStatus(m.status)
      setTeams(Array.isArray(t) ? t : [])
      const ex = Array.isArray(results) ? results.find((r: ResultA) => r.scheduled_match_id === id) : null
      if (ex) {
        setIsEdit(true)
        setRun1(ex.run1 !== null ? String(ex.run1) : '')
        setRun2(ex.run2 !== null ? String(ex.run2) : '')
        setPenalty(ex.penalty)
        setPhase(ex.run_phase ?? 'qualification')
        setNotes(ex.notes ?? '')
      }
      setLoading(false)
    })
  }, [id])

  const teamName = (tid: string) => teams.find(t => t.id === tid)?.name ?? tid

  const save = async () => {
    if (!match) return
    setSaving(true); setSaveMsg('')
    const res = await fetch('/api/judges/a/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_match_id: id,
        team_id: match.team1_id,
        run1: run1 ? parseFloat(run1) : null,
        run2: run2 ? parseFloat(run2) : null,
        penalty,
        run_phase: phase,
        notes: notes || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaveMsg('Saved!')
      toast.success('Result saved')
      setSavedJustNow(true)
      setUndoCountdown(30)
      void updateMatchStatus('completed')
    } else {
      const e = await res.json()
      setSaveMsg(e.error ?? 'Error')
      toast.error(e.error ?? 'Failed to save')
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 flex items-center justify-center"><p className="text-gray-400 dark:text-zinc-400 text-sm">Loading…</p></div>
  if (!match) return <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 flex items-center justify-center"><p className="text-red-400 text-sm">Match not found</p></div>

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 h-14 flex items-center px-3 sm:px-6 gap-4 sticky top-0 z-10">
        <button onClick={() => router.push('/judges/a')} className="text-sm text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200">← Back</button>
        <span className="font-black text-sm text-gray-900 dark:text-zinc-100">🏎️ Line Follower</span>
        <span className="font-black font-mono text-xl text-gray-900 dark:text-zinc-100 ml-1">{match.match_id}</span>
        {isEdit && <span className="text-xs text-white bg-amber-600 px-2.5 py-0.5 rounded-full font-bold animate-pulse">✏️ EDITING — Result already saved</span>}
      </header>

      <div className="p-3 sm:p-6 max-w-lg mx-auto space-y-4">
        {isEdit && (
          <div className="bg-amber-100 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 rounded-xl px-4 py-3">
            <div className="text-sm font-bold text-amber-900">This match already has a saved result.</div>
            <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Changes will overwrite the existing record. To leave it unchanged, click Back.</div>
          </div>
        )}
        {/* Team info */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-3xl font-black font-mono text-gray-900 dark:text-zinc-100">{match.match_id}</div>
              <div className="text-xl font-semibold text-gray-700 dark:text-zinc-300 mt-1">{teamName(match.team1_id)}</div>
            </div>
            <div className="flex flex-col gap-1.5">
              {matchStatus === 'pending' && (
                <button onClick={() => updateMatchStatus('active')}
                  className="bg-blue-600 text-white text-xs font-black px-3 py-2 rounded-lg hover:bg-blue-700">
                  ▶ Start Match
                </button>
              )}
              {matchStatus === 'active' && (
                <span className="bg-blue-600 text-white text-xs font-black px-3 py-2 rounded-lg animate-pulse text-center">
                  ▶ LIVE
                </span>
              )}
              {matchStatus === 'completed' && (
                <span className="bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 text-xs font-black px-3 py-2 rounded-lg text-center">
                  ✓ Completed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5 space-y-5">
          {/* Phase */}
          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide block mb-2">Phase</label>
            <div className="flex gap-2">
              {(['qualification', 'final'] as const).map(p => (
                <button key={p} onClick={() => setPhase(p)}
                  className={`flex-1 py-3 rounded-lg text-sm font-bold border transition-colors ${phase === p ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-gray-900 dark:border-gray-100' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}>
                  {p === 'qualification' ? 'Qualification' : 'Final'}
                </button>
              ))}
            </div>
          </div>

          {/* Penalty */}
          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide block mb-2">Penalty</label>
            <div className="flex gap-2 flex-wrap">
              {(['0', '20', '40', 'dnf', 'disq'] as const).map(p => (
                <button key={p} onClick={() => setPenalty(p)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${penalty === p
                    ? p === 'disq' ? 'bg-red-600 text-white border-red-600'
                      : p === 'dnf' ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}>
                  {p === '0' ? '+0s' : p === '20' ? '+20s' : p === '40' ? '+40s' : p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Runs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide block mb-2">Run 1 (s)</label>
              <input type="number" step="0.01" value={run1} onChange={e => { setRun1(e.target.value); setPen1(0) }}
                placeholder="12.34"
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 rounded-lg px-4 py-3 text-base text-xl font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button type="button" onClick={() => addPenalty(1, 20)}
                  className="flex-1 py-2 rounded-md text-xs font-bold border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 dark:bg-amber-950/30 hover:border-amber-300 dark:border-amber-800 active:bg-amber-100">
                  +20s
                </button>
                <button type="button" onClick={() => addPenalty(1, 40)}
                  className="flex-1 py-2 rounded-md text-xs font-bold border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 dark:bg-amber-950/30 hover:border-amber-300 dark:border-amber-800 active:bg-amber-100">
                  +40s
                </button>
                <button type="button" onClick={() => resetPenalty(1)} disabled={pen1 === 0}
                  className="px-2 py-2 rounded-md text-xs font-bold border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30">
                  ↻
                </button>
              </div>
              {pen1 > 0 && (
                <div className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mt-1.5">Penalty applied: +{pen1}s</div>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide block mb-2">Run 2 (s)</label>
              <input type="number" step="0.01" value={run2} onChange={e => { setRun2(e.target.value); setPen2(0) }}
                placeholder="11.80"
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 rounded-lg px-4 py-3 text-base text-xl font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button type="button" onClick={() => addPenalty(2, 20)}
                  className="flex-1 py-2 rounded-md text-xs font-bold border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 dark:bg-amber-950/30 hover:border-amber-300 dark:border-amber-800 active:bg-amber-100">
                  +20s
                </button>
                <button type="button" onClick={() => addPenalty(2, 40)}
                  className="flex-1 py-2 rounded-md text-xs font-bold border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 dark:bg-amber-950/30 hover:border-amber-300 dark:border-amber-800 active:bg-amber-100">
                  +40s
                </button>
                <button type="button" onClick={() => resetPenalty(2)} disabled={pen2 === 0}
                  className="px-2 py-2 rounded-md text-xs font-bold border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30">
                  ↻
                </button>
              </div>
              {pen2 > 0 && (
                <div className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mt-1.5">Penalty applied: +{pen2}s</div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide block mb-2">
              Judge Notes <span className="text-gray-300 dark:text-zinc-400 font-normal">(not public)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Restart, sensor miss, course fault…"
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 rounded-lg px-4 py-3 text-base text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
          </div>

          {/* Save / Undo */}
          {savedJustNow ? (
            <div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-200 dark:border-green-900 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-green-800 dark:text-green-300">✓ Result saved</span>
                <span className="text-xs text-gray-500 dark:text-zinc-400 font-mono">Auto-close in {undoCountdown}s</span>
              </div>
              <div className="flex gap-2">
                <button onClick={undo}
                  className="flex-1 bg-white dark:bg-zinc-900 border-2 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 py-3 rounded-lg text-sm font-bold hover:bg-red-50 dark:hover:bg-red-950/30 dark:bg-red-950/30">
                  ↩ Undo
                </button>
                <button onClick={() => { router.push('/judges/a'); router.refresh() }}
                  className="flex-1 bg-gray-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-gray-700">
                  Done →
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 pt-1">
              <button onClick={save} disabled={saving}
                className="flex-1 bg-gray-900 text-white py-3.5 min-h-[48px] rounded-xl text-base font-black disabled:opacity-40 hover:bg-gray-700 transition-colors">
                {saving ? 'Saving…' : isEdit ? 'Update Result' : 'Save Result'}
              </button>
              {saveMsg && <span className={`text-sm font-bold ${saveMsg === 'Saved!' || saveMsg === 'Undone' ? 'text-green-600' : 'text-red-500 dark:text-red-400'}`}>{saveMsg}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
