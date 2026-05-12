'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Team, MatchB, StartingPosition } from '@/types/database'
import type { ScheduledMatch } from '@/lib/schedule-store'

export default function RecordBPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [match, setMatch] = useState<ScheduledMatch | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  // form state
  const [winner, setWinner] = useState<0 | 1 | 2>(1)
  const [rounds1, setRounds1] = useState('')
  const [rounds2, setRounds2] = useState('')
  const [startingPosition, setStartingPosition] = useState<StartingPosition>('face')
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
      router.push('/judges/b')
      router.refresh()
      return
    }
    const t = setTimeout(() => setUndoCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [savedJustNow, undoCountdown, router])

  const undo = async () => {
    if (!savedRecordId) return
    await fetch('/api/judges/b/matches', {
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
      fetch('/api/judges/b/teams', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/judges/b/matches', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([m, t, results]) => {
      setMatch(m)
      if (m?.status) setMatchStatus(m.status)
      setTeams(Array.isArray(t) ? t : [])
      const ex = Array.isArray(results)
        ? results.find((r: MatchB) =>
            (r.team1_id === m.team1_id && r.team2_id === m.team2_id) ||
            (r.team1_id === m.team2_id && r.team2_id === m.team1_id)
          )
        : null
      if (ex) {
        setIsEdit(true)
        setExistingRecordId(ex.id ?? null)
        setWinner(ex.winner)
        setRounds1(String(ex.rounds1))
        setRounds2(String(ex.rounds2))
        setStartingPosition(ex.starting_position)
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
      await fetch('/api/judges/b/matches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existingRecordId }),
      })
      setExistingRecordId(null)
    }
    const res = await fetch('/api/judges/b/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team1_id: match.team1_id,
        team2_id: match.team2_id,
        winner,
        rounds1: rounds1 ? parseInt(rounds1) : 0,
        rounds2: rounds2 ? parseInt(rounds2) : 0,
        starting_position: startingPosition,
        notes: notes || null,
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

  if (loading) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-400 text-sm">Loading…</p></div>
  if (!match) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-red-400 text-sm">Match not found</p></div>

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 h-14 flex items-center px-6 gap-4 sticky top-0 z-10">
        <button onClick={() => router.push('/judges/b')} className="text-sm text-gray-400 hover:text-gray-700">← Back</button>
        <span className="font-black text-sm text-gray-900">🤖 Mini Sumo</span>
        <span className="font-black font-mono text-xl text-gray-900 ml-1">{match.match_id}</span>
        {isEdit && <span className="text-xs text-white bg-amber-600 px-2.5 py-0.5 rounded-full font-bold animate-pulse">✏️ EDITING — Result already saved</span>}
      </header>

      <div className="p-6 max-w-lg mx-auto space-y-4">
        {isEdit && (
          <div className="bg-amber-100 border-2 border-amber-300 rounded-xl px-4 py-3">
            <div className="text-sm font-bold text-amber-900">This match already has a saved result.</div>
            <div className="text-xs text-amber-700 mt-0.5">Changes will overwrite the existing record. To leave it unchanged, click Back.</div>
          </div>
        )}
        {/* Team info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-3xl font-black font-mono text-gray-900">{match.match_id}</div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xl font-semibold text-gray-700">{teamName(match.team1_id)}</span>
                <span className="text-gray-300 font-bold">vs</span>
                <span className="text-xl font-semibold text-gray-700">{match.team2_id ? teamName(match.team2_id) : '—'}</span>
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
                <span className="bg-green-100 text-green-700 text-xs font-black px-3 py-2 rounded-lg inline-block">
                  ✓ Done
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
          {/* Starting Position */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-2">Starting Position</label>
            <div className="flex gap-2">
              {(['face', 'side', 'back'] as const).map(pos => (
                <button key={pos} onClick={() => setStartingPosition(pos)}
                  className={`flex-1 py-3 rounded-lg text-sm font-bold border transition-colors ${startingPosition === pos ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {pos.charAt(0).toUpperCase() + pos.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Winner */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-2">Winner</label>
            <div className="flex gap-2">
              <button onClick={() => setWinner(1)}
                className={`flex-1 py-3 rounded-lg text-sm font-bold border transition-colors ${winner === 1 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {teamName(match.team1_id)}
              </button>
              <button onClick={() => setWinner(0)}
                className={`px-4 py-3 rounded-lg text-sm font-bold border transition-colors ${winner === 0 ? 'bg-gray-500 text-white border-gray-500' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                Draw
              </button>
              <button onClick={() => setWinner(2)}
                className={`flex-1 py-3 rounded-lg text-sm font-bold border transition-colors ${winner === 2 ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {match.team2_id ? teamName(match.team2_id) : 'Team 2'}
              </button>
            </div>
          </div>

          {/* Rounds */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-2">Rounds — {teamName(match.team1_id)}</label>
              <input type="number" min="0" step="1" value={rounds1} onChange={e => setRounds1(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-2">Rounds — {match.team2_id ? teamName(match.team2_id) : 'Team 2'}</label>
              <input type="number" min="0" step="1" value={rounds2} onChange={e => setRounds2(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-2">
              Judge Notes <span className="text-gray-300 font-normal">(not public)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Out of bounds, restart, dispute…"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
          </div>

          {/* Save / Undo */}
          {savedJustNow ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-green-800">✓ Result saved</span>
                <span className="text-xs text-gray-500 font-mono">Auto-close in {undoCountdown}s</span>
              </div>
              <div className="flex gap-2">
                <button onClick={undo} disabled={!savedRecordId}
                  className="flex-1 bg-white border-2 border-red-300 text-red-700 py-3 rounded-lg text-sm font-bold hover:bg-red-50 disabled:opacity-40">
                  ↩ Undo
                </button>
                <button onClick={() => { router.push('/judges/b'); router.refresh() }}
                  className="flex-1 bg-gray-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-gray-700">
                  Done →
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 pt-1">
              <button onClick={save} disabled={saving}
                className="flex-1 bg-gray-900 text-white py-3.5 rounded-xl text-base font-black disabled:opacity-40 hover:bg-gray-700 transition-colors">
                {saving ? 'Saving…' : isEdit ? 'Update Result' : 'Save Result'}
              </button>
              {saveMsg && <span className={`text-sm font-bold ${saveMsg === 'Saved!' || saveMsg === 'Undone' ? 'text-green-600' : 'text-red-500'}`}>{saveMsg}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
