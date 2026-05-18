import { test, expect, type Page } from '@playwright/test'
import {
  getServiceClient,
  createTestRestaurant,
  createTestOwner,
  createTestPlatformAdmin,
  cleanupTestRestaurants,
  cleanupTestUsers,
} from '../rls/helpers'

const TEST_PASSWORD = 'Test1234!'

test.describe('Platform admin tenant inspection', () => {
  const svc = getServiceClient()
  const suffix = `ti-${Date.now()}`
  let restaurant: { id: string; name: string; slug: string }
  let restaurantB: { id: string; name: string }
  let adminId: string
  const adminEmail = `ti-admin-${suffix}@test.invalid`
  const ownerEmail = `ti-owner-${suffix}@test.invalid`

  test.beforeAll(async () => {
    const slug = `ti-rest-${suffix}`
    const name = `TI Test Restaurant ${suffix}`
    restaurant = { ...(await createTestRestaurant(svc, slug, name)), slug, name }
    restaurantB = await createTestRestaurant(svc, `ti-rest-b-${suffix}`, `TI Other Restaurant ${suffix}`)

    await createTestOwner(svc, restaurant.id, ownerEmail)
    const admin = await createTestPlatformAdmin(svc, adminEmail)
    adminId = admin.id

    // Seed: table
    const { data: tableData, error: tableErr } = await svc
      .from('tables')
      .insert({ restaurant_id: restaurant.id, number: 1 })
      .select()
      .single()
    if (tableErr || !tableData) throw new Error(`table insert failed: ${tableErr?.message}`)

    // Seed: menu item
    await svc
      .from('menu_items')
      .insert({ restaurant_id: restaurant.id, name: 'Test Item', price_cents: 1500 })

    // Seed: order
    await svc
      .from('orders')
      .insert({
        restaurant_id: restaurant.id,
        table_id: tableData.id,
        items: [{ name: 'Test Item', quantity: 1, variants: [] }],
      })
  })

  test.afterAll(async () => {
    await cleanupTestRestaurants(svc, [restaurant.id, restaurantB.id])
    if (adminId) await cleanupTestUsers(svc, [adminId])
  })

  async function signIn(page: Page, email: string) {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /log in/i }).click()
    await page.waitForURL(/\/admin/)
  }

  test('platform admin can navigate from tenant list to detail page via row link', async ({ page }) => {
    await signIn(page, adminEmail)
    await page.goto('/platform/tenants')

    await page.getByText(restaurant.name).click()
    await page.waitForURL(new RegExp(`/platform/tenants/${restaurant.id}`))
    expect(page.url()).toContain(restaurant.id)
  })

  test('detail page shows all summary fields', async ({ page }) => {
    await signIn(page, adminEmail)
    await page.goto(`/platform/tenants/${restaurant.id}`)
    await page.waitForURL(new RegExp(`/platform/tenants/${restaurant.id}`))

    // Name and slug
    await expect(page.getByRole('heading', { name: restaurant.name })).toBeVisible()
    await expect(page.getByText(restaurant.slug)).toBeVisible()

    // Owner email
    await expect(page.getByText(ownerEmail)).toBeVisible()

    // Signup date — just check "Account Summary" section has year
    const summarySection = page.locator('section').first()
    await expect(summarySection.getByText(/202/)).toBeVisible()

    // Published/Offline badge
    const badge = page.getByText(/published|offline/i).first()
    await expect(badge).toBeVisible()

    // Table count and menu item count are scoped to the summary <dl>, where each
    // <dt>/<dd> pair labels the value. Asserting against the <dl> avoids matching
    // "1" elsewhere on the page (slug suffix, "Table 1", QR URL "/1").
    const summary = page.locator('dl').first()
    await expect(summary.getByText('Tables').locator('xpath=following-sibling::dd')).toHaveText('1')
    await expect(summary.getByText('Menu items').locator('xpath=following-sibling::dd')).toHaveText('1')
  })

  test('detail page shows tables section with QR URL', async ({ page }) => {
    await signIn(page, adminEmail)
    await page.goto(`/platform/tenants/${restaurant.id}`)

    await expect(page.getByRole('heading', { name: /tables/i })).toBeVisible()
    await expect(page.getByText('Table 1')).toBeVisible()

    // QR URL contains slug and table number
    await expect(page.getByText(new RegExp(`${restaurant.slug}/1`))).toBeVisible()
  })

  test('detail page shows menu items and recent orders', async ({ page }) => {
    await signIn(page, adminEmail)
    await page.goto(`/platform/tenants/${restaurant.id}`)

    // Menu items section
    await expect(page.getByRole('heading', { name: /menu items/i })).toBeVisible()
    await expect(page.getByText('Test Item')).toBeVisible()
    await expect(page.getByText('$15.00')).toBeVisible()

    // Recent orders section
    await expect(page.getByRole('heading', { name: /recent orders/i })).toBeVisible()
    // The seeded order's item summary should appear
    const ordersSection = page.locator('section').last()
    await expect(ordersSection.getByText(/test item/i)).toBeVisible()
    await expect(ordersSection.getByText(/pending/i)).toBeVisible()
  })

  test('detail page data is scoped to the specific restaurant', async ({ page }) => {
    await signIn(page, adminEmail)
    await page.goto(`/platform/tenants/${restaurant.id}`)

    // Restaurant B name must NOT appear on restaurant A's detail page
    await expect(page.getByText(restaurantB.name)).not.toBeVisible()
  })
})
