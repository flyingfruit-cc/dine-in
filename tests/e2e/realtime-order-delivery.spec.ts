import { test, expect, type Page } from '@playwright/test'
import {
  getServiceClient,
  createTestRestaurant,
  createTestOwner,
  cleanupTestRestaurants,
} from '../rls/helpers'

const TEST_PASSWORD = 'Test1234!'

test.describe('Realtime order delivery to admin feed', () => {
  const svc = getServiceClient()
  const suffix = `rt-${Date.now()}`
  let restaurantId: string
  let tableId: string
  const ownerEmail = `rt-${suffix}@test.invalid`

  test.beforeAll(async () => {
    const restaurant = await createTestRestaurant(svc, `rt-${suffix}`, 'Realtime Test Restaurant')
    restaurantId = restaurant.id
    await createTestOwner(svc, restaurantId, ownerEmail)

    const { data: table, error } = await svc
      .from('tables')
      .insert({ restaurant_id: restaurantId, number: 7 })
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

  test('newly inserted order appears in the Active feed within 5 seconds', async ({ page }) => {
    await signIn(page)
    await page.goto('/admin/orders')

    // Wait for the page to mount + RealtimeProvider to hydrate (empty feed shown).
    await expect(page.getByText(/no orders yet/i)).toBeVisible()

    // Wait for a deterministic readiness signal exposed by RealtimeProvider.
    // The store flips isRealtimeReady=true when the channel reports SUBSCRIBED.
    await page.waitForSelector('[data-realtime-ready="true"]', { timeout: 10_000 })

    // Insert an order via the service client — simulates the post-submitOrder DB state.
    const { error } = await svc.from('orders').insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      items: [{ name: 'Smoke Burger', quantity: 1, variants: [] }],
      is_handled: false,
    })
    expect(error).toBeNull()

    // OrderCard must appear within 5 seconds of the INSERT (AC1 / NFR2).
    await expect(page.getByText('Table 7')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/Smoke Burger/)).toBeVisible({ timeout: 5_000 })
  })
})
