'use client'
import { Fragment, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/judges/ThemeToggle'

interface Judge {
  id: string
  username: string
  is_admin: boolean
  categories: string[]
}

const CATEGORIES = ['a', 'b', 'c', 'd']

export default function UsersPage() {
  const [judges, setJudges] = useState<Judge[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [currentUser, setCurrentUser] = useState<string | null>(null)

  // create form
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [cats, setCats] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [creating, setCreating] = useState(false)

  // password reset
  const [resetting, setResetting] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  // edit permissions
  const [editing, setEditing] = useState<string | null>(null)
  const [editCats, setEditCats] = useState<string[]>([])
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [saving, setSaving] = useState(false)


  async function load() {
    setLoadingList(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) setJudges(await res.json())
    setLoadingList(false)
  }

  useEffect(() => {
    load()
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUser(d.username ?? null))
  }, [])

  function toggleCat(c: string) {
    setCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function toggleEditCat(c: string) {
    setEditCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function handleAdminToggle(val: boolean) {
    setIsAdmin(val)
    if (val) setCats(['a', 'b', 'c', 'd'])
  }

  function handleEditAdminToggle(val: boolean) {
    setEditIsAdmin(val)
    if (val) setEditCats(['a', 'b', 'c', 'd'])
  }

  function openEdit(j: Judge) {
    if (editing === j.id) { setEditing(null); return }
    setEditing(j.id)
    setEditCats(j.categories)
    setEditIsAdmin(j.is_admin)
    setResetting(null)
  }

  function openReset(id: string) {
    setResetting(resetting === id ? null : id)
    setNewPassword('')
    setEditing(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) { toast.error('Fill username and password'); return }
    if (!isAdmin && !cats.length) { toast.error('Select at least one category'); return }
    setCreating(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.toLowerCase(), password, categories: cats, is_admin: isAdmin }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      toast.success(`${isAdmin ? 'Admin' : 'Judge'} "${username}" created`)
      setUsername(''); setPassword(''); setCats([]); setIsAdmin(false)
      await load()
    } else {
      toast.error(data.error ?? 'Failed to create user')
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Deleted "${name}"`)
      setEditing(null); setResetting(null)
      await load()
    } else {
      toast.error(data.error ?? 'Failed to delete')
    }
  }

  async function handleResetPassword(id: string, name: string) {
    if (!newPassword || newPassword.length < 6) { toast.error('Password min 6 chars'); return }
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, password: newPassword }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Password reset for "${name}"`)
      setResetting(null); setNewPassword('')
    } else {
      toast.error(data.error ?? 'Failed to reset password')
    }
  }

  async function handleSaveEdit(j: Judge) {
    setSaving(true)
    const finalCats = editIsAdmin ? [] : editCats
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: j.id, is_admin: editIsAdmin, categories: finalCats }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      toast.success(`Updated "${j.username}"`)
      setEditing(null)
      await load()
    } else {
      toast.error(data.error ?? 'Failed to update')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 h-14 flex items-center px-4 sm:px-10 justify-between">
        <div className="flex items-center gap-3">
          <a href="/judges/dashboard" className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50">← Dashboard</a>
          <span className="text-gray-300 dark:text-zinc-400 hidden sm:inline">|</span>
          <span className="text-sm font-bold hidden sm:inline">User Management</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/judges/admin/teams" className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 px-2.5 py-1.5 rounded border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800">Teams</a>
          <ThemeToggle />
        </div>
      </header>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-5xl">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-1">Users & Permissions</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6 sm:mb-8">Create judge and admin accounts, assign categories and roles.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Create form ── */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-5 border border-gray-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-4">Add Account</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">Username</label>
                  <input value={username} onChange={e => setUsername(e.target.value)}
                    placeholder="e.g. judge_a1" autoCapitalize="none" autoCorrect="off"
                    className="text-base w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="text-base w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500" />
                </div>

                {/* Role toggle */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2">Role</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleAdminToggle(false)}
                      className={`flex-1 py-2 rounded-md text-xs font-bold border transition-colors ${
                        !isAdmin ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}>
                      Judge
                    </button>
                    <button type="button" onClick={() => handleAdminToggle(true)}
                      className={`flex-1 py-2 rounded-md text-xs font-bold border transition-colors ${
                        isAdmin ? 'bg-amber-600 text-white border-amber-600' : 'bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-amber-400'
                      }`}>
                      Admin
                    </button>
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <label className={`block text-xs font-semibold mb-2 ${isAdmin ? 'text-gray-400 dark:text-zinc-400' : 'text-gray-700 dark:text-zinc-300'}`}>
                    {isAdmin ? 'Categories (all — admin)' : 'Categories'}
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {CATEGORIES.map(c => (
                      <button key={c} type="button"
                        onClick={() => !isAdmin && toggleCat(c)}
                        disabled={isAdmin}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                          cats.includes(c) || isAdmin
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-amber-300 dark:border-amber-800'
                        } ${isAdmin ? 'opacity-60 cursor-default' : ''}`}>
                        {c.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={creating}
                  className="w-full bg-gray-900 text-white text-sm font-bold py-2.5 rounded-md hover:bg-gray-800 disabled:opacity-50 min-h-[44px]">
                  {creating ? 'Creating…' : `Create ${isAdmin ? 'Admin' : 'Judge'}`}
                </button>
              </form>
            </div>
          </div>

          {/* ── Users list ── */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
                <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                  {loadingList ? 'Loading…' : `${judges.length} user${judges.length === 1 ? '' : 's'}`}
                </h2>
              </div>

              {loadingList ? (
                <div className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                      <div className="h-3 w-24 bg-gray-200 dark:bg-zinc-800 rounded" />
                      <div className="h-3 w-16 bg-gray-200 dark:bg-zinc-800 rounded" />
                      <div className="flex-1" />
                      <div className="h-7 w-20 bg-gray-200 dark:bg-zinc-800 rounded" />
                    </div>
                  ))}
                </div>
              ) : judges.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-gray-400 dark:text-zinc-400">No users yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead className="bg-gray-50 dark:bg-zinc-800 text-xs text-gray-500 dark:text-zinc-400 font-semibold">
                      <tr>
                        <th className="text-left px-4 py-2.5">Username</th>
                        <th className="text-left px-4 py-2.5">Role</th>
                        <th className="text-left px-4 py-2.5">Categories</th>
                        <th className="text-right px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {judges.map(j => {
                        const isSelf = j.username === currentUser
                        return (
                          <Fragment key={j.id}>
                            {/* Main row */}
                            <tr className="border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800">
                              <td className="px-4 py-3 font-semibold text-gray-900 dark:text-zinc-100">
                                @{j.username}
                                {isSelf && <span className="ml-1.5 text-[10px] text-blue-500 dark:text-blue-400 font-bold">(you)</span>}
                              </td>
                              <td className="px-4 py-3">
                                {j.is_admin
                                  ? <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 border border-amber-200 dark:border-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">ADMIN</span>
                                  : <span className="text-xs text-gray-400 dark:text-zinc-400">judge</span>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1 flex-wrap">
                                  {j.categories.map(c => (
                                    <span key={c} className="text-[10px] font-bold bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 px-1.5 py-0.5 rounded">
                                      {c.toUpperCase()}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => openEdit(j)}
                                    className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${
                                      editing === j.id
                                        ? 'bg-amber-600 text-white'
                                        : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                    }`}>
                                    Edit
                                  </button>
                                  <button onClick={() => openReset(j.id)}
                                    className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${
                                      resetting === j.id
                                        ? 'bg-gray-700 text-white'
                                        : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                    }`}>
                                    PW
                                  </button>
                                  <button onClick={() => handleDelete(j.id, j.username)}
                                    disabled={isSelf}
                                    title={isSelf ? 'Cannot delete your own account' : `Delete ${j.username}`}
                                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 font-semibold px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 dark:bg-red-950/30 disabled:opacity-25 disabled:cursor-not-allowed">
                                    Del
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Edit permissions row */}
                            {editing === j.id && (
                              <tr className="border-t border-amber-100 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20">
                                <td colSpan={4} className="px-4 py-4">
                                  <div className="space-y-3">
                                    <div>
                                      <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300 block mb-2">Role</span>
                                      <div className="flex gap-2 max-w-[200px]">
                                        <button type="button" onClick={() => handleEditAdminToggle(false)}
                                          className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${
                                            !editIsAdmin ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-gray-500'
                                          }`}>
                                          Judge
                                        </button>
                                        <button type="button" onClick={() => handleEditAdminToggle(true)}
                                          className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${
                                            editIsAdmin ? 'bg-amber-600 text-white border-amber-600' : 'bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-amber-400'
                                          }`}>
                                          Admin
                                        </button>
                                      </div>
                                    </div>
                                    <div>
                                      <span className={`text-xs font-semibold block mb-2 ${editIsAdmin ? 'text-gray-400 dark:text-zinc-400' : 'text-gray-700 dark:text-zinc-300'}`}>
                                        {editIsAdmin ? 'Categories (all — admin)' : 'Categories'}
                                      </span>
                                      <div className="flex gap-1.5 flex-wrap">
                                        {CATEGORIES.map(c => (
                                          <button key={c} type="button"
                                            onClick={() => !editIsAdmin && toggleEditCat(c)}
                                            disabled={editIsAdmin}
                                            className={`px-2.5 py-1.5 rounded text-xs font-bold border transition-colors ${
                                              editCats.includes(c) || editIsAdmin
                                                ? 'bg-amber-600 text-white border-amber-600'
                                                : 'bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-amber-300 dark:border-amber-800'
                                            } ${editIsAdmin ? 'opacity-60 cursor-default' : ''}`}>
                                            {c.toUpperCase()}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                      <button onClick={() => handleSaveEdit(j)} disabled={saving}
                                        className="bg-amber-600 text-white text-xs font-bold px-4 py-1.5 rounded hover:bg-amber-700 disabled:opacity-50">
                                        {saving ? 'Saving…' : 'Save'}
                                      </button>
                                      <button onClick={() => setEditing(null)}
                                        className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 px-3 py-1.5">
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}

                            {/* Reset password row */}
                            {resetting === j.id && (
                              <tr className="border-t border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40">
                                <td colSpan={4} className="px-4 py-3">
                                  <div className="flex gap-2 items-center flex-wrap">
                                    <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300 shrink-0">New PW for @{j.username}:</span>
                                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                      placeholder="Min 6 chars"
                                      className="text-base flex-1 min-w-[140px] px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:border-amber-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500" />
                                    <button onClick={() => handleResetPassword(j.id, j.username)}
                                      className="bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-gray-800">
                                      Set
                                    </button>
                                    <button onClick={() => { setResetting(null); setNewPassword('') }}
                                      className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 px-2 py-1.5">
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
