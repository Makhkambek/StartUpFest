import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

const ROUTES_WITH_USER_INPUT_WRITES = [
  'src/app/api/judges/b/matches/route.ts',
  'src/app/api/judges/c/fights/route.ts',
  'src/app/api/judges/d/matches/route.ts',
  'src/app/api/judges/a/results/route.ts',
]

describe('mass-assignment: routes must not forward raw JSON to .insert/.upsert', () => {
  for (const rel of ROUTES_WITH_USER_INPUT_WRITES) {
    it(`${rel} does not call .insert(body) or .upsert({...body}) with the full payload`, () => {
      const src = readFileSync(path.join(ROOT, rel), 'utf8')
      // `.insert(body)` — passes the entire JSON body straight to Postgres,
      // letting an attacker set fields like id, created_at, or role.
      expect(src, `${rel} contains .insert(body) (mass-assignment)`).not.toMatch(
        /\.insert\(\s*body\s*\)/,
      )
      // `.upsert({ ...body, ... })` — same risk, harder to spot.
      expect(src, `${rel} contains .upsert({ ...body }) (mass-assignment)`).not.toMatch(
        /\.upsert\(\s*\{\s*\.\.\.body\b/,
      )
    })
  }
})
