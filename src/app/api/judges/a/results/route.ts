import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import type { ResultA } from '@/types/database'
import { requireCategory } from '@/lib/session'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function GET() {
  const authz = await requireCategory('a')
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })
  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('results_a').select('*').eq('city_code', cityCode)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
  const { getResultsA } = await import('@/lib/mock-store')
  return NextResponse.json(getResultsA())
}

export async function POST(req: NextRequest) {
  const authz = await requireCategory('a')
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const body = await req.json() as {
    scheduled_match_id: string
    team_id: string
    run1: number | null
    run2: number | null
    penalty: ResultA['penalty']
    run_phase?: ResultA['run_phase']
    notes?: string | null
  }

  if (!body.scheduled_match_id) return NextResponse.json({ error: 'scheduled_match_id required' }, { status: 400 })
  if (!body.team_id) return NextResponse.json({ error: 'team_id required' }, { status: 400 })
  if (body.notes && body.notes.length > 500) return NextResponse.json({ error: 'Notes max 500 chars' }, { status: 400 })

  // Penalty must be one of the documented enum values (no implicit fallthrough
  // to 0 like the legacy code did).
  if (!['0', '10', '20', '40', '50', 'dnf', 'disq'].includes(body.penalty)) {
    return NextResponse.json({ error: 'Invalid penalty value' }, { status: 400 })
  }
  // run1 = raw laser time; penalties are stored separately and added here.
  const validRun = (v: number | null) =>
    v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 600)
  if (!validRun(body.run1)) {
    return NextResponse.json({ error: 'run1 must be null or a number in [0, 600]' }, { status: 400 })
  }

  const PENALTY_SEC: Record<string, number> = { '10': 10, '20': 20, '40': 40, '50': 50 }
  const penaltySec = PENALTY_SEC[body.penalty] ?? 0
  const total = body.penalty === 'dnf' || body.penalty === 'disq'
    ? null
    : body.run1 !== null ? body.run1 + penaltySec : null

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const row = {
      scheduled_match_id: body.scheduled_match_id,
      team_id: body.team_id,
      run1: body.run1,
      run2: body.run2,
      penalty: body.penalty,
      run_phase: body.run_phase ?? 'qualification',
      notes: body.notes ?? null,
      total,
      city_code: cityCode,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('results_a')
      .upsert(row, { onConflict: 'scheduled_match_id' })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    revalidateTag('standings-a', {})
    return NextResponse.json(data)
  }

  const { upsertResultA } = await import('@/lib/mock-store')
  revalidateTag('standings-a', {})
  return NextResponse.json(upsertResultA(body))
}

export async function DELETE(req: NextRequest) {
  const authz = await requireCategory('a')
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const { scheduled_match_id } = await req.json()
  if (!scheduled_match_id) return NextResponse.json({ error: 'scheduled_match_id required' }, { status: 400 })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { error } = await supabase.from('results_a').delete().eq('scheduled_match_id', scheduled_match_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    revalidateTag('standings-a', {})
    return NextResponse.json({ ok: true })
  }

  const { deleteResultA } = await import('@/lib/mock-store')
  revalidateTag('standings-a', {})
  deleteResultA(scheduled_match_id)
  return NextResponse.json({ ok: true })
}
