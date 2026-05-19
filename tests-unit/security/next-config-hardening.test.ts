import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const CONFIG = readFileSync(path.join(ROOT, 'next.config.ts'), 'utf8')

describe('next.config.ts: security headers', () => {
  it('declares Content-Security-Policy header', () => {
    expect(CONFIG).toMatch(/Content-Security-Policy/)
  })

  it('CSP forbids inline frames and locks down framing', () => {
    expect(CONFIG).toMatch(/frame-ancestors\s+'none'/)
  })

  it('declares Strict-Transport-Security with at least 1 year max-age', () => {
    expect(CONFIG).toMatch(/Strict-Transport-Security/)
    const m = CONFIG.match(/max-age=(\d+)/)
    expect(m, 'max-age value not found in HSTS header').not.toBeNull()
    expect(Number(m![1])).toBeGreaterThanOrEqual(31536000) // 1 year
  })
})

describe('next.config.ts: source map hardening', () => {
  it('disables productionBrowserSourceMaps', () => {
    expect(CONFIG).toMatch(/productionBrowserSourceMaps:\s*false/)
  })

  it('passes hideSourceMaps: true to withSentryConfig', () => {
    expect(CONFIG).toMatch(/hideSourceMaps:\s*true/)
  })
})
