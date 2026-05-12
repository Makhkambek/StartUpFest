import { NextRequest, NextResponse } from 'next/server'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function requireAdmin() {
  if (!hasSupabase) return { ok: true as const }
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Unauthorized' }
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  const isAdmin = profile?.is_admin || user.user_metadata?.role === 'admin'
  if (!isAdmin) return { ok: false as const, status: 403, error: 'Admin only' }
  return { ok: true as const }
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    let query = supabase.from('teams').select('*').order('created_at')
    if (category) query = query.eq('category', category)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { getTeams } = await import('@/lib/mock-store')
  if (category) return NextResponse.json(getTeams(category as 'a' | 'b' | 'c' | 'd'))
  const all = (['a', 'b', 'c', 'd'] as const).flatMap(c => getTeams(c))
  return NextResponse.json(all)
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { name, school, category } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Team name required' }, { status: 400 })
  if (!category || !['a', 'b', 'c', 'd'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: name.trim(), school: school?.trim() ?? '', category })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { addTeam } = await import('@/lib/mock-store')
  return NextResponse.json(addTeam({ name, school: school ?? '', category }))
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { error } = await supabase.from('teams').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { deleteTeam } = await import('@/lib/mock-store')
  deleteTeam(id)
  return NextResponse.json({ ok: true })
}
