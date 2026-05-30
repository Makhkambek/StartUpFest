import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const RESULT_TABLE: Record<string, string> = {
  a: 'results_a',
  b: 'matches_b',
  c: 'fights_c',
  d: 'matches_d',
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const authz = await requireAdmin()
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Fetch the scheduled match to get its category
    const { data: match, error: fetchErr } = await supabase
      .from('scheduled_matches')
      .select('id, category, status')
      .eq('id', id)
      .eq('city_code', cityCode)
      .maybeSingle()

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    const table = RESULT_TABLE[match.category]
    if (!table) return NextResponse.json({ error: 'Unknown category' }, { status: 400 })

    // Delete result linked to this scheduled match
    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .eq('scheduled_match_id', id)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    // Reset match status to pending
    const { error: patchErr } = await supabase
      .from('scheduled_matches')
      .update({ status: 'pending' })
      .eq('id', id)

    if (patchErr) return NextResponse.json({ error: patchErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  }

  // Mock mode — just reset status (results aren't linked by scheduled_match_id in mock)
  const { getMatchById, setMatchStatus } = await import('@/lib/schedule-store')
  const match = getMatchById(id)
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  setMatchStatus(id, 'pending')
  return NextResponse.json({ ok: true })
}
