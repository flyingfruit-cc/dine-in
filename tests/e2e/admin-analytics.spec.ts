import { test, expect, type Page } from '@playwright/test'
import {
  getServiceClient,
  createTestRestaurant,
  createTestOwner,
  cleanupTestRestaurants,
  cleanupTestUsers,
} from '../rls/helpers'

const TEST_PASSWORD = 'Test1234!'

test.describe('Admin analytics page', () => {
  const svc = getServiceClient()
  const suffix = `an-e2e-${Date.now()}`
  let restaurantId: string
  let ownerId: string
  const ownerEmail = `an-e2e-${suffix}@test.invalid`

  test.beforeAll(async () => {
    const restaurant = await createTestRestaurant(svc, `an-e2e-${suffix}`, 'Analytics E2E Test')
    restaurantId = restaurant.id
    const owner = await createTestOwner(svc, restaurantId, ownerEmail)
    ownerId = owner.id
  })

  test.afterAll(async () => {
    await cleanupTestRestaurants(svc, [restaurantId])
    await cleanupTestUsers(svc, [ownerId])
  })

  async function signIn(page: Page) {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(ownerEmail)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /log in/i }).click()
    await page.waitForURL(/\/admin/)
  }

  test('analytics page loads and shows "Analytics" heading', async ({ page }) => {
    await signIn(page)
    await page.goto('/admin/analytics')
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
  })

  test('default period is "7d" — "7 days" pill is selected on first visit', async ({ page }) => {
    await signIn(page)
    await page.goto('/admin/analytics')
    const sevenDayPill = page.getByRole('tab', { name: '7 days' })
    await expect(sevenDayPill).toHaveAttribute('aria-selected', 'true')
  })

  test('clicking "30 days" pill updates URL to ?period=30d', async ({ page }) => {
    await signIn(page)
    await page.goto('/admin/analytics')
    await page.getByRole('tab', { name: '30 days' }).click()
    await expect(page).toHaveURL(/period=30d/)
  })

  test('page renders either empty-state or charts (no crash)', async ({ page }) => {
    await signIn(page)
    await page.goto('/admin/analytics')
    // Accept either the empty-state heading or the Order Volume chart heading
    const hasEmptyState = await page
      .getByRole('heading', { name: /Not enough data yet/i })
      .isVisible()
      .catch(() => false)
    const hasChart = await page
      .getByRole('heading', { name: /Order Volume/i })
      .isVisible()
      .catch(() => false)
    const hasError = await page
      .getByRole('heading', { name: /Analytics temporarily unavailable/i })
      .isVisible()
      .catch(() => false)

    expect(hasEmptyState || hasChart || hasError).toBe(true)
  })

  test('AdminNav shows Analytics entry that navigates to /admin/analytics', async ({ page }) => {
    await signIn(page)
    await page.goto('/admin')
    // Find the Analytics nav link (mobile bar or desktop sidebar)
    const analyticsLink = page.getByRole('link', { name: 'Analytics' }).first()
    await expect(analyticsLink).toBeVisible()
    await analyticsLink.click()
    await expect(page).toHaveURL('/admin/analytics')
  })

  test('invalid ?period= falls back to 7d (no crash)', async ({ page }) => {
    await signIn(page)
    await page.goto('/admin/analytics?period=invalid')
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
    const sevenDayPill = page.getByRole('tab', { name: '7 days' })
    await expect(sevenDayPill).toHaveAttribute('aria-selected', 'true')
  })
})
