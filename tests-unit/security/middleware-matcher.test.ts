import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const PROXY = readFileSync(path.join(ROOT, 'src/proxy.ts'), 'utf8')

// Pull just the matcher-array literal so comments elsewhere don't pollute the check.
function extractMatcherValue(src: string): string {
  const m = src.match(/matcher:\s*\[([\s\S]*?)\]/)
  if (!m) throw new Error('Could not locate matcher array in proxy.ts')
  return m[1]
}

describe('middleware matcher must not skip any path containing a dot', () => {
  it('proxy.ts matcher no longer uses the .*\\..* wildcard exclusion', () => {
    // The original `.*\\..*` exclusion matched any URL with a dot in it
    // (e.g. /api/foo.csv), letting such paths bypass middleware authn.
    const matcherValue = extractMatcherValue(PROXY)
    expect(
      matcherValue,
      'matcher must not exclude `.*\\\\..*` — any dot in the path bypasses auth',
    ).not.toMatch(/\.\*\\\\\.\.\*/)
  })

  it('matcher excludes specific static asset extensions instead', () => {
    // Look for an explicit whitelist of static extensions (svg/png/jpg/etc.)
    // — the documented Next.js pattern for safely skipping middleware on assets.
    expect(PROXY).toMatch(/svg|png|jpg|ico|webp|css|js/)
  })
})
