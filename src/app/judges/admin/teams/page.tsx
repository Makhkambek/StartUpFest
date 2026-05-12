'use client'
import { useEffect, useState } from 'react'
import type { Team } from '@/types/database'

type Cat = 'a' | 'b' | 'c' | 'd'
const CATEGORIES: Cat[] = ['a', 'b', 'c', 'd']
const CAT_LABELS: Record<Cat, string> = {
  a: 'A · Line Follower',
  b: 'B · Mini Sumo',
  c: 'C · MiniRoboWar',
  d: 'D · Robo Football',
}

export default function TeamsAdminPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [activeCat, setActiveCat] = useState<Cat>('a')
  const [name, setName] = useState('')
  const [school, setSchool] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')

  async function load() {
    const res = await fetch('/api/admin/teams')
    if (res.ok) setTeams(await res.json())
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setMsg({ ok: false, text: 'Team name required' }); return }
    setLoading(true); setMsg(null)
    const res = await fetch('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), school: school.trim(), category: activeCat }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setMsg({ ok: true, text: `"${name}" added to ${CAT_LABELS[activeCat]}` })
      setName(''); setSchool('')
      await load()
    } else {
      setMsg({ ok: false, text: data.error ?? 'Failed' })
    }
  }

  async function handleDelete(id: string, teamName: string) {
    if (!confirm(`Delete team "${teamName}"?`)) return
    const res = await fetch('/api/admin/teams', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) await load()
    else {
      const d = await res.json()
      setMsg({ ok: false, text: d.error ?? 'Failed to delete' })
    }
  }

  async function handleBulkImport() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return
    setLoading(true); setMsg(null)
    let added = 0, failed = 0
    for (const line of lines) {
      const [teamName, schoolName] = line.split(',').map(s => s?.trim() ?? '')
      if (!teamName) continue
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName, school: schoolName ?? '', category: activeCat }),
      })
      if (res.ok) added++; else failed++
    }
    setLoading(false)
    setMsg({ ok: failed === 0, text: `Imported ${added} teams${failed ? `, ${failed} failed` : ''}` })
    setBulkText(''); setBulkOpen(false)
    await load()
  }

  const filteredTeams = teams.filter(t => t.category === activeCat)
  const counts = CATEGORIES.reduce((acc, c) => {
    acc[c] = teams.filter(t => t.category === c).length
    return acc
  }, {} as Record<Cat, number>)

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-10 justify-between">
        <div className="flex items-center gap-3">
          <a href="/judges/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← Dashboard</a>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-bold">Teams Management</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <a href="/judges/admin/users" className="text-gray-500 hover:text-gray-900 px-2.5 py-1.5 rounded border border-gray-200 hover:bg-gray-50">Judges</a>
        </div>
      </header>

      <div className="px-10 py-10 max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Teams</h1>
        <p className="text-sm text-gray-500 mb-8">Add and manage competition teams. Each team belongs to one category.</p>

        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setActiveCat(c)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeCat === c
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}>
              {CAT_LABELS[c]} <span className="text-xs text-gray-400 ml-1">({counts[c]})</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Add Team to {CAT_LABELS[activeCat]}</h2>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Team name</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. Rocket Robotics"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">School / Mentor</label>
                  <input value={school} onChange={e => setSchool(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
                </div>
                {msg && (
                  <div className={`text-xs px-3 py-2 rounded ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {msg.text}
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full bg-gray-900 text-white text-sm font-semibold py-2.5 rounded-md hover:bg-gray-800 disabled:opacity-50">
                  {loading ? 'Adding...' : 'Add Team'}
                </button>
              </form>

              <div className="mt-5 pt-5 border-t border-gray-100">
                <button onClick={() => setBulkOpen(!bulkOpen)}
                  className="text-xs text-gray-500 hover:text-gray-900 font-semibold">
                  {bulkOpen ? '× Close bulk import' : '+ Bulk import (CSV)'}
                </button>
                {bulkOpen && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] text-gray-500">Format: <code className="bg-gray-100 px-1">name,school</code> — one team per line</p>
                    <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
                      placeholder={`Rocket Robotics,School #1\nLaser Bots,School #2`}
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:border-amber-500" />
                    <button onClick={handleBulkImport} disabled={loading || !bulkText.trim()}
                      className="w-full bg-amber-600 text-white text-xs font-semibold py-2 rounded-md hover:bg-amber-700 disabled:opacity-50">
                      {loading ? 'Importing...' : `Import to ${activeCat.toUpperCase()}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">
                  {filteredTeams.length} team{filteredTeams.length === 1 ? '' : 's'} in {CAT_LABELS[activeCat]}
                </h2>
              </div>
              {filteredTeams.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-gray-400">
                  No teams yet. Add one using the form on the left.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 font-semibold">
                    <tr>
                      <th className="text-left px-5 py-2.5 w-12">#</th>
                      <th className="text-left px-5 py-2.5">Team</th>
                      <th className="text-left px-5 py-2.5">School / Mentor</th>
                      <th className="text-right px-5 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeams.map((t, i) => (
                      <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-5 py-3 font-semibold text-gray-900">{t.name}</td>
                        <td className="px-5 py-3 text-gray-600">{t.school || <span className="text-gray-300">—</span>}</td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => handleDelete(t.id, t.name)}
                            className="text-xs text-red-600 hover:text-red-700 font-semibold px-2 py-1 rounded hover:bg-red-50">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
