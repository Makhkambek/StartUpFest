import { createClient } from '@supabase/supabase-js'

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export async function getActiveCityCode(): Promise<string> {
  if (!hasSupabase) return 'TSH'
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data } = await supabase
    .from('event_settings').select('city_code').eq('id', 1).single()
  return data?.city_code ?? 'TSH'
}
