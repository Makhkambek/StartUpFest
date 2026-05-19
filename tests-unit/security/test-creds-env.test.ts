import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const HELPER = readFileSync(path.join(ROOT, 'tests/helpers/auth.ts'), 'utf8')

describe('tests/helpers/auth.ts: credentials are env-overridable', () => {
  it('each CREDS entry reads from process.env first', () => {
    // Even if the mock-mode default is hardcoded for offline dev convenience,
    // CI runs with non-default secrets should be able to override via env.
    const requiredEnvVars = [
      'SFRC_ADMIN_PASSWORD',
      'SFRC_JUDGE_A1_PASSWORD',
      'SFRC_JUDGE_B1_PASSWORD',
      'SFRC_JUDGE_C1_PASSWORD',
      'SFRC_JUDGE_D1_PASSWORD',
    ]
    for (const v of requiredEnvVars) {
      expect(HELPER, `${v} must be referenced as a possible override in CREDS`).toContain(v)
    }
  })
})
