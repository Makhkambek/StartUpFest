import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const MIG_DIR = path.join(ROOT, 'supabase/migrations')

const SENSITIVE_TABLES = [
  'teams',
  'scheduled_matches',
  'results_a',
  'matches_b',
  'fights_c',
  'matches_d',
  'live_match_state',
] as const

function readAllMigrations(): string {
  return readdirSync(MIG_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => `-- FILE: ${f}\n${readFileSync(path.join(MIG_DIR, f), 'utf8')}`)
    .join('\n\n')
}

describe('RLS: write policies on sensitive tables must be auth-aware', () => {
  const sql = readAllMigrations()

  for (const table of SENSITIVE_TABLES) {
    it(`${table}: latest write policy references auth.uid()/is_admin (not USING true)`, () => {
      // Split on CREATE POLICY; first chunk is preamble.
      const blocks = sql.split(/CREATE POLICY/i).slice(1)
      const tableRe = new RegExp(`ON\\s+${table}\\b`, 'i')
      const writeBlocks = blocks.filter(
        (b) => tableRe.test(b) && /FOR\s+(ALL|INSERT|UPDATE|DELETE)/i.test(b),
      )
      expect(
        writeBlocks.length,
        `no write CREATE POLICY found for ${table} across migrations`,
      ).toBeGreaterThan(0)

      const last = writeBlocks[writeBlocks.length - 1]
      // Block ends at next CREATE POLICY or end-of-file (split already cut it).
      // We only look at this block — older versions are superseded by later DROP+CREATE.
      const hasAuthRef = /auth\.uid\(\)|is_admin/.test(last)
      expect(
        hasAuthRef,
        `last write policy for ${table} does not reference auth.uid()/is_admin:\n--- BEGIN POLICY ---${last.slice(
          0,
          400,
        )}\n--- END SNIPPET ---`,
      ).toBe(true)
    })
  }
})
