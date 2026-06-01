import { NextRequest, NextResponse } from 'next/server'
import { requireCategory } from '@/lib/session'
import { getActiveCityCode } from '@/lib/get-active-city-code'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// PATCH { captain_id, partner_id } — set the partner slot for a finalist captain
// across all Cat D finals scheduled matches.
export async function PATCH(req: NextRequest) {
  const authz = await requireCategory('d')
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const { captain_id, partner_id } = await req.json() as { captain_id: string; partner_id: string | null }
  if (!captain_id) return NextResponse.json({ error: 'captain_id required' }, { status: 400 })

  if (hasSupabase) {
    const cityCode = await getActiveCityCode()
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: finals, error } = await supabase
      .from('scheduled_matches')
      .select('id, team1_id, team2_id')
      .eq('category', 'd')
      .eq('city_code', cityCode)
      .eq('phase', 'finals')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const updates = (finals ?? []).map(m => {
      if (m.team1_id === captain_id) return supabase.from('scheduled_matches').update({ team1b_id: partner_id }).eq('id', m.id)
      if (m.team2_id === captain_id) return supabase.from('scheduled_matches').update({ team2b_id: partner_id }).eq('id', m.id)
      return null
    }).filter(Boolean)

    await Promise.all(updates)
    return NextResponse.json({ ok: true })
  }

  const { setMatchPartnerD } = await import('@/lib/schedule-store')
  setMatchPartnerD('d', captain_id, partner_id)
  return NextResponse.json({ ok: true })
}
