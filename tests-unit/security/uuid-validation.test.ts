import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isUuid } from '@/lib/uuid'

describe('isUuid', () => {
  it.each<[unknown, boolean]>([
    ['00000000-0000-0000-0000-000000000000', true],
    ['c3f1a3a9-9f5b-4a4f-9d8a-1f2e3d4c5b6a', true],
    ['C3F1A3A9-9F5B-4A4F-9D8A-1F2E3D4C5B6A', true],
    ['c3f1a3a9-9f5b-4a4f-9d8a-1f2e3d4c5b6', false], // too short
    ['c3f1a3a9-9f5b-4a4f-9d8a-1f2e3d4c5b6az', false], // too long
    ['fake-uuid', false],
    ["fake'),team1_id.eq.real-id)--", false],
    ['', false],
    [null, false],
    [undefined, false],
    [123, false],
    [{}, false],
  ])('isUuid(%p) === %p', (input, expected) => {
    expect(isUuid(input)).toBe(expected)
  })
})

describe('PostgREST .or() template interpolation must be gated by isUuid', () => {
  const ROOT = path.resolve(__dirname, '../..')
  const FILES = [
    'src/app/api/judges/b/matches/route.ts',
    'src/app/api/field/[cat]/state/route.ts',
  ]

  for (const rel of FILES) {
    it(`${rel}: every .or() with \${...} is preceded by isUuid in same fn`, () => {
      const src = readFileSync(path.join(ROOT, rel), 'utf8')
      const orMatches = [...src.matchAll(/\.or\(`[^`]*\$\{/g)]
      if (orMatches.length === 0) return // no risky .or()
      for (const m of orMatches) {
        const offset = m.index!
        const before = src.slice(0, offset)
        const lastIsUuid = before.lastIndexOf('isUuid(')
        const lastFnDef = Math.max(
          before.lastIndexOf('export async function'),
          before.lastIndexOf('async function'),
          before.lastIndexOf('function '),
        )
        expect(
          lastIsUuid,
          `${rel}: .or() at offset ${offset} has no isUuid() call before it (after last fn def at ${lastFnDef})`,
        ).toBeGreaterThan(lastFnDef)
      }
    })
  }
})
