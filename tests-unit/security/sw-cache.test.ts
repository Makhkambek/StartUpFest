import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const SW = readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8')

describe('service worker: do not cache authenticated pages', () => {
  it('initial ASSETS list does not include /judges/dashboard', () => {
    // Authenticated pages must not be cached on install — otherwise an
    // offline user keeps seeing their old dashboard after logout.
    const m = SW.match(/ASSETS\s*=\s*\[([^\]]+)\]/)
    expect(m, 'ASSETS array not found').not.toBeNull()
    expect(m![1]).not.toMatch(/\/judges\/dashboard/)
  })

  it('navigate fallback redirects to /judges/login (not /judges/dashboard)', () => {
    // If we have to serve a fallback page, point at login so the user
    // re-authenticates instead of seeing a possibly stale dashboard.
    expect(SW).toMatch(/caches\.match\(['"]\/judges\/login['"]\)/)
    expect(SW).not.toMatch(/caches\.match\(['"]\/judges\/dashboard['"]\)/)
  })
})
