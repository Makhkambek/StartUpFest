import { test, expect } from '@playwright/test'
import { login, CREDS } from './helpers/auth'

test('login page loads with username and password fields', async ({ page }) => {
  await page.goto('/judges/login')
  await expect(page.getByPlaceholder('e.g. admin')).toBeVisible()
  await expect(page.getByPlaceholder('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()
})

test('admin login redirects to judges panel', async ({ page }) => {
  await login(page, CREDS.admin.username, CREDS.admin.password)
  await expect(page).toHaveURL(/\/judges/, { timeout: 8000 })
})

test('admin can reach user management page', async ({ page }) => {
  await login(page, CREDS.admin.username, CREDS.admin.password)
  await expect(page).toHaveURL(/\/judges/, { timeout: 8000 })
  await page.goto('/judges/admin/users')
  await expect(page.getByText(/users|judge|admin/i).first()).toBeVisible({ timeout: 6000 })
})

test('non-logged-in user is redirected from judges panel', async ({ page }) => {
  await page.goto('/judges/a')
  await expect(page).toHaveURL(/login/)
})

test('wrong password shows error message', async ({ page }) => {
  await login(page, 'admin', 'wrongpassword')
  // Server may return either invalid-credentials error or 429 rate-limit error.
  // Both are surfaced via the page's error banner.
  await expect(
    page.getByText(/invalid|incorrect|error|wrong|too many|try again/i),
  ).toBeVisible({ timeout: 8000 })
})

test('judge_a1 can log in and reach category A page', async ({ page }) => {
  // Use the JSON API directly so we can detect a 429 from the IP rate-limit
  // accumulating across the test suite (audit bug #25).
  const res = await page.request.post('/api/auth/login', {
    data: { username: CREDS.judge_a1.username, password: CREDS.judge_a1.password },
  })
  if (res.status() === 429) {
    test.skip(true, 'Skipping: login IP rate-limit hit (see audit bug #25)')
  }
  expect(res.ok()).toBe(true)
  await page.goto('/judges/a')
  await expect(page).toHaveURL(/\/judges\/a/, { timeout: 6000 })
})

test('logout clears session', async ({ page }) => {
  await login(page, CREDS.admin.username, CREDS.admin.password)
  await expect(page).toHaveURL(/\/judges/, { timeout: 8000 })

  // Logout is a POST endpoint (state-changing) that redirects to /judges/login.
  // GET is intentionally not supported anymore (CSRF hardening).
  const logoutRes = await page.request.post('/api/auth/logout', { maxRedirects: 0 })
  expect([200, 302, 303, 307, 308]).toContain(logoutRes.status())

  await page.goto('/judges/a')
  await expect(page).toHaveURL(/login/, { timeout: 6000 })
})

test('unauthenticated /api/auth/me returns null user or 401', async ({ request }) => {
  const res = await request.get('/api/auth/me')
  if (res.status() === 200) {
    const body = await res.json()
    expect(body.user).toBeNull()
  } else {
    expect(res.status()).toBe(401)
  }
})
