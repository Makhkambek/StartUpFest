'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Team, ResultA } from '@/types/database'

type PenaltyKey = ResultA['penalty']

const PENALTIES: { value: PenaltyKey; label: string }[] = [
  { value: '0',    label: 'No penalty' },
  { value: '20',   label: '+20 sec' },
  { value: '40',   label: '+40 sec' },
  { value: 'dnf',  label: 'DNF' },
  { value: 'disq', label: 'DISQ' },
]

interface Row {
  team: Team
  result: ResultA | null
  editing: boolean
  run1: string
  run2: string
  penalty: PenaltyKey
  saving: boolean
}

function parseTime(s: string): number | null {
  const n = parseFloat(s)
  return isNaN(n) || n <= 0 ? null : Math.round(n * 1000) / 1000
}

function fmtTime(ms: number | null) {
  if (ms === null) return '—'
  return (ms / 1000).toFixed(3) + 's'
}

export default function JudgesAPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [addName, setAddName] = useState('')
  const [addSchool, setAddSchool] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [teamsRes, resultsRes] = await Promise.all([
      fetch('/api/judges/a/teams'),
      fetch('/api/judges/a/results'),
    ])
    const teams: Team[] = await teamsRes.json()
    const results: ResultA[] = resultsRes.ok ? await resultsRes.json() : []
    const resultMap = new Map(results.map(r => [r.team_id, r]))

    setRows(teams.map(team => {
      const result = resultMap.get(team.id) ?? null
      return {
        team,
        result,
        editing: false,
        run1: result?.run1 != null ? String(result.run1 / 1000) : '',
        run2: result?.run2 != null ? String(result.run2 / 1000) : '',
        penalty: result?.penalty ?? '0',
        saving: false,
      }
    }))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function toggleEdit(teamId: string) {
    setRows(prev => prev.map(r =>
      r.team.id === teamId ? { ...r, editing: !r.editing } : r
    ))
  }

  function updateRow(teamId: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => r.team.id === teamId ? { ...r, ...patch } : r))
  }

  async function saveResult(row: Row) {
    updateRow(row.team.id, { saving: true })
    const run1ms = parseTime(row.run1)
    const run2ms = parseTime(row.run2)
    await fetch('/api/judges/a/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_id: row.team.id,
        run1: run1ms !== null ? Math.round(run1ms * 1000) : null,
        run2: run2ms !== null ? Math.round(run2ms * 1000) : null,
        penalty: row.penalty,
      }),
    })
    await load()
  }

  async function addTeam() {
    if (!addName.trim()) return
    setAddLoading(true); setError('')
    const res = await fetch('/api/judges/a/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName, school: addSchool }),
    })
    if (!res.ok) { setError((await res.json()).error); setAddLoading(false); return }
    setAddName(''); setAddSchool(''); setAddOpen(false); setAddLoading(false)
    await load()
  }

  async function deleteTeam(id: string) {
    if (!confirm('Delete this team and their results?')) return
    await fetch('/api/judges/a/teams', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6 justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <a href="/judges/dashboard" className="text-sm text-gray-500 hover:text-gray-800">← Dashboard</a>
          <span className="text-gray-300">|</span>
          <div className="w-8 h-8 border-2 border-gray-900 rounded flex items-center justify-center font-black text-[9px]">SFRC</div>
          <span className="text-sm font-bold">A · Line Follower</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/a" target="_blank" className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50">View Results ↗</a>
          <a href="/api/auth/logout" className="text-sm text-red-600 px-3 py-1.5 rounded border border-red-200 hover:bg-red-50">Log Out</a>
        </div>
      </header>

      <div className="px-6 py-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">🏎️ Line Follower — Teams & Results</h1>
            <p className="text-sm text-gray-500 mt-0.5">Times in seconds (e.g. 12.345). Best run is used for ranking.</p>
          </div>
          <button onClick={() => setAddOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
            + Add Team
          </button>
        </div>

        {/* Add Team Form */}
        {addOpen && (
          <div className="bg-white border border-amber-200 rounded-xl p-5 mb-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">New Team</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Team Name *</label>
                <input value={addName} onChange={e => setAddName(e.target.value)}
                  placeholder="e.g. RoboTeam Alpha"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">School / Org</label>
                <input value={addSchool} onChange={e => setAddSchool(e.target.value)}
                  placeholder="e.g. MIT High School"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex gap-2">
              <button onClick={addTeam} disabled={addLoading || !addName.trim()}
                className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
                {addLoading ? 'Adding…' : 'Add Team'}
              </button>
              <button onClick={() => { setAddOpen(false); setError('') }}
                className="text-sm text-gray-600 px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Teams Table */}
        {loading ? (
          <div className="text-sm text-gray-400 py-12 text-center">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
            <div className="text-4xl mb-3">🏎️</div>
            <div className="text-sm font-semibold text-gray-700 mb-1">No teams yet</div>
            <div className="text-xs text-gray-400">Click "+ Add Team" to register the first team</div>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div key={row.team.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Team header row */}
                <div className="flex items-center px-5 py-4 gap-4">
                  <span className="text-xs font-bold text-gray-400 w-6 text-center">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{row.team.name}</div>
                    <div className="text-xs text-gray-400 truncate">{row.team.school || '—'}</div>
                  </div>

                  {/* Result summary */}
                  {!row.editing && (
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="text-[10px] text-gray-400 font-semibold">RUN 1</div>
                        <div className="font-mono font-bold text-gray-800">{fmtTime(row.result?.run1 ?? null)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-gray-400 font-semibold">RUN 2</div>
                        <div className="font-mono font-bold text-gray-800">{fmtTime(row.result?.run2 ?? null)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-gray-400 font-semibold">PENALTY</div>
                        <div className="font-semibold text-gray-800">
                          {row.result?.penalty === '0' || !row.result ? '—' : row.result.penalty.toUpperCase()}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-gray-400 font-semibold">BEST</div>
                        <div className="font-mono font-bold text-amber-700">
                          {row.result?.penalty === 'dnf' ? 'DNF'
                            : row.result?.penalty === 'disq' ? 'DISQ'
                            : fmtTime(row.result?.total ?? null)}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 ml-2">
                    <button onClick={() => toggleEdit(row.team.id)}
                      className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors">
                      {row.editing ? 'Cancel' : 'Edit'}
                    </button>
                    <button onClick={() => deleteTeam(row.team.id)}
                      className="text-xs font-semibold px-3 py-2 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors">
                      Del
                    </button>
                  </div>
                </div>

                {/* Edit panel */}
                {row.editing && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Run 1 (seconds)</label>
                        <input
                          type="number" step="0.001" min="0" placeholder="e.g. 12.345"
                          value={row.run1}
                          onChange={e => updateRow(row.team.id, { run1: e.target.value })}
                          className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Run 2 (seconds)</label>
                        <input
                          type="number" step="0.001" min="0" placeholder="e.g. 11.800"
                          value={row.run2}
                          onChange={e => updateRow(row.team.id, { run2: e.target.value })}
                          className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Penalty</label>
                        <select
                          value={row.penalty}
                          onChange={e => updateRow(row.team.id, { penalty: e.target.value as PenaltyKey })}
                          className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 bg-white">
                          {PENALTIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => saveResult(row)}
                      disabled={row.saving}
                      className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white text-sm font-semibold px-6 py-2.5 rounded-lg">
                      {row.saving ? 'Saving…' : '✓ Save Result'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
