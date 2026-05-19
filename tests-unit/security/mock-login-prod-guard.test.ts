import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const LOGIN = readFileSync(
  path.join(ROOT, 'src/app/api/auth/login/route.ts'),
  'utf8',
)

describe('mock-login: production guard', () => {
  it('explicitly refuses mock fallback in production', () => {
    // Must contain a string identifying the refusal — keyword check on the
    // exact message we ship so tests catch silent removal.
    expect(
      LOGIN,
      'login route must refuse mock auth in production with a clear error',
    ).toMatch(/Mock login disabled in production|Auth not configured/)
  })

  it('the production guard checks both NODE_ENV and Supabase config', () => {
    // The guard should be `process.env.NODE_ENV === 'production' && !hasSupabase`
    // (or equivalent). Just searching for both tokens is brittle but catches
    // accidental removal of either condition.
    const guardBlock = LOGIN.match(
      /process\.env\.NODE_ENV[\s\S]{0,80}===\s*['"]production['"][\s\S]{0,200}/,
    )
    expect(guardBlock, 'guard block referencing NODE_ENV=production not found').not.toBeNull()
    expect(guardBlock![0], 'guard block must also reference hasSupabase').toMatch(/hasSupabase|SUPABASE_URL/)
  })
})
