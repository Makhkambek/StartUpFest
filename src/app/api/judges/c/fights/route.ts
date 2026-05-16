import { NextRequest, NextResponse } from 'next/server'
import type { FightC } from '@/types/database'
import { getSession } from '@/lib/session'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function GET() {
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('fights_c').select('*').order('created_at')
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
  if (body.team1_id === body.team2_id) return NextResponse.json({ error: 'Teams must be different' }, { status: 400 })
  if (body.notes && body.notes.length > 500) return NextResponse.json({ error: 'Notes max 500 chars' }, { status: 400 })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('fights_c').insert(body).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { addFightC } = await import('@/lib/mock-store')
  return NextResponse.json(addFightC(body))
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.from('fights_c').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  }

  const { deleteFightC } = await import('@/lib/mock-store')
  deleteFightC(id)
  return NextResponse.json({ ok: true })
}
