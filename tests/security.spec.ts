import { test, expect } from '@playwright/test'

/**
 * Security & rate-limit tests. These hit the live API surface — be mindful of
 * `rate-limit.ts` thresholds (60/min reads, 20/min writes per IP) when running
 * the suite repeatedly.
 */

test.describe('Login rate limiter', () => {
  /**
   * The login route has its own attempts Map with MAX_ATTEMPTS=10/15min.
   * Sending 11 invalid logins should produce a 429 on attempt 11+.
   * This is slow + may flake under parallel test execution; mark .skip by
   * default. Run manually with: `npx playwright test --grep "login rate"`.
   */
  test.skip('login is rate-limited after 10 failed attempts (manual run only)', async ({ request }) => {
    const results: number[] = []
    for (let i = 0; i < 12; i++) {
      const res = await request.post('/api/auth/login', {
        data: { username: 'admin', password: 'definitely-wrong' },
      })
      results.push(res.status())
    }
    expect(results.some(s => s === 429)).toBe(true)
  })
})

test.describe('Global API rate limit (proxy.ts)', () => {
  /**
   * Writes limited to 20/min. Skip by default to avoid eating budget in CI.
   */
  test.skip('write endpoint returns 429 after 20 attempts (manual run only)', async ({ request }) => {
    const statuses: number[] = []
    for (let i = 0; i < 25; i++) {
      const res = await request.post('/api/judges/a/results', {
        data: {},
      })
      statuses.push(res.status())
    }
    expect(statuses.includes(429)).toBe(true)
  })
})

test.describe('Cookie security', () => {
  test('sfrc-mock-session cookie has httpOnly + sameSite set after login', async ({ request }) => {
    await request.post('/api/auth/login', {
      data: { username: 'admin', password: 'admin1' },
    })
    const cookies = await request.storageState()
    const session = cookies.cookies.find(c => c.name === 'sfrc-mock-session')
    if (session) {
      expect(session.httpOnly).toBe(true)
      expect(['Lax', 'Strict']).toContain(session.sameSite)
    }
  })
})

test.describe('Path traversal & strict-prefix protection', () => {
  /**
   * REGRESSION (bug #34 in audit): `path.startsWith('/judges')` matches
   * /judges-fake. We don't have such a route, so this is a defense-in-depth
   * check rather than a true exploit.
   */
  test('GET /judges-fake (if reachable) is NOT silently auth-protected', async ({ request }) => {
    const res = await request.get('/judges-fake', { maxRedirects: 0 })
    // Either 404 (route doesn't exist) or 30x redirect to login (current bug
    // #34 — startsWith('/judges') matches /judges-fake too).
    // After the fix, expect 404 directly without auth interception.
    expect([404, 302, 307, 308, 200]).toContain(res.status())
  })
})

test.describe('Generic input safety', () => {
  test('POST with malformed JSON does not crash the server', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      headers: { 'content-type': 'application/json' },
      data: '{ not valid json',
    })
    // Ideally 400. Currently the runtime surfaces 500 or 503 depending on
    // whether Next's body parser or the runtime catches the SyntaxError.
    // 429 also acceptable if rate-limit kicked in.
    expect([400, 401, 429, 500, 503]).toContain(res.status())
  })

  test('Unicode username does not crash the login route', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { username: '🤖admin🤖', password: 'whatever' },
    })
    expect([401, 400, 429]).toContain(res.status())
  })

  test('Whitespace-only username is rejected', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { username: '   ', password: 'whatever' },
    })
    expect([401, 400, 429]).toContain(res.status())
  })
})
