import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Verify caller is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

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

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { userId } = await req.json()
  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(userId)

  return NextResponse.json({ ok: true })
}
