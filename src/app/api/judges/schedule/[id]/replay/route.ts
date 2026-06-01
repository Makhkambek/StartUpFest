import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
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

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: match, error: fetchErr } = await supabase
      .from('scheduled_matches')
      .select('id, category, status, team1_id, team2_id')
      .eq('id', id)
      .eq('city_code', cityCode)
      .maybeSingle()

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    const { requireCategory } = await import('@/lib/session')
    const authz = await requireCategory(match.category)
    if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

    const table = RESULT_TABLE[match.category]
    if (!table) return NextResponse.json({ error: 'Unknown category' }, { status: 400 })

    // Admin client bypasses RLS for result deletion.
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminSupabase = createAdminClient()

    // Delete by scheduled_match_id (normal case).
    await adminSupabase.from(table).delete().eq('scheduled_match_id', id)

    // Delete orphaned results (scheduled_match_id=NULL) matching the same team pair —
    // these arise when FK ON DELETE SET NULL fires before the app-level delete runs.
    if (match.team1_id && match.team2_id) {
      await adminSupabase.from(table).delete()
        .is('scheduled_match_id', null)
        .or(`and(team1_id.eq.${match.team1_id},team2_id.eq.${match.team2_id}),and(team1_id.eq.${match.team2_id},team2_id.eq.${match.team1_id})`)
    }

    // Reset match status to pending
    const { error: patchErr } = await supabase
      .from('scheduled_matches')
      .update({ status: 'pending' })
      .eq('id', id)

    if (patchErr) return NextResponse.json({ error: patchErr.message }, { status: 500 })

    revalidateTag(`standings-${match.category}`, {})
    return NextResponse.json({ ok: true })
  }

  // Mock mode — just reset status
  const { getMatchById, setMatchStatus } = await import('@/lib/schedule-store')
  const match = getMatchById(id)
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  setMatchStatus(id, 'pending')
  revalidateTag(`standings-${match.category}`, {})
  return NextResponse.json({ ok: true })
}
