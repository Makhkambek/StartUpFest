import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

const FORBIDDEN_PWDS = [
  "'admin'",
  "'admin1'",
  "'Line@Track#2026'",
  "'Fast@Racer#2026'",
  "'Sumo@Ring#2026'",
  "'Push@Bull#2026'",
  "'War@Bot#2026'",
  "'Fight@KO#2026'",
  "'Goal@Kick#2026'",
  "'Robo@FC#2026'",
]

describe('no hardcoded credentials in repo', () => {
  it.each([
    'scripts/seed-auth-users.ts',
    'scripts/reset-passwords.ts',
  ])('%s contains no plaintext passwords', (rel) => {
    const src = readFileSync(path.join(ROOT, rel), 'utf8')
    for (const pwd of FORBIDDEN_PWDS) {
      expect(src, `${rel} must not contain ${pwd}`).not.toContain(pwd)
    }
  })

  it('AGENTS.md has no plaintext credentials block', () => {
    const md = readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8')
    expect(md, 'AGENTS.md must not contain judge_a1 / password pattern').not.toMatch(
      /judge_[abcd][12]\s*\/\s*\S+@/i,
    )
    expect(md, 'AGENTS.md must not contain admin / admin pattern').not.toMatch(
      /admin\s*\/\s*admin1?\b/i,
    )
  })
})
