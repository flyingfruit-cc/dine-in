import { test, expect } from '@playwright/test'
import {
  getServiceClient,
  createTestRestaurant,
  createTestOwner,
  signInAsOwner,
  cleanupTestRestaurants,
  cleanupTestUsers,
} from './helpers'

/**
 * P0: Analytics RLS tenant isolation
 * Verifies that the get_restaurant_analytics function respects RLS:
 *   - Owner can query their own restaurant's analytics
 *   - Owner cannot see another tenant's analytics (returns zero aggregates)
 *   - Service role (platform admin) can access any tenant's analytics
 */
test.describe('Analytics RLS — tenant isolation', () => {
  const svc = getServiceClient()
  const suffix = `an-${Date.now()}`

  let restaurantA: { id: string }
  let restaurantB: { id: string }
  let ownerAId: string
  let ownerBId: string

  const P_START = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  // Far-future upper bound — beforeAll seeding can exceed 60s on slow CI, so a
  // tight buffer caused flaky exclusion of orders inserted late in setup.
  const P_END   = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // +1 day

  test.beforeAll(async () => {
    restaurantA = await createTestRestaurant(svc, `an-a-${suffix}`, 'Analytics Restaurant A')
    restaurantB = await createTestRestaurant(svc, `an-b-${suffix}`, 'Analytics Restaurant B')

    const ownerA = await createTestOwner(svc, restaurantA.id, `an-owner-a-${suffix}@test.invalid`)
    const ownerB = await createTestOwner(svc, restaurantB.id, `an-owner-b-${suffix}@test.invalid`)
    ownerAId = ownerA.id
    ownerBId = ownerB.id

    // Seed one table per restaurant
    const { data: tableA } = await svc
      .from('tables')
      .insert({ restaurant_id: restaurantA.id, number: 1 })
      .select('id')
      .single()

    const { data: tableB } = await svc
      .from('tables')
      .insert({ restaurant_id: restaurantB.id, number: 1 })
      .select('id')
      .single()

    if (!tableA || !tableB) throw new Error('Failed to seed tables')

    // Seed 5 orders for each restaurant with proper unit_price_cents shape
    const ordersA = Array.from({ length: 5 }, (_, i) => ({
      restaurant_id: restaurantA.id,
      table_id: tableA.id,
      items: [{ name: `Item A${i}`, quantity: 1, variants: [], unit_price_cents: 1000 }],
      total_cents: 1000,
    }))
    const ordersB = Array.from({ length: 5 }, (_, i) => ({
      restaurant_id: restaurantB.id,
      table_id: tableB.id,
      items: [{ name: `Item B${i}`, quantity: 1, variants: [], unit_price_cents: 1500 }],
      total_cents: 1500,
    }))

    await svc.from('orders').insert(ordersA)
    await svc.from('orders').insert(ordersB)
  })

  test.afterAll(async () => {
    await cleanupTestRestaurants(svc, [restaurantA.id, restaurantB.id])
    await cleanupTestUsers(svc, [ownerAId, ownerBId])
  })

  test('owner A gets own analytics (order_count = 5, top_items non-empty)', async () => {
    const clientA = await signInAsOwner(`an-owner-a-${suffix}@test.invalid`)
    const { data, error } = await clientA.rpc('get_restaurant_analytics', {
      p_restaurant_id: restaurantA.id,
      p_start: P_START,
      p_end: P_END,
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    const result = data as { order_count: number; top_items: unknown[]; total_revenue_cents: number }
    expect(result.order_count).toBe(5)
    expect(result.top_items.length).toBeGreaterThan(0)
    expect(result.total_revenue_cents).toBe(5000) // 5 orders × 1000 cents
  })

  test('owner A gets zero aggregates when querying restaurant B (cross-tenant blocked by RLS)', async () => {
    const clientA = await signInAsOwner(`an-owner-a-${suffix}@test.invalid`)
    const { data, error } = await clientA.rpc('get_restaurant_analytics', {
      p_restaurant_id: restaurantB.id,
      p_start: P_START,
      p_end: P_END,
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    const result = data as { order_count: number; total_revenue_cents: number; top_items: unknown[] }
    // RLS filters out restaurant B's orders — owner A sees zero aggregates
    expect(result.order_count).toBe(0)
    expect(result.total_revenue_cents).toBe(0)
    expect(result.top_items).toEqual([])
  })

  test('service role (platform admin path) can access restaurant B analytics', async () => {
    const { data, error } = await svc.rpc('get_restaurant_analytics', {
      p_restaurant_id: restaurantB.id,
      p_start: P_START,
      p_end: P_END,
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    const result = data as { order_count: number; total_revenue_cents: number }
    expect(result.order_count).toBe(5)
    expect(result.total_revenue_cents).toBe(7500) // 5 orders × 1500 cents
  })
})

/**
 * Performance smoke test — skipped by default.
 * To run manually: remove `.skip` and ensure `supabase start` is running.
 * Seeds 10,000 orders and asserts the analytics RPC completes in < 1000ms.
 */
test.describe.skip('Analytics performance (manual)', () => {
  const svc = getServiceClient()
  const suffix = `an-perf-${Date.now()}`

  let restaurantPerf: { id: string }

  test.beforeAll(async () => {
    restaurantPerf = await createTestRestaurant(svc, `perf-${suffix}`, 'Perf Restaurant')
    const { data: table } = await svc
      .from('tables')
      .insert({ restaurant_id: restaurantPerf.id, number: 1 })
      .select('id')
      .single()
    if (!table) throw new Error('Failed to create perf table')

    // Seed 10,000 orders in 1,000-row chunks
    const CHUNK = 1000
    const TOTAL = 10000
    for (let i = 0; i < TOTAL; i += CHUNK) {
      const rows = Array.from({ length: CHUNK }, (_, j) => ({
        restaurant_id: restaurantPerf.id,
        table_id: table.id,
        items: [{ name: `Item${(i + j) % 20}`, quantity: 1, variants: [], unit_price_cents: 1000 }],
        total_cents: 1000,
        submitted_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      }))
      const { error } = await svc.from('orders').insert(rows)
      if (error) throw new Error(`Batch insert failed at offset ${i}: ${error.message}`)
    }
  })

  test.afterAll(async () => {
    await cleanupTestRestaurants(svc, [restaurantPerf.id])
  })

  test('get_restaurant_analytics returns in < 1000ms over 10k rows (90d window)', async () => {
    const p_start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const p_end   = new Date().toISOString()

    const t0 = performance.now()
    const { data, error } = await svc.rpc('get_restaurant_analytics', {
      p_restaurant_id: restaurantPerf.id,
      p_start,
      p_end,
    })
    const elapsed = performance.now() - t0

    console.log(`[perf] get_restaurant_analytics over 10k rows: ${elapsed.toFixed(1)}ms`)

    expect(error).toBeNull()
    expect(elapsed).toBeLessThan(1000)

    const result = data as { order_count: number }
    expect(result.order_count).toBe(10000)
  })
})
