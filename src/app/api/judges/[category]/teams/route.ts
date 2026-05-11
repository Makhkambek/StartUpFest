import { NextRequest, NextResponse } from 'next/server'
import type { Category } from '@/types/database'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const VALID: Category[] = ['a', 'b', 'c', 'd']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  if (!VALID.includes(category as Category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('teams').select('*').eq('category', category).order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { getTeams } = await import('@/lib/mock-store')
  return NextResponse.json(getTeams(category))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  if (!VALID.includes(category as Category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })

  const { name, school } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Team name required' }, { status: 400 })

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
