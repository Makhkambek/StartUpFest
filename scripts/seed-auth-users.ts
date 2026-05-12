/**
 * Run once to create all judge auth accounts in Supabase.
 * Usage: npx tsx scripts/seed-auth-users.ts
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceKey) {
  console.error('Missing env vars. Run with .env.local loaded.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERS = [
  { username: 'admin',    password: 'admin',           role: 'admin', categories: ['a','b','c','d'] },
  { username: 'judge_a1', password: 'Line@Track#2026', role: 'judge', categories: ['a'] },
  { username: 'judge_a2', password: 'Fast@Racer#2026', role: 'judge', categories: ['a'] },
  { username: 'judge_b1', password: 'Sumo@Ring#2026',  role: 'judge', categories: ['b'] },
  { username: 'judge_b2', password: 'Push@Bull#2026',  role: 'judge', categories: ['b'] },
  { username: 'judge_c1', password: 'War@Bot#2026',    role: 'judge', categories: ['c'] },
  { username: 'judge_c2', password: 'Fight@KO#2026',   role: 'judge', categories: ['c'] },
  { username: 'judge_d1', password: 'Goal@Kick#2026',  role: 'judge', categories: ['d'] },
  { username: 'judge_d2', password: 'Robo@FC#2026',    role: 'judge', categories: ['d'] },
]

async function main() {
  for (const u of USERS) {
    const email = `${u.username}@sfrc.local`
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username, role: u.role, categories: u.categories },
    })
    if (error) {
      if (error.message.includes('already been registered')) {
        console.log(`⚠  ${u.username} already exists — skipped`)
      } else {
        console.error(`✗  ${u.username}: ${error.message}`)
      }
    } else {
      console.log(`✓  ${u.username} created (${data.user?.id})`)
    }
  }
}

main()
