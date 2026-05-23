import { test, type Page } from '@playwright/test'
import { mkdir } from 'fs/promises'
import { resolve, join } from 'path'
import {
  getServiceClient,
  createTestRestaurant,
  createTestOwner,
  createTestTable,
  cleanupTestRestaurants,
  cleanupTestUsers,
} from '../rls/helpers'

const TEST_PASSWORD = 'Test1234!'
const OUT_DIR = resolve(__dirname, '../../docs/screenshots')

// Gated so the README screenshot pipeline doesn't run during normal `npm run test:e2e`.
// Run with: CAPTURE_SCREENSHOTS=1 npx playwright test tests/e2e/capture-screenshots.spec.ts
const RUN = process.env.CAPTURE_SCREENSHOTS === '1'
const describe = RUN ? test.describe : test.describe.skip

describe('Capture UI screenshots for README', () => {
  test.describe.configure({ mode: 'serial' })

  const svc = getServiceClient()
  const suffix = `shot-${Date.now()}`
  const slug = `demo-${suffix}`
  const ownerEmail = `owner-${suffix}@test.invalid`
  let restaurantId: string
  let ownerId: string

  test.beforeAll(async () => {
    await mkdir(OUT_DIR, { recursive: true })

    const r = await createTestRestaurant(svc, slug, 'Taverna by the Sea')
    restaurantId = r.id
    await svc
      .from('restaurants')
      .update({
        is_published: true,
        supported_languages: ['en', 'es', 'fr'],
        default_language: 'en',
        has_previewed_menu: true,
        has_printed_qr: true,
      })
      .eq('id', restaurantId)

    const owner = await createTestOwner(svc, restaurantId, ownerEmail)
    ownerId = owner.id

    const { data: cats } = await svc
      .from('categories')
      .insert([
        { restaurant_id: restaurantId, name: 'Starters', display_order: 0 },
        { restaurant_id: restaurantId, name: 'Mains', display_order: 1 },
        { restaurant_id: restaurantId, name: 'Desserts', display_order: 2 },
      ])
      .select('id, name')
    const catId = (name: string) => cats!.find((c) => c.name === name)!.id

    await svc.from('menu_items').insert([
      { restaurant_id: restaurantId, category_id: catId('Starters'), name: 'Garlic Bread', price_cents: 600, description: 'Toasted ciabatta with garlic butter and parsley.', display_order: 0 },
      { restaurant_id: restaurantId, category_id: catId('Starters'), name: 'Caesar Salad', price_cents: 1100, description: 'Romaine, parmesan, croutons, anchovy dressing.', display_order: 1 },
      { restaurant_id: restaurantId, category_id: catId('Starters'), name: 'Soup of the Day', price_cents: 850, description: 'Ask your server for today’s soup.', display_order: 2 },
      { restaurant_id: restaurantId, category_id: catId('Mains'), name: 'Margherita Pizza', price_cents: 1600, description: 'San Marzano tomato, fior di latte, basil, olive oil.', display_order: 0 },
      { restaurant_id: restaurantId, category_id: catId('Mains'), name: 'Spaghetti Carbonara', price_cents: 1800, description: 'Guanciale, pecorino, egg yolk, black pepper.', display_order: 1 },
      { restaurant_id: restaurantId, category_id: catId('Mains'), name: 'Grilled Branzino', price_cents: 2600, description: 'Whole roasted, lemon, salsa verde.', display_order: 2 },
      { restaurant_id: restaurantId, category_id: catId('Desserts'), name: 'Tiramisu', price_cents: 900, description: 'Mascarpone, espresso, savoiardi, cocoa.', display_order: 0 },
      { restaurant_id: restaurantId, category_id: catId('Desserts'), name: 'Affogato', price_cents: 700, description: 'Vanilla gelato, hot espresso.', display_order: 1 },
    ])

    const tableIds: string[] = []
    for (const n of [1, 2, 3, 4]) {
      tableIds.push(await createTestTable(svc, restaurantId, n))
    }

    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const hour = 60 * 60 * 1000

    // Active orders — status 'preparing' so they appear in KDS and Orders > Active.
    const active = [
      { t: 0, items: [{ name: 'Margherita Pizza', quantity: 2, variants: [], unit_price_cents: 1600 }, { name: 'Caesar Salad', quantity: 1, variants: [], unit_price_cents: 1100 }], total: 4300, agoMin: 4 },
      { t: 1, items: [{ name: 'Spaghetti Carbonara', quantity: 1, variants: [], unit_price_cents: 1800 }, { name: 'Tiramisu', quantity: 1, variants: [], unit_price_cents: 900 }], total: 2700, agoMin: 9 },
      { t: 2, items: [{ name: 'Grilled Branzino', quantity: 1, variants: [], unit_price_cents: 2600 }, { name: 'Affogato', quantity: 2, variants: [], unit_price_cents: 700 }], total: 4000, agoMin: 14 },
      { t: 3, items: [{ name: 'Garlic Bread', quantity: 2, variants: [], unit_price_cents: 600 }, { name: 'Margherita Pizza', quantity: 1, variants: [], unit_price_cents: 1600 }], total: 2800, agoMin: 21 },
    ]
    for (const o of active) {
      const submittedAt = new Date(now - o.agoMin * 60 * 1000).toISOString()
      await svc.from('orders').insert({
        restaurant_id: restaurantId,
        table_id: tableIds[o.t],
        items: o.items,
        submitted_at: submittedAt,
        is_handled: false,
        handled_at: null,
        total_cents: o.total,
        status: 'preparing',
      })
    }

    // ~36 completed orders spread across the last 7 days so analytics renders
    // (emptyState threshold is 30 in lib/analytics/getRestaurantAnalytics.ts).
    const menu = [
      { name: 'Garlic Bread', price: 600 },
      { name: 'Caesar Salad', price: 1100 },
      { name: 'Soup of the Day', price: 850 },
      { name: 'Margherita Pizza', price: 1600 },
      { name: 'Spaghetti Carbonara', price: 1800 },
      { name: 'Grilled Branzino', price: 2600 },
      { name: 'Tiramisu', price: 900 },
      { name: 'Affogato', price: 700 },
    ]
    let seed = 1
    const rand = () => {
      // Tiny deterministic PRNG so re-runs produce identical analytics.
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    for (let d = 0; d < 7; d++) {
      const ordersThisDay = 4 + Math.floor(rand() * 4) // 4–7 orders/day
      for (let i = 0; i < ordersThisDay; i++) {
        const itemCount = 1 + Math.floor(rand() * 3)
        const items: Array<{ name: string; quantity: number; variants: string[]; unit_price_cents: number }> = []
        let total = 0
        for (let j = 0; j < itemCount; j++) {
          const m = menu[Math.floor(rand() * menu.length)]
          const qty = 1 + Math.floor(rand() * 2)
          items.push({ name: m.name, quantity: qty, variants: [], unit_price_cents: m.price })
          total += m.price * qty
        }
        // Spread submission times across a 10-hour service window (11am–9pm)
        const hourOfDay = 11 + rand() * 10
        const submittedAt = new Date(now - d * day - (24 - hourOfDay) * hour).toISOString()
        const tableIdx = Math.floor(rand() * tableIds.length)
        await svc.from('orders').insert({
          restaurant_id: restaurantId,
          table_id: tableIds[tableIdx],
          items,
          submitted_at: submittedAt,
          is_handled: true,
          handled_at: new Date(Date.parse(submittedAt) + 15 * 60 * 1000).toISOString(),
          total_cents: total,
          status: 'completed',
        })
      }
    }
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

  async function shot(page: Page, name: string) {
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: true })
  }

  test('customer menu (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/${slug}/1`)
    await shot(page, 'customer-menu')
  })

  test('admin dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)
    await page.goto('/admin')
    await shot(page, 'admin-dashboard')
  })

  test('admin analytics', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page)
    await page.goto('/admin/analytics')
    await shot(page, 'admin-analytics')
  })
})
