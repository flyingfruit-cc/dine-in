import { test, expect, type Page } from '@playwright/test'
import {
  getServiceClient,
  createTestRestaurant,
  createTestOwner,
  cleanupTestRestaurants,
} from '../rls/helpers'

const TEST_PASSWORD = 'Test1234!'

test.describe('Order mark-handled flow', () => {
  const svc = getServiceClient()
  const suffix = `mh-${Date.now()}`
  let restaurantId: string
  let tableId: string
  const ownerEmail = `mh-${suffix}@test.invalid`

  test.beforeAll(async () => {
    const restaurant = await createTestRestaurant(svc, `mh-${suffix}`, 'Mark Handled Test')
    restaurantId = restaurant.id
    await createTestOwner(svc, restaurantId, ownerEmail)

    const { data: table, error } = await svc
      .from('tables')
      .insert({ restaurant_id: restaurantId, number: 3 })
      .select()
      .single()
    if (error || !table) throw new Error(`table create failed: ${error?.message}`)
    tableId = table.id
  })

  test.afterAll(async () => {
    await cleanupTestRestaurants(svc, [restaurantId])
  })

  async function signIn(page: Page) {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(ownerEmail)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /log in/i }).click()
    await page.waitForURL(/\/admin/)
  }

  test('order marked handled moves from Active to Handled tab', async ({ page }) => {
    await signIn(page)
    await page.goto('/admin/orders')

    // Wait for Realtime to connect (deterministic signal set by RealtimeProvider)
    await page.waitForSelector('[data-realtime-ready="true"]', { timeout: 10_000 })

    // Insert a test order via service client (bypasses RLS — same accepted limitation as 5.1 e2e)
    const { error } = await svc.from('orders').insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      items: [{ name: 'Test Burger', quantity: 1, variants: [] }],
      is_handled: false,
    })
    expect(error).toBeNull()

    // Order must appear in Active tab within 8 seconds (NFR2 — allow headless timing variance)
    await expect(page.getByText('Table 3')).toBeVisible({ timeout: 8_000 })

    // Tap "Mark handled" — single tap, no confirmation dialog (AC1)
    await page.getByRole('button', { name: /mark handled/i }).click()

    // Optimistic update: order disappears from Active immediately (AC2)
    await expect(page.getByText('Table 3')).not.toBeVisible({ timeout: 3_000 })

    // Switch to Handled tab
    await page.getByRole('tab', { name: 'Handled' }).click()

    // Order must appear in Handled tab (AC4)
    await expect(page.getByText('Table 3')).toBeVisible({ timeout: 5_000 })
  })
})
