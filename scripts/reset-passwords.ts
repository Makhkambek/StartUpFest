import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const USERS = [
  { username: 'admin',    password: 'admin' },
  { username: 'judge_a1', password: 'Line@Track#2026' },
  { username: 'judge_a2', password: 'Fast@Racer#2026' },
  { username: 'judge_b1', password: 'Sumo@Ring#2026' },
  { username: 'judge_b2', password: 'Push@Bull#2026' },
  { username: 'judge_c1', password: 'War@Bot#2026' },
  { username: 'judge_c2', password: 'Fight@KO#2026' },
  { username: 'judge_d1', password: 'Goal@Kick#2026' },
  { username: 'judge_d2', password: 'Robo@FC#2026' },
]

async function main() {
  const { data: { users } } = await supabase.auth.admin.listUsers()
  for (const u of USERS) {
    const email = `${u.username}@sfrc.local`
    const existing = users.find(x => x.email === email)
    if (!existing) { console.log(`✗ ${u.username} not found`); continue }
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password: u.password })
    if (error) console.error(`✗ ${u.username}: ${error.message}`)
    else console.log(`✓ ${u.username} password reset`)
  }
}

main()
