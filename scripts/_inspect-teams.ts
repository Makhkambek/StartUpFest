import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  const { data: events } = await supabase.from('events').select('id, city_code, year, name, status, created_at').order('created_at')
  console.log('\n=== EVENTS ===')
  for (const e of events ?? []) console.log(`${e.id}  ${e.city_code} ${e.year}  [${e.status}]  ${e.name ?? ''}`)

  const { data: teams } = await supabase.from('teams').select('id, category, name, event_id, created_at').order('category').order('created_at')
  const all = teams ?? []
  const tests = all.filter(t => (t.name ?? '').startsWith('[TEST]'))
  console.log(`\n=== TEAMS total=${all.length}  [TEST]=${tests.length} ===`)

  const byCatAll: Record<string, number> = {}
  for (const t of all) byCatAll[t.category] = (byCatAll[t.category] ?? 0) + 1
  console.log('All teams by category:', byCatAll)

  const byCatTest: Record<string, number> = {}
  for (const t of tests) byCatTest[t.category] = (byCatTest[t.category] ?? 0) + 1
  console.log('[TEST] teams by category:', byCatTest)

  // event_id distribution of [TEST] teams
  const byEvent: Record<string, number> = {}
  for (const t of tests) { const k = t.event_id ?? 'NULL'; byEvent[k] = (byEvent[k] ?? 0) + 1 }
  console.log('[TEST] teams by event_id:', byEvent)

  // per (event, category)
  const byEventCat: Record<string, number> = {}
  for (const t of tests) { const k = `${t.event_id ?? 'NULL'} / ${t.category}`; byEventCat[k] = (byEventCat[k] ?? 0) + 1 }
  console.log('[TEST] teams by event/category:', byEventCat)

  // non-test teams (real, user-added)
  const real = all.filter(t => !(t.name ?? '').startsWith('[TEST]'))
  console.log(`\nNon-[TEST] teams: ${real.length}`)
  for (const t of real) console.log(`  ${t.category}  ${t.name}  (event=${t.event_id ?? 'NULL'})`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
