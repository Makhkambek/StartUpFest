import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const DOCKERFILE = readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8')

describe('Dockerfile hardening', () => {
  it('uses npm ci --ignore-scripts in the deps stage', () => {
    expect(
      DOCKERFILE,
      'npm ci must use --ignore-scripts to block supply-chain postinstall execution',
    ).toMatch(/npm ci[^\n]*--ignore-scripts/)
  })

  it('runs as non-root user (USER nextjs)', () => {
    expect(DOCKERFILE).toMatch(/USER\s+nextjs/)
  })
})
