import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const LOGOUT = readFileSync(
  path.join(ROOT, 'src/app/api/auth/logout/route.ts'),
  'utf8',
)

describe('logout route: CSRF hardening', () => {
  it('exports a POST handler', () => {
    expect(LOGOUT).toMatch(/export async function POST\(/)
  })

  it('does NOT expose a state-changing GET handler', () => {
    // GET on a logout endpoint is a classic CSRF vector — any cross-origin
    // navigation (link, redirect, even some Lax-cookie cases) could log the
    // user out without intent.
    expect(LOGOUT).not.toMatch(/export async function GET\(/)
  })

  it('POST handler validates the Origin header', () => {
    // Look for a header lookup of origin somewhere in the file.
    expect(LOGOUT).toMatch(/headers\.get\(['"]origin['"]\)/i)
  })
})

describe('logout callers use POST (no <a href="/api/auth/logout">)', () => {
  for (const rel of [
    'src/app/judges/dashboard/page.tsx',
    'src/app/judges/dashboard/workspace.tsx',
  ]) {
    it(`${rel} no longer links logout via <a href>`, () => {
      const src = readFileSync(path.join(ROOT, rel), 'utf8')
      expect(src, `${rel} still has GET-based <a href="/api/auth/logout">`).not.toMatch(
        /<a[^>]*href=["']\/api\/auth\/logout["']/,
      )
    })
  }
})
