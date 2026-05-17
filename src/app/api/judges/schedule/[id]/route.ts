import { NextRequest, NextResponse } from 'next/server'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function requireAdmin() {
  const { getSession } = await import('@/lib/session')
  const session = await getSession()
  if (!session) return { ok: false as const, status: 401, error: 'Unauthorized' }
  if (session.role !== 'admin') return { ok: false as const, status: 403, error: 'Admin only' }
  return { ok: true as const }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.from('scheduled_matches').select('*').eq('id', id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  }
  const { getMatchById } = await import('@/lib/schedule-store')
  const m = getMatchById(id)
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(m)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as {
    status?: string
    team1_id?: string
    team2_id?: string | null
  }

  const updates: Record<string, unknown> = {}

  if (body.status !== undefined) {
    if (!['pending', 'waiting', 'active', 'completed'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
  }

  // Team overrides — admin only (e.g. roll back wrong auto-advance pick)
  if (body.team1_id !== undefined || body.team2_id !== undefined) {
    const guard = await requireAdmin()
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
    if (body.team1_id !== undefined) {
      if (!body.team1_id) return NextResponse.json({ error: 'team1_id required' }, { status: 400 })
      updates.team1_id = body.team1_id
    }
    if (body.team2_id !== undefined) {
      updates.team2_id = body.team2_id // may be null for solo Cat A
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  if (hasSupabase) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { error } = await supabase.from('scheduled_matches').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { setMatchStatus, getMatchById } = await import('@/lib/schedule-store')
  if (updates.status) setMatchStatus(id, updates.status as 'pending' | 'waiting' | 'active' | 'completed')
  // Mock store doesn't currently support team updates — add minimal inline mutation
  if (updates.team1_id !== undefined || updates.team2_id !== undefined) {
    const m = getMatchById(id)
    if (m) {
      if (updates.team1_id !== undefined) m.team1_id = updates.team1_id as string
      if (updates.team2_id !== undefined) m.team2_id = updates.team2_id as string | null
    }
  }
  return NextResponse.json({ ok: true })
}
