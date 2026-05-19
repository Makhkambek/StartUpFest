import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

describe('migration 018: atomic counter RPC for live_match_state', () => {
  const sql = readFileSync(
    path.join(ROOT, 'supabase/migrations/018_live_state_atomic_ops.sql'),
    'utf8',
  )

  it('defines inc_live_counter RPC', () => {
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+inc_live_counter/i)
  })

  it('whitelists category and column names (no SQL injection via format())', () => {
    expect(sql).toMatch(/p_column\s+NOT\s+IN\s*\(.*fouls_red.*\)/i)
    expect(sql).toMatch(/p_category\s+NOT\s+IN\s*\(.*'a'.*'b'.*'c'.*'d'.*\)/i)
  })

  it('grants EXECUTE only to authenticated and service_role (not public)', () => {
    expect(sql).toMatch(/REVOKE ALL[\s\S]+FROM public/)
    expect(sql).toMatch(/GRANT EXECUTE[\s\S]+TO authenticated, service_role/)
  })

  it('uses SECURITY INVOKER (does not bypass RLS)', () => {
    expect(sql).toMatch(/SECURITY\s+INVOKER/i)
  })

  it('sets fixed search_path (search_path injection guard)', () => {
    expect(sql).toMatch(/SET\s+search_path\s*=\s*public,\s*pg_temp/i)
  })
})
