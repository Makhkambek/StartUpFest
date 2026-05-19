/**
 * Run once to create all judge auth accounts in Supabase.
 * Usage: npx tsx --env-file=.env.local scripts/seed-auth-users.ts
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
  for (const u of users) {
    const email = `${u.username}@sfrc.local`
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username, role: u.role, categories: u.categories },
    })
    if (error) {
      if (error.message.includes('already been registered')) {
        console.log(`-  ${u.username} already exists - skipped`)
      } else {
        console.error(`x  ${u.username}: ${error.message}`)
      }
    } else {
      console.log(`+  ${u.username} created (${data.user?.id})`)
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
