/**
 * Resets passwords for all judge auth accounts in Supabase.
 * Usage: npx tsx --env-file=.env.local scripts/reset-passwords.ts
 *
 * Required env vars: SFRC_ADMIN_PASSWORD, SFRC_JUDGE_{A,B,C,D}{1,2}_PASSWORD
 * (each >=12 chars). See .env.local.example.
 */
import { createClient } from '@supabase/supabase-js'
import { loadJudgeUsers } from './_users-config'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const users = loadJudgeUsers()
  const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers()
  for (const u of users) {
    const email = `${u.username}@sfrc.local`
    const existing = existingUsers.find(x => x.email === email)
    if (!existing) {
      console.log(`x ${u.username} not found`)
      continue
    }
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password: u.password })
    if (error) console.error(`x ${u.username}: ${error.message}`)
    else console.log(`+ ${u.username} password reset`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
