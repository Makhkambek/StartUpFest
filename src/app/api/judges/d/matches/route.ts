import { NextRequest, NextResponse } from 'next/server'
import type { MatchD } from '@/types/database'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function GET() {
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('matches_d').select('*').order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
  const { getMatchesD } = await import('@/lib/mock-store')
  return NextResponse.json(getMatchesD())
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    team1_id: string; team2_id: string
    goals1: number; goals2: number
    match_number?: number | null
    match_phase?: MatchD['match_phase']
    notes?: string | null
  }
  if (!body.team1_id || !body.team2_id) return NextResponse.json({ error: 'Both teams required' }, { status: 400 })
  if (body.team1_id === body.team2_id) return NextResponse.json({ error: 'Teams must be different' }, { status: 400 })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('matches_d').insert(body).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { addMatchD } = await import('@/lib/mock-store')
  return NextResponse.json(addMatchD(body))
}

export async function DELETE(req: NextRequest) {
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
