import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import type { FightC } from '@/types/database'
import { getSession, requireCategory } from '@/lib/session'
import { isUuid } from '@/lib/uuid'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function GET() {
  const authz = await requireCategory('c')
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('fights_c').select('*')
      .eq('city_code', cityCode).order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
  const { getFightsC } = await import('@/lib/mock-store')
  return NextResponse.json(getFightsC())
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.categories.includes('c')) return NextResponse.json({ error: 'Not assigned to category C' }, { status: 403 })

  const body = await req.json() as {
    team1_id: string; team2_id: string
    winner: 1 | 2; method: FightC['method']
    judge_score1: number; judge_score2: number
    fight_number?: number | null
    notes?: string | null
  }
  if (!body.team1_id || !body.team2_id) return NextResponse.json({ error: 'Both teams required' }, { status: 400 })
  if (!isUuid(body.team1_id) || !isUuid(body.team2_id)) {
    return NextResponse.json({ error: 'team1_id/team2_id must be valid UUIDs' }, { status: 400 })
  }
  if (body.team1_id === body.team2_id) return NextResponse.json({ error: 'Teams must be different' }, { status: 400 })
  if (body.notes && body.notes.length > 500) return NextResponse.json({ error: 'Notes max 500 chars' }, { status: 400 })
  if (![1, 2].includes(body.winner)) {
    return NextResponse.json({ error: 'winner must be 1 or 2' }, { status: 400 })
  }
  if (!['KO', 'IMM', 'JD'].includes(body.method)) {
    return NextResponse.json({ error: 'method must be KO, IMM, or JD' }, { status: 400 })
  }
  const validScore = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100
  if (!validScore(body.judge_score1) || !validScore(body.judge_score2)) {
    return NextResponse.json({ error: 'judge_score1/2 must be numbers in [0, 100]' }, { status: 400 })
  }

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const row = {
      team1_id: body.team1_id,
      team2_id: body.team2_id,
      winner: body.winner,
      method: body.method,
      judge_score1: body.judge_score1,
      judge_score2: body.judge_score2,
      fight_number: body.fight_number ?? null,
      city_code: cityCode,
      notes: body.notes ?? null,
    }
    const { data, error } = await supabase.from('fights_c').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    revalidateTag('standings-c', {})
    return NextResponse.json(data)
  }

  const { addFightC } = await import('@/lib/mock-store')
  revalidateTag('standings-c', {})
  return NextResponse.json(addFightC(body))
}

export async function DELETE(req: NextRequest) {
  const authz = await requireCategory('c')
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.from('fights_c').delete().eq('id', id)
    revalidateTag('standings-c', {})
    return NextResponse.json({ ok: true })
  }

  const { deleteFightC } = await import('@/lib/mock-store')
  revalidateTag('standings-c', {})
  deleteFightC(id)
  return NextResponse.json({ ok: true })
}
