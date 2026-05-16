import { NextRequest, NextResponse } from 'next/server'
import type { ResultA } from '@/types/database'
import { getSession } from '@/lib/session'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function GET() {
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('results_a').select('*')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
  const { getResultsA } = await import('@/lib/mock-store')
  return NextResponse.json(getResultsA())
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.categories.includes('a')) return NextResponse.json({ error: 'Not assigned to category A' }, { status: 403 })

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

  const penaltySec = body.penalty === '20' ? 20 : body.penalty === '40' ? 40 : 0
  const runs = [body.run1, body.run2].filter((v): v is number => v !== null)
  const best = runs.length ? Math.min(...runs) : null
  const total = body.penalty === 'dnf' || body.penalty === 'disq'
    ? null
    : best !== null ? best + penaltySec : null

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('results_a')
      .upsert({ ...body, total, updated_at: new Date().toISOString() }, { onConflict: 'scheduled_match_id' })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { upsertResultA } = await import('@/lib/mock-store')
  return NextResponse.json(upsertResultA(body))
}

export async function DELETE(req: NextRequest) {
  const { scheduled_match_id } = await req.json()
  if (!scheduled_match_id) return NextResponse.json({ error: 'scheduled_match_id required' }, { status: 400 })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { error } = await supabase.from('results_a').delete().eq('scheduled_match_id', scheduled_match_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { deleteResultA } = await import('@/lib/mock-store')
  deleteResultA(scheduled_match_id)
  return NextResponse.json({ ok: true })
}
