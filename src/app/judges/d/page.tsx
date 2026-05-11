'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Team, MatchD } from '@/types/database'

interface MatchWithNames extends MatchD {
  team1_name: string
  team2_name: string
}

export default function JudgesDPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<MatchWithNames[]>([])
  const [loading, setLoading] = useState(true)

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addSchool, setAddSchool] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const [t1, setT1] = useState('')
  const [t2, setT2] = useState('')
  const [goals1, setGoals1] = useState('0')
  const [goals2, setGoals2] = useState('0')
  const [saving, setSaving] = useState(false)
  const [matchError, setMatchError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [tr, mr] = await Promise.all([
      fetch('/api/judges/d/teams'),
      fetch('/api/judges/d/matches'),
    ])
    const t: Team[] = await tr.json()
    const m: MatchD[] = mr.ok ? await mr.json() : []
    const tMap = new Map(t.map(x => [x.id, x]))
    setTeams(t)
    setMatches(m.map(x => ({
      ...x,
      team1_name: tMap.get(x.team1_id)?.name ?? x.team1_id,
      team2_name: tMap.get(x.team2_id)?.name ?? x.team2_id,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addTeam() {
    if (!addName.trim()) return
    setAddLoading(true)
    await fetch('/api/judges/d/teams', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName, school: addSchool }),
    })
    setAddName(''); setAddSchool(''); setAddOpen(false); setAddLoading(false)
    await load()
  }

  async function deleteTeam(id: string) {
    if (!confirm('Delete this team?')) return
    await fetch('/api/judges/d/teams', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  async function recordMatch() {
    if (!t1 || !t2) { setMatchError('Select both teams'); return }
    if (t1 === t2)  { setMatchError('Teams must be different'); return }
    setSaving(true); setMatchError('')
    await fetch('/api/judges/d/matches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team1_id: t1, team2_id: t2,
        goals1: parseInt(goals1) || 0,
        goals2: parseInt(goals2) || 0,
      }),
    })
    setT1(''); setT2(''); setGoals1('0'); setGoals2('0')
    setSaving(false)
    await load()
  }

  async function deleteMatch(id: string) {
    await fetch('/api/judges/d/matches', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  const resultLabel = (m: MatchWithNames) => {
    if (m.goals1 > m.goals2) return `${m.team1_name} wins`
    if (m.goals2 > m.goals1) return `${m.team2_name} wins`
    return 'Draw'
  }
  const resultColor = (m: MatchWithNames) =>
    m.goals1 === m.goals2 ? 'text-gray-600 bg-gray-100' : 'text-green-700 bg-green-50 border border-green-200'

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6 justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <a href="/judges/dashboard" className="text-sm text-gray-500 hover:text-gray-800">← Dashboard</a>
          <span className="text-gray-300">|</span>
          <div className="w-8 h-8 border-2 border-gray-900 rounded flex items-center justify-center font-black text-[9px]">SFRC</div>
          <span className="text-sm font-bold">D · Robo Football</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/d" target="_blank" className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50">View Results ↗</a>
          <a href="/api/auth/logout" className="text-sm text-red-600 px-3 py-1.5 rounded border border-red-200 hover:bg-red-50">Log Out</a>
        </div>
      </header>

      <div className="px-6 py-8 max-w-4xl mx-auto space-y-8">

        {/* Teams */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">⚽ Teams ({teams.length})</h2>
            <button onClick={() => setAddOpen(v => !v)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
              + Add Team
            </button>
          </div>

          {addOpen && (
            <div className="bg-white border border-amber-200 rounded-xl p-5 mb-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Team Name *</label>
                  <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="e.g. RoboFC Alpha"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">School / Org</label>
                  <input value={addSchool} onChange={e => setAddSchool(e.target.value)} placeholder="e.g. Tech School"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addTeam} disabled={addLoading || !addName.trim()}
                  className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
                  {addLoading ? 'Adding…' : 'Add Team'}
                </button>
                <button onClick={() => setAddOpen(false)}
                  className="text-sm text-gray-600 px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          {loading ? <div className="text-sm text-gray-400 py-6 text-center">Loading…</div> : teams.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">No teams yet</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {teams.map((t, i) => (
                <div key={t.id} className="flex items-center px-5 py-3.5 gap-3">
                  <span className="text-xs text-gray-400 w-5 text-center">{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.school || '—'}</div>
                  </div>
                  <button onClick={() => deleteTeam(t.id)}
                    className="text-xs text-red-500 px-2.5 py-1.5 rounded border border-red-100 hover:bg-red-50">Del</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Record Match */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">🎯 Record Match</h2>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="grid grid-cols-2 gap-6 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Team 1</label>
                <select value={t1} onChange={e => setT1(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500">
                  <option value="">Select team…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Team 2</label>
                <select value={t2} onChange={e => setT2(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500">
                  <option value="">Select team…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-xs mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Goals — Team 1</label>
                <input type="number" min="0" value={goals1} onChange={e => setGoals1(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg text-2xl font-bold text-center font-mono focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Goals — Team 2</label>
                <input type="number" min="0" value={goals2} onChange={e => setGoals2(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg text-2xl font-bold text-center font-mono focus:outline-none focus:border-amber-500" />
              </div>
            </div>

            {matchError && <p className="text-sm text-red-600 mb-3">{matchError}</p>}
            <button onClick={recordMatch} disabled={saving || !t1 || !t2}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white text-sm font-semibold px-6 py-3 rounded-lg">
              {saving ? 'Saving…' : '✓ Record Match'}
            </button>
          </div>
        </section>

        {/* Match History */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">📋 Match History ({matches.length})</h2>
          {matches.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">No matches recorded yet</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {[...matches].reverse().map((m, i) => (
                <div key={m.id} className="flex items-center px-5 py-3.5 gap-4">
                  <span className="text-xs text-gray-400 w-5">{matches.length - i}</span>
                  <div className="flex-1 text-sm">
                    <span className={m.goals1 > m.goals2 ? 'font-bold text-amber-700' : 'text-gray-700'}>{m.team1_name}</span>
                    <span className="font-bold text-gray-900 mx-3">{m.goals1} : {m.goals2}</span>
                    <span className={m.goals2 > m.goals1 ? 'font-bold text-amber-700' : 'text-gray-700'}>{m.team2_name}</span>
                  </div>
                  <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${resultColor(m)}`}>
                    {resultLabel(m)}
                  </div>
                  <button onClick={() => deleteMatch(m.id)}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1">✕</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
