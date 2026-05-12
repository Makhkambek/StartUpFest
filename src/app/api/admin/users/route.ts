import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const MOCK_JUDGES = [
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
  if (!hasSupabase) return { ok: true as const }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Unauthorized' }
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  const isAdmin = profile?.is_admin || user.user_metadata?.role === 'admin'
  if (!isAdmin) return { ok: false as const, status: 403, error: 'Admin only' }
  return { ok: true as const }
}

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  if (!hasSupabase) {
    return NextResponse.json(MOCK_JUDGES)
  }

  const admin = createAdminClient()
  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, username, is_admin, created_at')
    .order('created_at')
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const { data: cats, error: cErr } = await admin
    .from('judge_categories')
    .select('judge_id, category')
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
    categories: p.is_admin ? ['a', 'b', 'c', 'd'] : (catsByJudge.get(p.id) ?? []),
  }))
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { username, password, categories } = await req.json()
  if (!username || !password || !categories?.length) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ error: 'Username: 3-20 chars, letters/digits/underscore' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password min 6 chars' }, { status: 400 })
  }

  if (!hasSupabase) {
    return NextResponse.json({ error: 'Cannot create users in mock mode — configure Supabase first' }, { status: 400 })
  }

  const admin = createAdminClient()
  const email = `${username}@sfrc.local`

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })

  const uid = created.user.id
  await admin.from('profiles').insert({ id: uid, username, is_admin: false })
  await admin.from('judge_categories').insert(
    categories.map((cat: string) => ({ judge_id: uid, category: cat }))
  )

  return NextResponse.json({ ok: true, username })
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { userId, password } = await req.json()
  if (!userId || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Password min 6 chars' }, { status: 400 })

  if (!hasSupabase) {
    return NextResponse.json({ error: 'Cannot reset password in mock mode' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  if (!hasSupabase) {
    return NextResponse.json({ error: 'Cannot delete in mock mode' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
