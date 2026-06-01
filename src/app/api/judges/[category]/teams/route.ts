import { NextRequest, NextResponse } from 'next/server'
import type { Category } from '@/types/database'
import { requireSession, requireCategory } from '@/lib/session'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const VALID: Category[] = ['a', 'b', 'c', 'd']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  if (!VALID.includes(category as Category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })

  const authz = await requireSession()
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('teams').select('*')
      .eq('category', category).eq('city_code', cityCode).order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { getTeams } = await import('@/lib/mock-store')
  return NextResponse.json(getTeams(category))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  if (!VALID.includes(category as Category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })

  const authz = await requireCategory(category)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const { name, school } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Team name required' }, { status: 400 })

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: name.trim(), school: school?.trim() ?? '', category, city_code: cityCode })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { addTeam } = await import('@/lib/mock-store')
  return NextResponse.json(addTeam({ name, school: school ?? '', category }))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const authz = await requireCategory(category)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // alliance_name update (Cat D)
  if ('alliance_name' in body) {
    const alliance_name: string | null = body.alliance_name ?? null
    if (hasSupabase) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { error } = await supabase.from('teams').update({ alliance_name }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    const { updateTeamAllianceName } = await import('@/lib/mock-store')
    updateTeamAllianceName(id, alliance_name)
    return NextResponse.json({ ok: true })
  }

  // group_letter update
  const { group_letter } = body
  const validGroups = ['A', 'B', 'C', 'D', 'E', 'F', null]
  if (!validGroups.includes(group_letter)) return NextResponse.json({ error: 'group_letter must be A–F or null' }, { status: 400 })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { error } = await supabase.from('teams').update({ group_letter }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { updateTeamGroup } = await import('@/lib/mock-store')
  updateTeamGroup(id, group_letter)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const authz = await requireCategory(category)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

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
