'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Team, FightC } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'
import { MatchTimer } from '@/components/judges/MatchTimer'

export default function RecordCPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [match, setMatch] = useState<ScheduledMatch | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  // form state
  const [method, setMethod] = useState<FightC['method']>('KO')
  const [winner, setWinner] = useState<1 | 2 | 0>(1)
  const [score1, setScore1] = useState('')
  const [score2, setScore2] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [isEdit, setIsEdit] = useState(false)
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null)
  const [savedJustNow, setSavedJustNow] = useState(false)
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null)
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
      router.push('/judges/c')
      router.refresh()
      return
    }
    const t = setTimeout(() => setUndoCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [savedJustNow, undoCountdown, router])

  const undo = async () => {
    if (!savedRecordId) return
    await fetch('/api/judges/c/fights', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: savedRecordId }),
    })
    setSavedJustNow(false)
    setSavedRecordId(null)
    setSaveMsg('Undone')
    setTimeout(() => setSaveMsg(''), 1200)
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/judges/schedule/${id}`, { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/c/teams', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/c/fights', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([m, t, results]) => {
      setMatch(m)
      if (m?.status) setMatchStatus(m.status)
      setTeams(Array.isArray(t) ? t : [])
      const ex = Array.isArray(results)
        ? (results.find((r: FightC) => r.scheduled_match_id === id) ??
           results.find((r: FightC) =>
             !r.scheduled_match_id &&
             ((r.team1_id === m.team1_id && r.team2_id === m.team2_id) ||
              (r.team1_id === m.team2_id && r.team2_id === m.team1_id))
           ))
        : null
      if (ex) {
        setIsEdit(true)
        setExistingRecordId(ex.id ?? null)
        setMethod(ex.method)
        setWinner(ex.winner)
        setScore1(String(ex.judge_score1))
        setScore2(String(ex.judge_score2))
        setNotes(ex.notes ?? '')
      }
      setLoading(false)
    })
  }, [id])

  const teamName = (tid: string) => teams.find(t => t.id === tid)?.name ?? tid

  const save = async () => {
    if (!match) return
    setSaving(true); setSaveMsg('')
    if (existingRecordId) {
      await fetch('/api/judges/c/fights', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existingRecordId }),
      })
      setExistingRecordId(null)
    }
    const res = await fetch('/api/judges/c/fights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team1_id: match.team1_id,
        team2_id: match.team2_id,
        method,
        winner,
        judge_score1: score1 ? parseInt(score1) : 0,
        judge_score2: score2 ? parseInt(score2) : 0,
        notes: notes || null,
        scheduled_match_id: id,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const saved = await res.json()
      setSavedRecordId(saved?.id ?? null)
      setSaveMsg('Saved!')
      setSavedJustNow(true)
      setUndoCountdown(30)
      void updateMatchStatus('completed')
    } else {
      const e = await res.json()
      setSaveMsg(e.error ?? 'Error')
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 flex items-center justify-center"><p className="text-gray-400 dark:text-zinc-400 text-sm">Loading…</p></div>
  if (!match) return <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 flex items-center justify-center"><p className="text-red-400 text-sm">Match not found</p></div>

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 h-14 flex items-center px-3 sm:px-6 gap-4 sticky top-0 z-10">
        <button onClick={() => router.push('/judges/c')} className="text-sm text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200">← Back</button>
        <span className="font-black text-sm text-gray-900 dark:text-zinc-100">⚔️ MiniRobowar</span>
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
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-3xl font-black font-mono text-gray-900 dark:text-zinc-100">{match.match_id}</div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xl font-semibold text-gray-700 dark:text-zinc-300">{teamName(match.team1_id)}</span>
                <span className="text-gray-300 dark:text-zinc-400 font-bold">vs</span>
                <span className="text-xl font-semibold text-gray-700 dark:text-zinc-300">{match.team2_id ? teamName(match.team2_id) : '—'}</span>
              </div>
            </div>
            <div className="shrink-0">
              {matchStatus === 'pending' && (
                <button onClick={() => updateMatchStatus('active')}
                  className="bg-blue-600 text-white text-xs font-black px-3 py-2 rounded-lg hover:bg-blue-700">
                  ▶ Start
                </button>
              )}
              {matchStatus === 'active' && (
                <span className="bg-blue-600 text-white text-xs font-black px-3 py-2 rounded-lg animate-pulse inline-block">
                  ▶ LIVE
                </span>
              )}
              {matchStatus === 'completed' && (
                <span className="bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 text-xs font-black px-3 py-2 rounded-lg inline-block">
                  ✓ Done
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Timer (3 min fight — rulebook §5.2) */}
        <MatchTimer duration={180} />


        {/* Form */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5 space-y-5">
          {/* Method */}
          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide block mb-2">Decision Method</label>
            <div className="flex gap-2 flex-wrap">
              {([
                { value: 'KO',   label: 'KO' },
                { value: 'IMM',  label: 'Immobilization' },
                { value: 'JD',   label: 'Judge Decision' },
                { value: 'DRAW', label: 'Draw' },
              ] as const).map(m => (
                <button key={m.value} onClick={() => {
                  setMethod(m.value)
                  if (m.value === 'DRAW') setWinner(0)
                  else if (winner === 0) setWinner(1)
                }}
                  className={`flex-1 py-3 rounded-lg text-sm font-bold border transition-colors ${method === m.value
                    ? m.value === 'DRAW' ? 'bg-gray-500 text-white border-gray-500'
                    : 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Winner */}
          {method !== 'DRAW' && (
          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide block mb-2">Winner</label>
            <div className="flex gap-2">
              <button onClick={() => setWinner(1)}
                className={`flex-1 py-3 rounded-lg text-sm font-bold border transition-colors ${winner === 1 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}>
                {teamName(match.team1_id)}
              </button>
              <button onClick={() => setWinner(2)}
                className={`flex-1 py-3 rounded-lg text-sm font-bold border transition-colors ${winner === 2 ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}>
                {match.team2_id ? teamName(match.team2_id) : 'Team 2'}
              </button>
            </div>
          </div>
          )}

          {/* Judge Scores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide block mb-2">Score — {teamName(match.team1_id)}</label>
              <input type="number" min="0" step="1" value={score1} onChange={e => setScore1(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-4 py-3 text-base text-xl font-mono focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 dark:placeholder-zinc-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide block mb-2">Score — {match.team2_id ? teamName(match.team2_id) : 'Team 2'}</label>
              <input type="number" min="0" step="1" value={score2} onChange={e => setScore2(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-4 py-3 text-base text-xl font-mono focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 dark:placeholder-zinc-500" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide block mb-2">
              Judge Notes <span className="text-gray-300 dark:text-zinc-400 font-normal">(not public)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="KO details, illegal move, restart…"
              className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-4 py-3 text-base text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 dark:placeholder-zinc-500" />
          </div>

          {/* Save / Undo */}
          {savedJustNow ? (
            <div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-200 dark:border-green-900 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-green-800 dark:text-green-300">✓ Result saved</span>
                <span className="text-xs text-gray-500 dark:text-zinc-400 font-mono">Auto-close in {undoCountdown}s</span>
              </div>
              <div className="flex gap-2">
                <button onClick={undo} disabled={!savedRecordId}
                  className="flex-1 bg-white dark:bg-zinc-800 border-2 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 py-3 rounded-lg text-sm font-bold hover:bg-red-50 dark:hover:bg-red-950/30 dark:bg-red-950/30 disabled:opacity-40">
                  ↩ Undo
                </button>
                <button onClick={() => { router.push('/judges/c'); router.refresh() }}
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
