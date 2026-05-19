import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { UZ_CITIES } from '@/lib/cities'
import type { EventSettings } from '@/types/database'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const VALID_CODES = new Set(UZ_CITIES.map((c) => c.code))

// GET: public. Field displays / PDFs fetch the current settings.
export async function GET() {
  if (hasSupabase) {
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data } = await supabase
        .from('event_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()
      if (data) return NextResponse.json(data)
      // Migration not applied yet — return the default so consumers don't break.
      return NextResponse.json(defaultSettings(), { headers: { 'X-Migration-Missing': '1' } })
    } catch {
      return NextResponse.json(defaultSettings(), { headers: { 'X-Migration-Missing': '1' } })
    }
  }
  const { getEventSettings } = await import('@/lib/mock-store')
  return NextResponse.json(getEventSettings())
}

// PUT: admin only. Updates city_code / year / event_name.
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json().catch(() => null) as Partial<EventSettings> | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const patch: Partial<Omit<EventSettings, 'id' | 'updated_at'>> = {}
  if (typeof body.city_code === 'string') {
    if (!VALID_CODES.has(body.city_code)) {
      return NextResponse.json({ error: `Unknown city_code "${body.city_code}"` }, { status: 400 })
    }
    patch.city_code = body.city_code
  }
  if (typeof body.year === 'number' && Number.isInteger(body.year) && body.year >= 2024 && body.year <= 2099) {
    patch.year = body.year
  } else if (body.year !== undefined) {
    return NextResponse.json({ error: 'year must be integer 2024..2099' }, { status: 400 })
  }
  if (body.event_name === null || typeof body.event_name === 'string') {
    patch.event_name = body.event_name
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (hasSupabase) {
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('event_settings')
        .upsert({ id: 1, ...patch }, { onConflict: 'id' })
        .select()
        .single()
      if (error || !data) return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
      return NextResponse.json(data)
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
  }

  const { setEventSettings } = await import('@/lib/mock-store')
  return NextResponse.json(setEventSettings(patch))
}

function defaultSettings(): EventSettings {
  return {
    id: 1,
    city_code: 'TSH',
    year: new Date().getFullYear(),
    event_name: null,
    updated_at: new Date(0).toISOString(),
  }
}
