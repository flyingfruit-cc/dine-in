import { test, expect, type Page } from '@playwright/test'
import {
  getServiceClient,
  createTestRestaurant,
  createTestOwner,
  createTestTable,
  createTestOrder,
  cleanupTestRestaurants,
  cleanupTestUsers,
} from '../rls/helpers'

const TEST_PASSWORD = 'Test1234!'

test.describe('Admin KDS page', () => {
  const svc = getServiceClient()
  const suffix = `kds-e2e-${Date.now()}`
  let restaurantId: string
  let ownerId: string
  const ownerEmail = `kds-e2e-${suffix}@test.invalid`

  test.beforeAll(async () => {
    const restaurant = await createTestRestaurant(svc, `kds-e2e-${suffix}`, 'KDS E2E Test')
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

  test('KDS page loads and shows "Kitchen" heading', async ({ page }) => {
    await signIn(page)
    await page.goto('/admin/kds')
    await expect(page.getByRole('heading', { name: 'Kitchen', level: 1 })).toBeVisible()
  })

  test('KDS page renders without admin nav chrome (no sidebar, no bottom bar)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 }) // desktop viewport
    await signIn(page)
    await page.goto('/admin/kds')
    await expect(page.getByRole('heading', { name: 'Kitchen', level: 1 })).toBeVisible()
    // The AdminNav component renders <nav aria-label="Admin navigation"> twice; on /admin/kds neither is rendered.
    const navs = page.getByRole('navigation', { name: 'Admin navigation' })
    await expect(navs).toHaveCount(0)
  })

  test('chrome regression: non-KDS admin routes still render the sidebar on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await signIn(page)
    await page.goto('/admin/orders')
    // At least one <nav aria-label="Admin navigation"> must render — sidebar or bottom bar
    const navs = page.getByRole('navigation', { name: 'Admin navigation' })
    await expect(navs.first()).toBeVisible()
  })

  test('Kitchen entry is visible on desktop sidebar after navigating from another admin page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await signIn(page)
    await page.goto('/admin/orders')
    // Desktop sidebar exposes the Kitchen link to /admin/kds
    const kitchenLink = page.getByRole('link', { name: 'Kitchen' })
    await expect(kitchenLink).toBeVisible()
    await expect(kitchenLink).toHaveAttribute('href', '/admin/kds')
  })

  test('KDS shows "Waiting for orders" empty state when no active orders', async ({ page }) => {
    await signIn(page)
    await page.goto('/admin/kds')
    await expect(page.getByText('Waiting for orders')).toBeVisible()
  })

  test('KDS renders order tickets with Bump button and no horizontal scrollbar', async ({ page }) => {
    const tableId = await createTestTable(svc, restaurantId, 1)
    const items = [{ name: 'Burger', quantity: 1, variants: [], unit_price_cents: 1500 }]
    const t1 = new Date(Date.now() - 120_000).toISOString()
    const t2 = new Date(Date.now() - 60_000).toISOString()
    await createTestOrder(svc, restaurantId, tableId, items, t1)
    await createTestOrder(svc, restaurantId, tableId, items, t2)

    // Sign in at the default viewport (login UI is not guaranteed responsive at 360px), then resize.
    await signIn(page)
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/admin/kds')

    // At least one ticket article visible
    const ticket = page.locator('article').first()
    await expect(ticket).toBeVisible()

    // Bump button is visible inside the first ticket
    const bumpBtn = ticket.getByRole('button', { name: /bump/i })
    await expect(bumpBtn).toBeVisible()

    // No horizontal scrollbar at 360px — wait for layout to settle
    await page.waitForFunction(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      undefined,
      { timeout: 2000 },
    )

    // No horizontal scrollbar at 1280px
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.waitForFunction(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      undefined,
      { timeout: 2000 },
    )
  })
})
