import { test, expect } from '@playwright/test'
import { apiLogin, CREDS } from './helpers/auth'

/**
 * API tests for /api/judges/* routes — happy paths, authorization boundaries,
 * and known regressions from sfrc-bugs-audit.md.
 *
 * Each test uses its own fresh APIRequestContext so cookies are isolated.
 */

test.describe('GET /api/judges/[category]/teams', () => {
  for (const cat of ['a', 'b', 'c', 'd']) {
    test(`returns array of teams for category ${cat}`, async ({ request }) => {
      await apiLogin(request, CREDS.admin.username, CREDS.admin.password)
      const res = await request.get(`/api/judges/${cat}/teams`)
      expect(res.ok()).toBe(true)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
    })
  }

  test('returns 400 on invalid category', async ({ request }) => {
    await apiLogin(request, CREDS.admin.username, CREDS.admin.password)
    const res = await request.get('/api/judges/zzz/teams')
    expect(res.status()).toBe(400)
  })
})

test.describe('POST /api/judges/a/results — validation', () => {
  test('rejects missing scheduled_match_id', async ({ request }) => {
    await apiLogin(request, CREDS.judge_a1.username, CREDS.judge_a1.password)
    const res = await request.post('/api/judges/a/results', {
      data: { team_id: 't1', run1: 30, run2: 30, penalty: '0' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects missing team_id', async ({ request }) => {
    await apiLogin(request, CREDS.judge_a1.username, CREDS.judge_a1.password)
    const res = await request.post('/api/judges/a/results', {
      data: { scheduled_match_id: 'm1', run1: 30, run2: 30, penalty: '0' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects overly long notes', async ({ request }) => {
    await apiLogin(request, CREDS.judge_a1.username, CREDS.judge_a1.password)
    const res = await request.post('/api/judges/a/results', {
      data: {
        scheduled_match_id: 'm1',
        team_id: 't1',
        run1: 30,
        run2: 30,
        penalty: '0',
        notes: 'x'.repeat(501),
      },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('Authorization boundaries', () => {
  test('judge_a1 CANNOT POST results for category B', async ({ request }) => {
    await apiLogin(request, CREDS.judge_a1.username, CREDS.judge_a1.password)
    const res = await request.post('/api/judges/b/matches', {
      data: { team1_id: 'x', team2_id: 'y', winner: 1, rounds1: 2, rounds2: 0 },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('judge_b1 CANNOT POST results for category A', async ({ request }) => {
    await apiLogin(request, CREDS.judge_b1.username, CREDS.judge_b1.password)
    const res = await request.post('/api/judges/a/results', {
      data: { scheduled_match_id: 'm1', team_id: 't1', run1: 30, run2: 30, penalty: '0' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('unauthenticated GET /api/judges/a/results returns 401', async ({ request }) => {
    const res = await request.get('/api/judges/a/results')
    expect(res.status()).toBe(401)
  })
})

test.describe('REGRESSION (bug audit)', () => {
  /**
   * Bug #4: DELETE /api/judges/a/results has no session/category check.
   * Any logged-in judge from another category can delete category A results.
   * Will turn green once authz is added.
   */
  test('REGRESSION (bug #4): judge_b1 must NOT be able to DELETE category A results', async ({ request }) => {
    await apiLogin(request, CREDS.judge_b1.username, CREDS.judge_b1.password)
    const res = await request.delete('/api/judges/a/results', {
      data: { scheduled_match_id: 'nonexistent' },
    })
    expect([401, 403]).toContain(res.status())
  })

  /**
   * Bug #5: /api/judges/[category]/teams DELETE has no role check.
   * Any logged-in judge can delete teams from any category.
   */
  test('REGRESSION (bug #5): judge_b1 must NOT be able to DELETE category A teams', async ({ request }) => {
    await apiLogin(request, CREDS.judge_b1.username, CREDS.judge_b1.password)
    const res = await request.delete('/api/judges/a/teams', {
      data: { id: 'nonexistent' },
    })
    expect([401, 403]).toContain(res.status())
  })

  /**
   * Bug #15: POST /api/judges/a/results accepts negative run times.
   * Will turn green once numeric range validation is added.
   */
  test('REGRESSION (bug #15): rejects negative run1/run2', async ({ request }) => {
    await apiLogin(request, CREDS.judge_a1.username, CREDS.judge_a1.password)
    const res = await request.post('/api/judges/a/results', {
      data: { scheduled_match_id: 'm1', team_id: 't1', run1: -10, run2: 30, penalty: '0' },
    })
    expect(res.status()).toBe(400)
  })

  /**
   * Bug #16: POST /api/judges/b/matches accepts invalid winner.
   */
  test('REGRESSION (bug #16): rejects winner outside {0,1,2}', async ({ request }) => {
    await apiLogin(request, CREDS.judge_b1.username, CREDS.judge_b1.password)
    const res = await request.post('/api/judges/b/matches', {
      data: { team1_id: 't1', team2_id: 't2', winner: 5, rounds1: 0, rounds2: 0 },
    })
    expect(res.status()).toBe(400)
  })

  /**
   * Bug #18: POST /api/judges/d/matches accepts negative goals.
   */
  test('REGRESSION (bug #18): rejects negative goals', async ({ request }) => {
    await apiLogin(request, CREDS.judge_d1.username, CREDS.judge_d1.password)
    const res = await request.post('/api/judges/d/matches', {
      data: { team1_id: 't1', team2_id: 't2', goals1: -5, goals2: 2 },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('Standings endpoint', () => {
  for (const cat of ['a', 'b', 'c', 'd']) {
    test(`GET /api/standings/${cat} returns array`, async ({ request }) => {
      const res = await request.get(`/api/standings/${cat}`)
      expect(res.ok()).toBe(true)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
    })
  }

  test('GET /api/standings/invalid returns 400', async ({ request }) => {
    const res = await request.get('/api/standings/xx')
    expect(res.status()).toBe(400)
  })
})
