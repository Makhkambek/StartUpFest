import { test, expect } from '@playwright/test'

test('display page loads without crash', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto('/display')
  await page.waitForTimeout(2000)

  // no fatal JS errors
  const fatal = errors.filter(e => !e.includes('supabase') && !e.includes('network'))
  expect(fatal).toHaveLength(0)
})

test('display page shows all 4 category panels', async ({ page }) => {
  await page.goto('/display')
  await expect(page.getByText('Line Follower')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('Mini Sumo')).toBeVisible()
  await expect(page.getByText('MiniRoboWar')).toBeVisible()
  await expect(page.getByText('Robo Football')).toBeVisible()
})

test('display page fills the screen (no scroll)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/display')
  const bodyHeight = await page.evaluate(() => document.body.scrollHeight)
  const viewportHeight = page.viewportSize()!.height
  expect(bodyHeight).toBeLessThanOrEqual(viewportHeight + 5)
})
