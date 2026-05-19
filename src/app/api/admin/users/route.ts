import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const MOCK_USERS = [
  { id: 'mock-admin',    username: 'admin',    is_admin: true,  categories: ['a','b','c','d'] },
  { id: 'mock-judge-a1', username: 'judge_a1', is_admin: false, categories: ['a'] },
  { id: 'mock-judge-a2', username: 'judge_a2', is_admin: false, categories: ['a'] },
  { id: 'mock-judge-b1', username: 'judge_b1', is_admin: false, categories: ['b'] },
  { id: 'mock-judge-b2', username: 'judge_b2', is_admin: false, categories: ['b'] },
  { id: 'mock-judge-c1', username: 'judge_c1', is_admin: false, categories: ['c'] },
  { id: 'mock-judge-c2', username: 'judge_c2', is_admin: false, categories: ['c'] },
  { id: 'mock-judge-d1', username: 'judge_d1', is_admin: false, categories: ['d'] },
  { id: 'mock-judge-d2', username: 'judge_d2', is_admin: false, categories: ['d'] },
]

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { ok: false as const, uid: null as string | null, status: 401, error: 'Unauthorized' }
  if (session.role !== 'admin') return { ok: false as const, uid: null, status: 403, error: 'Admin only' }
  if (hasSupabase) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return { ok: true as const, uid: user?.id ?? null }
  }
  return { ok: true as const, uid: null as string | null }
}

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  if (!hasSupabase) return NextResponse.json(MOCK_USERS)

  const admin = createAdminClient()
  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, username, is_admin, created_at')
    .order('created_at')
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const { data: cats, error: cErr } = await admin.from('judge_categories').select('judge_id, category')
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  const catsByJudge = new Map<string, string[]>()
  for (const row of cats ?? []) {
    const arr = catsByJudge.get(row.judge_id) ?? []
    arr.push(row.category)
    catsByJudge.set(row.judge_id, arr)
  }

  const result = (profiles ?? []).map(p => ({
    id: p.id,
    username: p.username,
    is_admin: p.is_admin,
    categories: p.is_admin ? ['a','b','c','d'] : (catsByJudge.get(p.id) ?? []),
  }))
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { username, password, categories, is_admin = false } = await req.json()
  if (!username || !password) return NextResponse.json({ error: 'Missing username or password' }, { status: 400 })
  if (!is_admin && !categories?.length) return NextResponse.json({ error: 'Select at least one category' }, { status: 400 })
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ error: 'Username: 3-20 chars, letters/digits/underscore' }, { status: 400 })
  }
  if (password.length < 12) return NextResponse.json({ error: 'Password min 12 chars' }, { status: 400 })

  if (!hasSupabase) return NextResponse.json({ error: 'Configure Supabase to create users' }, { status: 400 })

  const admin = createAdminClient()
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: `${username}@sfrc.local`,
    password,
    email_confirm: true,
  })
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })

  const uid = created.user.id
  const { error: profileErr } = await admin
    .from('profiles')
    .insert({ id: uid, username, is_admin: !!is_admin })
  if (profileErr) {
    // Roll back the auth user so we don't leave an orphan account.
    await admin.auth.admin.deleteUser(uid).catch(() => null)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }
  if (!is_admin && categories?.length) {
    const { error: catErr } = await admin.from('judge_categories').insert(
      (categories as string[]).map(cat => ({ judge_id: uid, category: cat }))
    )
    if (catErr) {
      // Categories failed — clean up so user isn't left with no assignments.
      await Promise.resolve(admin.from('profiles').delete().eq('id', uid)).catch(() => null)
      await admin.auth.admin.deleteUser(uid).catch(() => null)
      return NextResponse.json({ error: catErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, username })
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await req.json()
  const { userId, password, is_admin, categories } = body as {
    userId: string
    password?: string
    is_admin?: boolean
    categories?: string[]
  }
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  if (!hasSupabase) return NextResponse.json({ error: 'Configure Supabase to update users' }, { status: 400 })

  const admin = createAdminClient()

  if (typeof password === 'string') {
    if (password.length < 12) return NextResponse.json({ error: 'Password min 12 chars' }, { status: 400 })
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (typeof is_admin === 'boolean') {
    const { error } = await admin.from('profiles').update({ is_admin }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (Array.isArray(categories)) {
    await admin.from('judge_categories').delete().eq('judge_id', userId)
    const finalCats = (typeof is_admin === 'boolean' ? is_admin : false)
      ? []
      : categories
    if (finalCats.length > 0) {
      await admin.from('judge_categories').insert(
        finalCats.map((cat: string) => ({ judge_id: userId, category: cat }))
      )
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  if (!hasSupabase) return NextResponse.json({ error: 'Configure Supabase to delete users' }, { status: 400 })

  if (guard.uid && guard.uid === userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
