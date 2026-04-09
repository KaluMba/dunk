import { test, expect } from '@playwright/test'

test('page loads and renders canvas', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
})
