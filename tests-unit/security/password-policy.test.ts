import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const ADMIN_USERS = readFileSync(
  path.join(ROOT, 'src/app/api/admin/users/route.ts'),
  'utf8',
)
const USERS_CONFIG = readFileSync(
  path.join(ROOT, 'scripts/_users-config.ts'),
  'utf8',
)

describe('password policy: minimum 12 characters', () => {
  it('admin/users POST rejects passwords below 12 chars', () => {
    // POST handler validates with password.length < 12 (or >= 12)
    expect(ADMIN_USERS).toMatch(/password\.length\s*<\s*12/)
    // Error string must communicate the new requirement
    expect(ADMIN_USERS).toMatch(/Password min 12 chars/)
  })

  it('admin/users PATCH rejects passwords below 12 chars', () => {
    // Both POST and PATCH must enforce the same minimum
    const occurrences = ADMIN_USERS.match(/password\.length\s*<\s*12/g) ?? []
    expect(occurrences.length, 'expected at least two `password.length < 12` checks (POST + PATCH)').toBeGreaterThanOrEqual(2)
  })

  it('scripts/_users-config.ts enforces matching min length', () => {
    expect(USERS_CONFIG).toMatch(/length\s*<\s*12/)
  })

  it('no `password.length < 8` checks remain in admin/users', () => {
    expect(ADMIN_USERS).not.toMatch(/password\.length\s*<\s*8\b/)
  })
})
