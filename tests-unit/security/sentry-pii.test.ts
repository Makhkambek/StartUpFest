import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

describe('Sentry: PII / secret stripping via beforeSend', () => {
  for (const rel of [
    'sentry.client.config.ts',
    'sentry.server.config.ts',
    'sentry.edge.config.ts',
  ]) {
    it(`${rel} declares a beforeSend that strips cookies and authorization`, () => {
      const src = readFileSync(path.join(ROOT, rel), 'utf8')
      expect(src).toMatch(/beforeSend/)
      expect(src).toMatch(/cookies/i)
      expect(src).toMatch(/authorization/i)
    })

    it(`${rel} also disables sendDefaultPii (default already off, but make it explicit)`, () => {
      const src = readFileSync(path.join(ROOT, rel), 'utf8')
      expect(src).toMatch(/sendDefaultPii:\s*false/)
    })
  }
})
