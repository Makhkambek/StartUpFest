import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = path.join(dir, entry)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const ROUTE_FILES = walk(path.join(ROOT, 'src/app/api/judges')).filter((p) =>
  p.endsWith('route.ts'),
)

const MUTATING = ['POST', 'PATCH', 'DELETE', 'PUT'] as const
// Either a require* helper, or `getSession()` followed downstream by a manual
// role/categories check. The second pattern is older but legitimate.
const AUTHZ_FNS = ['requireSession', 'requireCategory', 'requireAdmin', 'getSession']
const DATA_MARKERS = [
  'supabase.from(',
  "await import('@/lib/mock-store')",
  "await import('@/lib/schedule-store')",
]

function extractHandlerBody(src: string, method: string): string | null {
  const start = src.indexOf(`export async function ${method}(`)
  if (start === -1) return null
  // Find the next `export async function` or end of file
  const tail = src.slice(start + 1)
  const next = tail.search(/\nexport async function /)
  const end = next === -1 ? src.length : start + 1 + next
  return src.slice(start, end)
}

function firstIndexOfAny(haystack: string, needles: string[]): number {
  let min = Infinity
  for (const n of needles) {
    const i = haystack.indexOf(n)
    if (i >= 0 && i < min) min = i
  }
  return min === Infinity ? -1 : min
}

describe('judges API mutating handlers must authorize before data access', () => {
  for (const file of ROUTE_FILES) {
    const rel = path.relative(ROOT, file)
    const src = readFileSync(file, 'utf8')
    for (const method of MUTATING) {
      const body = extractHandlerBody(src, method)
      if (body === null) continue
      it(`${rel} :: ${method}`, () => {
        const dataIdx = firstIndexOfAny(body, DATA_MARKERS)
        if (dataIdx === -1) return // no data access in this handler
        const authzIdx = firstIndexOfAny(body, AUTHZ_FNS)
        expect(
          authzIdx,
          `${rel} :: ${method}: no require* call found before data access`,
        ).toBeGreaterThanOrEqual(0)
        expect(
          authzIdx,
          `${rel} :: ${method}: require* must appear BEFORE first data access`,
        ).toBeLessThan(dataIdx)
      })
    }
  }
})
