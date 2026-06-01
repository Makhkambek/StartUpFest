import { createClient } from '@supabase/supabase-js'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

let _cached: string | null = null
let _cacheExpiry = 0

export async function getActiveCityCode(): Promise<string> {
  if (!hasSupabase) return 'TSH'
  if (_cached && Date.now() < _cacheExpiry) return _cached
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data } = await supabase
    .from('event_settings').select('city_code').eq('id', 1).single()
  _cached = (data?.city_code as string | null) ?? 'TSH'
  _cacheExpiry = Date.now() + 60_000  // 60s — city code never changes mid-event
  return _cached
}
