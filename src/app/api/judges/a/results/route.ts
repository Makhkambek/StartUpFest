import { NextRequest, NextResponse } from 'next/server'
import type { ResultA } from '@/types/database'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function GET() {
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('results_a').select('*')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
  const { getTeams, getResultsA } = await import('@/lib/mock-store')
  const teams = getTeams('a')
  return NextResponse.json(getResultsA(teams.map(t => t.id)))
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    team_id: string
    run1: number | null
    run2: number | null
    penalty: ResultA['penalty']
  }

  if (!body.team_id) return NextResponse.json({ error: 'team_id required' }, { status: 400 })

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
      .upsert({ ...body, total, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { upsertResultA } = await import('@/lib/mock-store')
  return NextResponse.json(upsertResultA(body))
}
