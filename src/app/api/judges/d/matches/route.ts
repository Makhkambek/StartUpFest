import { NextRequest, NextResponse } from 'next/server'
import type { MatchD } from '@/types/database'
import { getSession, requireCategory } from '@/lib/session'
import { isUuid } from '@/lib/uuid'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function GET() {
  const authz = await requireCategory('d')
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('matches_d').select('*')
      .eq('city_code', cityCode).order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
  const { getMatchesD } = await import('@/lib/mock-store')
  return NextResponse.json(getMatchesD())
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.categories.includes('d')) return NextResponse.json({ error: 'Not assigned to category D' }, { status: 403 })

  const body = await req.json() as {
    team1_id: string; team1b_id?: string | null
    team2_id: string; team2b_id?: string | null
    goals1: number; goals2: number
    team1_forfeit?: boolean; team1b_forfeit?: boolean
    team2_forfeit?: boolean; team2b_forfeit?: boolean
    match_number?: number | null
    match_phase?: MatchD['match_phase']
    notes?: string | null
  }
  if (!body.team1_id || !body.team2_id) return NextResponse.json({ error: 'Both teams required' }, { status: 400 })
  if (!isUuid(body.team1_id) || !isUuid(body.team2_id)) {
    return NextResponse.json({ error: 'team1_id/team2_id must be valid UUIDs' }, { status: 400 })
  }
  if (body.team1b_id && !isUuid(body.team1b_id)) return NextResponse.json({ error: 'team1b_id must be a valid UUID' }, { status: 400 })
  if (body.team2b_id && !isUuid(body.team2b_id)) return NextResponse.json({ error: 'team2b_id must be a valid UUID' }, { status: 400 })
  if (body.team1_id === body.team2_id) return NextResponse.json({ error: 'Teams must be different' }, { status: 400 })
  if (body.notes && body.notes.length > 500) return NextResponse.json({ error: 'Notes max 500 chars' }, { status: 400 })
  const validGoals = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 99
  if (!validGoals(body.goals1) || !validGoals(body.goals2)) {
    return NextResponse.json({ error: 'goals1/goals2 must be non-negative integers ≤ 99' }, { status: 400 })
  }

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const row = {
      team1_id: body.team1_id,
      team1b_id: body.team1b_id ?? null,
      team2_id: body.team2_id,
      team2b_id: body.team2b_id ?? null,
      goals1: body.goals1,
      goals2: body.goals2,
      team1_forfeit: body.team1_forfeit ?? false,
      team1b_forfeit: body.team1b_forfeit ?? false,
      team2_forfeit: body.team2_forfeit ?? false,
      team2b_forfeit: body.team2b_forfeit ?? false,
      match_number: body.match_number ?? null,
      match_phase: body.match_phase ?? 'group',
      city_code: cityCode,
      notes: body.notes ?? null,
    }
    const { data, error } = await supabase.from('matches_d').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { addMatchD } = await import('@/lib/mock-store')
  return NextResponse.json(addMatchD(body))
}

export async function DELETE(req: NextRequest) {
  const authz = await requireCategory('d')
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.from('matches_d').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  }

  const { deleteMatchD } = await import('@/lib/mock-store')
  deleteMatchD(id)
  return NextResponse.json({ ok: true })
}
