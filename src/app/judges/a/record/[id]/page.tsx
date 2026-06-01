'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Team, ResultA, PenaltyA } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'

// Penalty seconds that are valid per the rulebook:
//   +10s — off-track return >3s OR participant touched robot (can stack twice → +20s)
//   +40s — beam not crossed in 30s
//   +50s — beam not crossed + one +10s event
// dnf / disq — special statuses
const PENALTY_SEC: Record<string, number> = {
  '0': 0, '10': 10, '20': 20, '40': 40, '50': 50,
}

function penaltyFromSec(sec: number): PenaltyA {
  if (sec === 10) return '10'
  if (sec === 20) return '20'
  if (sec === 40) return '40'
  if (sec >= 50) return '50'
  return '0'
}

export default function RecordAPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [match, setMatch] = useState<ScheduledMatch | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  // Raw laser time entered by judge (no penalties baked in)
  const [rawTime, setRawTime] = useState('')
  // Accumulated penalty seconds from buttons
  const [penSec, setPenSec] = useState(0)
  // The final penalty classification — auto-derived from penSec, or dnf/disq
  const [penalty, setPenalty] = useState<PenaltyA>('0')
  const phase: ResultA['run_phase'] = 'qualification'
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [isEdit, setIsEdit] = useState(false)
  const [savedJustNow, setSavedJustNow] = useState(false)
  const [undoCountdown, setUndoCountdown] = useState(30)
  const [matchStatus, setMatchStatus] = useState<'pending' | 'active' | 'completed'>('pending')

  const isDnfDisq = penalty === 'dnf' || penalty === 'disq'

  // Derived total for display
  const computedTotal = (): number | null => {
    if (isDnfDisq) return null
    const raw = parseFloat(rawTime)
    if (!rawTime || isNaN(raw)) return null
    return raw + penSec
  }

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

  function addPenSec(sec: number) {
    if (isDnfDisq) return
    const next = penSec + sec
    setPenSec(next)
    setPenalty(penaltyFromSec(next))
  }

  function resetPen() {
    setPenSec(0)
    setPenalty('0')
  }

  function setSpecialPenalty(p: 'dnf' | 'disq') {
    setPenalty(p)
    setPenSec(0)
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
        // Restore raw time: subtract penalty from stored run1 if possible
        const storedPenSec = ex.penalty in PENALTY_SEC ? PENALTY_SEC[ex.penalty] : 0
        if (ex.run1 !== null) {
          setRawTime((ex.run1 - storedPenSec).toFixed(2))
          setPenSec(storedPenSec)
        }
        setPenalty(ex.penalty)
        setNotes(ex.notes ?? '')
      }
      setLoading(false)
    })
  }, [id])

  const teamName = (tid: string) => teams.find(t => t.id === tid)?.name ?? tid

  const save = async () => {
    if (!match) return
    setSaving(true); setSaveMsg('')

    // run1 = raw laser time (no penalties); API adds penaltySec
    const rawVal = rawTime ? parseFloat(rawTime) : null

    const res = await fetch('/api/judges/a/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_match_id: id,
        team_id: match.team1_id,
        run1: rawVal,
        run2: null,
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

  const total = computedTotal()

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

          {/* Laser time */}
          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide block mb-2">
              Laser time (s) <span className="font-normal text-gray-300 dark:text-zinc-500">— raw time from gate</span>
            </label>
            <input
              type="number" step="0.01" value={rawTime}
              onChange={e => setRawTime(e.target.value)}
              placeholder="23.45"
              disabled={isDnfDisq}
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 rounded-lg px-4 py-3 text-xl font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-40"
            />
          </div>

          {/* Penalties */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide">
                Penalty <span className="font-normal text-gray-300 dark:text-zinc-500">— add per event</span>
              </label>
              {penSec > 0 && (
                <button onClick={resetPen} className="text-xs text-red-500 dark:text-red-400 font-bold hover:underline">
                  Reset +{penSec}s
                </button>
              )}
            </div>

            {/* +10 / +40 buttons */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => addPenSec(10)}
                disabled={isDnfDisq}
                className="flex-1 py-3 rounded-lg text-sm font-bold border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 disabled:opacity-30 transition-colors">
                +10s
                <div className="text-[10px] font-normal mt-0.5 opacity-70">off-track / touch</div>
              </button>
              <button
                type="button"
                onClick={() => addPenSec(40)}
                disabled={isDnfDisq}
                className="flex-1 py-3 rounded-lg text-sm font-bold border border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 disabled:opacity-30 transition-colors">
                +40s
                <div className="text-[10px] font-normal mt-0.5 opacity-70">beam not crossed</div>
              </button>
            </div>

            {/* DNF / DISQ */}
            <div className="flex gap-2">
              {(['dnf', 'disq'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { if (penalty === p) { resetPen(); setPenalty('0') } else { setSpecialPenalty(p) } }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-colors ${penalty === p
                    ? p === 'disq'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-orange-500 text-white border-orange-500'
                    : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                  }`}>
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Total preview */}
          <div className={`rounded-xl px-4 py-3 border-2 ${isDnfDisq
            ? penalty === 'disq' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900'
            : 'bg-gray-50 dark:bg-zinc-800 border-gray-100 dark:border-zinc-700'
          }`}>
            {isDnfDisq ? (
              <div className="text-sm font-bold text-center text-gray-600 dark:text-zinc-400">
                {penalty === 'dnf' ? 'Did Not Finish — no time recorded' : 'Disqualified — attempt cancelled'}
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm font-mono">
                <span className="text-gray-500 dark:text-zinc-400">
                  {rawTime || '–'}{penSec > 0 ? ` + ${penSec}s` : ''}
                </span>
                <span className="text-lg font-black text-gray-900 dark:text-zinc-100">
                  {total !== null ? `${total.toFixed(2)}s` : '–'}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wide block mb-2">
              Judge Notes <span className="text-gray-300 dark:text-zinc-400 font-normal">(not public)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Restart, sensor miss, course fault…"
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
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
