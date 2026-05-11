'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) { setError('Enter your username'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid username or password'); return }
      router.push('/judges/dashboard')
      router.refresh()
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg p-10 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 border-2 border-gray-900 rounded-md flex items-center justify-center font-black text-[10px]">SFRC</div>
          <div>
            <div className="text-sm font-bold">STARTUP FEST</div>
            <div className="text-[11px] text-gray-400">Robotics Challenge</div>
          </div>
        </div>
        <span className="inline-block bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold tracking-wide px-3 py-1 rounded-full mb-5">
          ⚖️ JUDGES PANEL
        </span>
        <h2 className="text-xl font-bold mb-1">Judge Login</h2>
        <p className="text-sm text-gray-500 mb-6">Enter your credentials to access the panel.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Username</label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="e.g. admin" autoComplete="username" autoCapitalize="none"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" autoComplete="current-password"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-md text-sm transition-colors"
          >
            {loading ? 'Verifying…' : 'Login'}
          </button>
        </form>

        <p className="mt-5 text-center">
          <a href="/" className="text-xs text-gray-400 hover:text-gray-600">← Back to Results</a>
        </p>
      </div>
    </div>
  )
}
