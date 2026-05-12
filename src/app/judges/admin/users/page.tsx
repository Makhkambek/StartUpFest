'use client'
import { Fragment, useEffect, useState } from 'react'

interface Judge {
  id: string
  username: string
  is_admin: boolean
  categories: string[]
}

const CATEGORIES = ['a', 'b', 'c', 'd']
const CAT_LABELS: Record<string, string> = {
  a: 'A · Line Follower',
  b: 'B · Mini Sumo',
  c: 'C · MiniRoboWar',
  d: 'D · Robo Football',
}

export default function UsersPage() {
  const [judges, setJudges] = useState<Judge[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [cats, setCats] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  async function load() {
    setLoadingList(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) setJudges(await res.json())
    setLoadingList(false)
  }

  useEffect(() => { load() }, [])

  function toggleCat(c: string) {
    setCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password || !cats.length) {
      setMsg({ ok: false, text: 'Fill all fields and select at least one category' })
      return
    }
    setLoading(true); setMsg(null)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.toLowerCase(), password, categories: cats }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setMsg({ ok: true, text: `Judge "${username}" created` })
      setUsername(''); setPassword(''); setCats([])
      await load()
    } else {
      setMsg({ ok: false, text: data.error ?? 'Failed to create user' })
    }
  }

  async function handleDelete(id: string, judgeName: string) {
    if (!confirm(`Delete judge "${judgeName}"? This cannot be undone.`)) return
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    const data = await res.json()
    if (res.ok) {
      setMsg({ ok: true, text: `Deleted "${judgeName}"` })
      await load()
    } else {
      setMsg({ ok: false, text: data.error ?? 'Failed to delete' })
    }
  }

  async function handleResetPassword(id: string, judgeName: string) {
    if (!newPassword || newPassword.length < 6) {
      setMsg({ ok: false, text: 'Password min 6 chars' })
      return
    }
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, password: newPassword }),
    })
    const data = await res.json()
    if (res.ok) {
      setMsg({ ok: true, text: `Password reset for "${judgeName}"` })
      setResetting(null); setNewPassword('')
    } else {
      setMsg({ ok: false, text: data.error ?? 'Failed to reset password' })
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-10 justify-between">
        <div className="flex items-center gap-3">
          <a href="/judges/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← Dashboard</a>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-bold">Judges Management</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <a href="/judges/admin/teams" className="text-gray-500 hover:text-gray-900 px-2.5 py-1.5 rounded border border-gray-200 hover:bg-gray-50">Teams</a>
        </div>
      </header>

      <div className="px-10 py-10 max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Judges</h1>
        <p className="text-sm text-gray-500 mb-8">Create judge accounts and assign categories.</p>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Create Judge</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Username</label>
                  <input value={username} onChange={e => setUsername(e.target.value)}
                    placeholder="e.g. judge_a1" autoCapitalize="none"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Categories</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {CATEGORIES.map(c => (
                      <button key={c} type="button" onClick={() => toggleCat(c)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                          cats.includes(c)
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
                        }`}>
                        {c.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                {msg && (
                  <div className={`text-xs px-3 py-2 rounded ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {msg.text}
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full bg-gray-900 text-white text-sm font-semibold py-2.5 rounded-md hover:bg-gray-800 disabled:opacity-50">
                  {loading ? 'Creating...' : 'Create Judge'}
                </button>
              </form>
            </div>
          </div>

          <div className="col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">
                  {judges.length} judge{judges.length === 1 ? '' : 's'}
                </h2>
              </div>
              {loadingList ? (
                <div className="px-5 py-12 text-center text-sm text-gray-400">Loading...</div>
              ) : judges.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-gray-400">No judges yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 font-semibold">
                    <tr>
                      <th className="text-left px-5 py-2.5">Username</th>
                      <th className="text-left px-5 py-2.5">Role</th>
                      <th className="text-left px-5 py-2.5">Categories</th>
                      <th className="text-right px-5 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {judges.map(j => (
                      <Fragment key={j.id}>
                        <tr className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-5 py-3 font-semibold text-gray-900">@{j.username}</td>
                          <td className="px-5 py-3">
                            {j.is_admin ? (
                              <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">ADMIN</span>
                            ) : (
                              <span className="text-xs text-gray-500">judge</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {j.categories.map(c => (
                                <span key={c} className="text-[10px] font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                                  {c.toUpperCase()}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => { setResetting(resetting === j.id ? null : j.id); setNewPassword('') }}
                                disabled={j.is_admin}
                                className="text-xs text-gray-600 hover:text-gray-900 font-semibold px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent">
                                Reset PW
                              </button>
                              <button onClick={() => handleDelete(j.id, j.username)}
                                disabled={j.is_admin}
                                className="text-xs text-red-600 hover:text-red-700 font-semibold px-2 py-1 rounded hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent">
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        {resetting === j.id && (
                          <tr className="border-t border-gray-100 bg-amber-50/40">
                            <td colSpan={4} className="px-5 py-3">
                              <div className="flex gap-2 items-center">
                                <span className="text-xs font-semibold text-gray-700">New password for @{j.username}:</span>
                                <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                  placeholder="Min 6 chars"
                                  className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:border-amber-500" />
                                <button onClick={() => handleResetPassword(j.id, j.username)}
                                  className="bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-amber-700">
                                  Set
                                </button>
                                <button onClick={() => { setResetting(null); setNewPassword('') }}
                                  className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1.5">
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
