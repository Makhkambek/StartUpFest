import { test, expect } from '@playwright/test'

const CATEGORIES = [
  { label: 'Line Follower', path: '/a' },
  { label: 'Mini Sumo',     path: '/b' },
  { label: 'MiniRoboWar',   path: '/c' },
  { label: 'Robo Football',  path: '/d' },
]

test('homepage redirects to a category page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/(a|b|c|d)/)
})

for (const { label, path } of CATEGORIES) {
  test(`${label} (${path}) — standings tab visible`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('button', { name: 'Standings' })).toBeVisible({ timeout: 8000 })
  })

  test(`${label} (${path}) — matches tab switches view`, async ({ page }) => {
    await page.goto(path)
    await page.getByRole('button', { name: 'Matches' }).click()
    // "Loading matches…" or "No matches scheduled yet." should appear in the content area
    await expect(
      page.getByText('Loading matches…').or(page.getByText('No matches scheduled yet.'))
    ).toBeVisible({ timeout: 8000 })
  })
}

test('category tabs navigate between categories', async ({ page }) => {
  await page.goto('/a')
  await page.getByText('Mini Sumo').first().click()
  await expect(page).toHaveURL('/b')
})

test('header shows SFRC branding', async ({ page }) => {
  await page.goto('/a')
  await expect(page.getByText('STARTUP FEST').first()).toBeVisible()
})
