/**
 * E2E tests for the "Show Finals" (🏆 Finals) feature across all 4 categories.
 *
 * Auth: logs in as admin via /api/auth/login — the server issues a proper
 * HMAC-signed httpOnly session cookie (mock mode) or a Supabase auth token.
 * Plain base64 cookies injected via context.addCookies() are rejected by the
 * HMAC-verifying middleware.
 *
 * Root cause of toggle failures (currently): Supabase migration 023
 * (adds `finals_visible` column to `live_match_state`) has not been applied.
 * The POST /api/judges/[cat]/live with { type: "toggle_finals" } returns
 * 400 "Invalid action" because the Supabase UPDATE patch errors out.
 *
 * Checks per category:
 *   1. 🏆 Finals button exists in judge panel header
 *   2. Button has gray/default styling when finalsVisible=false
 *   3. Clicking turns it amber and shows "🏆 Finals ON"
 *   4. /field/[cat] loads without JS errors; screenshot taken
 *   5. Toggle OFF: button returns to gray
 *   6. State persists after navigating away and back
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// ── Constants ─────────────────────────────────────────────────────────────────

const ARTIFACTS_DIR = path.join(process.cwd(), 'test-results', 'show-finals')

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureArtifactsDir() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
}

async function loginAsAdmin(page: Page) {
  const res = await page.request.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin1' },
  })
  if (res.status() === 429) {
    test.skip(true, 'Login IP rate-limit hit — wait 15 min or restart dev server')
  }
  if (!res.ok()) {
    throw new Error(`Admin login failed: ${res.status()} — ${await res.text()}`)
  }
}

/** Returns true if migration 023 (finals_visible column) is applied in Supabase. */
async function checkMigrationApplied(page: Page, cat: string): Promise<boolean> {
  const res = await page.request.get(`/api/judges/${cat}/live`)
  if (!res.ok()) return false
  const state = await res.json()
  return 'finals_visible' in state
}

/** Toggle finals via the API directly. Returns true if toggle succeeded. */
async function apiToggleFinals(page: Page, cat: string): Promise<boolean> {
  const res = await page.request.post(`/api/judges/${cat}/live`, {
    data: { type: 'toggle_finals' },
  })
  if (!res.ok()) return false
  const body = await res.json()
  return typeof body.finals_visible === 'boolean'
}

/** Ensure finals_visible is OFF before a test (best-effort). */
async function ensureFinalsOff(page: Page, cat: string) {
  const res = await page.request.get(`/api/judges/${cat}/live`)
  if (!res.ok()) return
  const state = await res.json()
  if (state.finals_visible === true) {
    await apiToggleFinals(page, cat)
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { cat: 'a', label: 'Line Follower' },
  { cat: 'b', label: 'Mini Sumo' },
  { cat: 'c', label: 'MiniRoboWar' },
  { cat: 'd', label: 'Robo Football' },
] as const

for (const { cat, label } of CATEGORIES) {
  test.describe(`Category ${cat.toUpperCase()} — ${label}`, () => {
    let ctx: BrowserContext
    let page: Page
    // Set to true once migration 023 is confirmed applied (in beforeAll).
    let migrationApplied = false

    test.beforeAll(async ({ browser }) => {
      ensureArtifactsDir()
      ctx = await browser.newContext()
      page = await ctx.newPage()
      await loginAsAdmin(page)
      migrationApplied = await checkMigrationApplied(page, cat)
      if (migrationApplied) {
        await ensureFinalsOff(page, cat)
      }
    })

    test.afterAll(async () => {
      // Leave finals OFF for cleanliness
      if (migrationApplied) {
        await ensureFinalsOff(page, cat).catch(() => {})
      }
      await ctx.close()
    })

    // ── 1 & 2: button exists and is gray by default ──────────────────────
    test(`1+2: Finals button visible and gray by default on /judges/${cat}`, async () => {
      await page.goto(`/judges/${cat}`)
      await page.waitForLoadState('networkidle')

      const btn = page.getByRole('button', { name: /🏆 Finals/ })
      await expect(btn).toBeVisible({ timeout: 8000 })

      // In OFF state: no amber background, has gray styling
      const cls = await btn.getAttribute('class') ?? ''
      const isGray =
        !cls.includes('bg-amber') && !cls.includes('amber-500') &&
        (cls.includes('gray') || cls.includes('border-gray') || cls.includes('text-gray'))

      if (!isGray) {
        const ssPath = path.join(ARTIFACTS_DIR, `cat-${cat}-button-not-gray.png`)
        await page.screenshot({ path: ssPath })
        throw new Error(
          `Finals button is NOT gray by default. Classes: "${cls}". Screenshot: ${ssPath}`,
        )
      }
    })

    // ── 3: button toggles to amber ────────────────────────────────────────
    test(`3: Click Finals button → turns amber and shows "Finals ON" on /judges/${cat}`, async () => {
      // Skip if migration not applied — the toggle will always fail server-side.
      // This is a blocking dependency. Unskip by applying migration 023.
      test.skip(
        !migrationApplied,
        'Supabase migration 023 (finals_visible column) not applied. ' +
        'The toggle_finals API returns 400 "Invalid action". ' +
        'Apply migration 023_live_state_finals_visible.sql to Supabase to fix.',
      )

      await page.goto(`/judges/${cat}`)
      await page.waitForLoadState('networkidle')

      const btn = page.getByRole('button', { name: /🏆 Finals/ })
      await expect(btn).toBeVisible({ timeout: 8000 })

      await btn.click()

      // After toggling ON: text changes and amber classes appear
      await expect(btn).toHaveText(/🏆 Finals ON/i, { timeout: 8000 })
      const clsAfter = await btn.getAttribute('class') ?? ''
      const isAmber = clsAfter.includes('amber')
      if (!isAmber) {
        const ssPath = path.join(ARTIFACTS_DIR, `cat-${cat}-button-not-amber.png`)
        await page.screenshot({ path: ssPath })
        throw new Error(
          `Finals button did not turn amber after click. Classes: "${clsAfter}". Screenshot: ${ssPath}`,
        )
      }
    })

    // ── 4: field display — no JS errors + screenshot ──────────────────────
    test(`4: /field/${cat} loads without JS errors`, async () => {
      const jsErrors: string[] = []
      const listener = (err: Error) => {
        if (!err.message.includes('supabase') && !err.message.includes('network')) {
          jsErrors.push(err.message)
        }
      }
      page.on('pageerror', listener)

      // next-intl wraps field pages with a locale prefix
      await page.goto(`/en/field/${cat}`)
      // Allow polling to fire at least once (poll interval is typically 2-5s)
      await page.waitForTimeout(3000)

      const ssPath = path.join(ARTIFACTS_DIR, `cat-${cat}-field-display.png`)
      await page.screenshot({ path: ssPath, fullPage: true })

      page.off('pageerror', listener)

      if (jsErrors.length > 0) {
        throw new Error(
          `/field/${cat} had JS errors:\n  ${jsErrors.join('\n  ')}\n  Screenshot: ${ssPath}`,
        )
      }

      const bodyText = await page.locator('body').innerText()
      expect(bodyText.length).toBeGreaterThan(10)
    })

    // ── 5: toggle OFF ────────────────────────────────────────────────────
    test(`5: Click Finals button again → reverts to gray on /judges/${cat}`, async () => {
      test.skip(
        !migrationApplied,
        'Supabase migration 023 (finals_visible column) not applied — toggle is broken.',
      )

      await page.goto(`/judges/${cat}`)
      await page.waitForLoadState('networkidle')

      const btn = page.getByRole('button', { name: /🏆 Finals/ })
      await expect(btn).toBeVisible({ timeout: 8000 })
      // Should be ON from test 3
      await expect(btn).toHaveText(/🏆 Finals ON/i, { timeout: 5000 })

      await btn.click()
      await expect(btn).not.toHaveText(/Finals ON/i, { timeout: 8000 })

      const clsOff = await btn.getAttribute('class') ?? ''
      const isGrayAgain = !clsOff.includes('bg-amber') && !clsOff.includes('amber-500')
      if (!isGrayAgain) {
        const ssPath = path.join(ARTIFACTS_DIR, `cat-${cat}-button-not-gray-after-toggle-off.png`)
        await page.screenshot({ path: ssPath })
        throw new Error(
          `Finals button did not revert to gray after toggle OFF. Classes: "${clsOff}". Screenshot: ${ssPath}`,
        )
      }
    })

    // ── 6: state persists across navigation ──────────────────────────────
    test(`6: Finals state persists after navigating away and back on /judges/${cat}`, async () => {
      test.skip(
        !migrationApplied,
        'Supabase migration 023 (finals_visible column) not applied — toggle is broken.',
      )

      // Turn ON
      await page.goto(`/judges/${cat}`)
      await page.waitForLoadState('networkidle')

      let btn = page.getByRole('button', { name: /🏆 Finals/ })
      await expect(btn).toBeVisible({ timeout: 8000 })
      if (!(await btn.innerText()).includes('ON')) {
        await btn.click()
        await expect(btn).toHaveText(/🏆 Finals ON/i, { timeout: 8000 })
      }

      // Navigate away and back
      await page.goto('/judges/dashboard')
      await page.waitForLoadState('networkidle')
      await page.goto(`/judges/${cat}`)
      await page.waitForLoadState('networkidle')

      btn = page.getByRole('button', { name: /🏆 Finals/ })
      await expect(btn).toBeVisible({ timeout: 8000 })

      const textAfter = await btn.innerText()
      const clsAfter = await btn.getAttribute('class') ?? ''
      if (!textAfter.includes('ON') || !clsAfter.includes('amber')) {
        const ssPath = path.join(ARTIFACTS_DIR, `cat-${cat}-state-not-persisted.png`)
        await page.screenshot({ path: ssPath })
        throw new Error(
          `Finals state did NOT persist after navigation. Text: "${textAfter}", Classes: "${clsAfter}". Screenshot: ${ssPath}`,
        )
      }

      // Clean up
      await btn.click()
      await expect(btn).not.toHaveText(/Finals ON/i, { timeout: 5000 })
    })
  })
}
