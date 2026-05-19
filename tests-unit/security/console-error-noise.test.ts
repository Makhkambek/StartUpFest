import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = path.join(dir, entry)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const LIVE_ROUTES = walk(path.join(ROOT, 'src/app/api/judges')).filter(
  (p) => p.endsWith('/live/route.ts'),
)

describe('judges/*/live routes: console.error logs only safe fields', () => {
  for (const file of LIVE_ROUTES) {
    const rel = path.relative(ROOT, file)
    const src = readFileSync(file, 'utf8')
    it(`${rel} does not log full error objects or patch contents`, () => {
      // Allowed: console.error('...', err.message) or err?.message
      // Disallowed: console.error('...', err) or '... patch', patch)
      const lines = src.split('\n')
      const violations: string[] = []
      lines.forEach((line, i) => {
        if (!/console\.error\(/.test(line)) return
        // Look for the second argument — anything after the first comma that
        // isn't `.message` access counts as a potential PII leak.
        const m = line.match(/console\.error\([^,]+,\s*(\w+)([^)]*)\)/)
        if (!m) return
        const [, secondArg, rest] = m
        const accessesMessage = /\.message\b/.test(rest)
        const isShortPrimitive = /^['"\d]/.test(secondArg)
        if (!accessesMessage && !isShortPrimitive) {
          violations.push(`${rel}:${i + 1}: logs '${secondArg}' without .message`)
        }
      })
      expect(violations, violations.join('\n')).toEqual([])
    })
  }
})
