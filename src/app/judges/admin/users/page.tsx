'use client'
import { useState } from 'react'

const CATEGORIES = ['a', 'b', 'c', 'd']
const CAT_LABELS: Record<string, string> = { a: 'A · Line Follower', b: 'B · Mini Sumo', c: 'C · MiniRoboWar', d: 'D · Robo Football' }

export default function UsersPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [cats, setCats] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function toggleCat(c: string) {
    setCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password || !cats.length) { setMsg({ ok: false, text: 'Fill all fields and select at least one category' }); return }
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
    } else {
      setMsg({ ok: false, text: data.error ?? 'Failed to create user' })
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-10 justify-between">
        <div className="flex items-center gap-3">
          <a href="/judges/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← Dashboard</a>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-bold">User Management</span>
        </div>
      </header>

      <div className="px-10 py-10 max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create Judge Account</h1>
        <p className="text-sm text-gray-500 mb-8">Judges can only access categories you assign to them.</p>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
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
              <div className="flex gap-3 flex-wrap">
                {CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => toggleCat(c)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                      cats.includes(c)
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
                    }`}>
                    {CAT_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
            {msg && (
              <p className={`text-sm rounded-md px-3 py-2 ${msg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {msg.text}
              </p>
            )}
            <button type="submit" disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-md text-sm transition-colors">
              {loading ? 'Creating…' : 'Create Judge'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
