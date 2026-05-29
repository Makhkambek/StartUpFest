import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireAdmin } from '@/lib/session'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')
  if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 })

  const authz = await requireSession()
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('scheduled_matches')
      .select('*')
      .eq('category', category)
      .eq('city_code', cityCode)
      .order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { getSchedule } = await import('@/lib/schedule-store')
  return NextResponse.json(getSchedule(category))
}

export async function POST(req: NextRequest) {
  const authz = await requireAdmin()
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const body = await req.json() as {
    category: string
    match_id: string
    team1_id: string
    team2_id: string | null
  }
  if (!body.category || !body.match_id || !body.team1_id) {
    return NextResponse.json({ error: 'category, match_id, team1_id required' }, { status: 400 })
  }
  // Cat A allows solo (team2_id = null). Others require team2 to differ.
  if (body.team2_id && body.team1_id === body.team2_id) {
    return NextResponse.json({ error: 'Teams must differ' }, { status: 400 })
  }

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('scheduled_matches')
      .insert({ ...body, city_code: cityCode }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { addScheduledMatch } = await import('@/lib/schedule-store')
  return NextResponse.json(addScheduledMatch({
    category: body.category,
    match_id: body.match_id,
    team1_id: body.team1_id,
    team2_id: body.team2_id ?? null,
  }))
}

export async function DELETE(req: NextRequest) {
  const authz = await requireAdmin()
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const body = await req.json() as { id?: string; category?: string; all?: boolean }

  if (body.all && body.category) {
    if (hasSupabase) {
      const cityCode = await getActiveCityCode()
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      await supabase.from('scheduled_matches').delete()
        .eq('category', body.category).eq('city_code', cityCode)
      return NextResponse.json({ ok: true })
    }
    const { clearSchedule } = await import('@/lib/schedule-store')
    clearSchedule(body.category)
    return NextResponse.json({ ok: true })
  }

  const id = body.id
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.from('scheduled_matches').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  }

  const { deleteScheduledMatch } = await import('@/lib/schedule-store')
  deleteScheduledMatch(id)
  return NextResponse.json({ ok: true })
}
