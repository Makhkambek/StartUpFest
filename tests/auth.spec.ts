import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page, username: string, password: string) {
  await page.goto('/judges/login')
  await page.getByPlaceholder('e.g. admin').fill(username)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Login' }).click()
}

test('login page loads with username and password fields', async ({ page }) => {
  await page.goto('/judges/login')
  await expect(page.getByPlaceholder('e.g. admin')).toBeVisible()
  await expect(page.getByPlaceholder('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()
})

test('admin login redirects to judges panel', async ({ page }) => {
  await login(page, 'admin', 'admin')
  await expect(page).toHaveURL(/\/judges/, { timeout: 8000 })
})

test('admin can reach user management page', async ({ page }) => {
  await login(page, 'admin', 'admin')
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
  await expect(page.getByText(/invalid|incorrect|error|wrong/i)).toBeVisible({ timeout: 6000 })
})
