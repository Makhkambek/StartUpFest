import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const CATEGORY_TABLE: Record<string, string> = {
  a: 'results_a',
  b: 'matches_b',
  c: 'fights_c',
  d: 'matches_d',
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { category } = (await req.json()) as { category?: string }
  if (!category || !['a', 'b', 'c', 'd'].includes(category)) {
    return NextResponse.json({ error: 'category must be a, b, c, or d' }, { status: 400 })
  }

  if (hasSupabase) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set — cannot bypass RLS to delete results' }, { status: 500 })
    }
    const cityCode = await getActiveCityCode()
    // Use service-role client to bypass RLS — admin-only endpoint, already guarded above.
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()

    const table = CATEGORY_TABLE[category]
    // results_a uses team_id as PK (no `id` column); all other tables use `id`.
    const pkCol = category === 'a' ? 'team_id' : 'id'
    const { data: deleted, error: delErr } = await supabase.from(table).delete().eq('city_code', cityCode).select(pkCol)
    if (delErr) return NextResponse.json({ error: `delete ${table}: ${delErr.message}` }, { status: 500 })

    const { data: schedUpd, error: schedErr } = await supabase
      .from('scheduled_matches')
      .update({ status: 'pending', result_id: null })
      .eq('category', category)
      .eq('city_code', cityCode)
      .select('id')
    if (schedErr) return NextResponse.json({ error: `reset schedule: ${schedErr.message}` }, { status: 500 })

    const { error: liveErr } = await supabase
      .from('live_match_state')
      .update({
        active_match_id: null,
        phase: 'idle',
        round_number: 1,
        wins_red: 0,
        wins_white: 0,
        starting_position: null,
        last_round_winner: null,
        match_winner: null,
        countdown_started_at: null,
        fight_started_at: null,
        fouls_red: 0,
        fouls_white: 0,
        round_history: [],
      })
      .eq('category', category)
      .eq('city_code', cityCode)
    if (liveErr) return NextResponse.json({ error: `reset live: ${liveErr.message}` }, { status: 500 })

    return NextResponse.json({
      ok: true,
      category,
      city_code: cityCode,
      deleted_results: deleted?.length ?? 0,
      reset_scheduled: schedUpd?.length ?? 0,
    })
  }

  // Mock mode
  const { clearResultsForCategory } = await import('@/lib/mock-store')
  clearResultsForCategory(category)

  const { resetScheduleStatuses } = await import('@/lib/schedule-store')
  resetScheduleStatuses(category)

  return NextResponse.json({ ok: true, category, city_code: 'MOCK' })
}
