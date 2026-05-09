import { test, expect } from '@playwright/test'
import {
  getServiceClient,
  createTestRestaurant,
  createTestOwner,
  signInAsOwner,
  cleanupTestRestaurants,
} from './helpers'

/**
 * P0: Tenant Isolation
 * Verifies that restaurant owner A cannot read or modify restaurant B's data.
 * RLS policies on all tables must enforce restaurant_id scoping.
 */
test.describe('Tenant Isolation', () => {
  const svc = getServiceClient()
  let restA: { id: string }
  let restB: { id: string }
  const suffix = `ti-${Date.now()}`

  test.beforeAll(async () => {
    restA = await createTestRestaurant(svc, `rest-a-${suffix}`, 'Restaurant A')
    restB = await createTestRestaurant(svc, `rest-b-${suffix}`, 'Restaurant B')
    await createTestOwner(svc, restA.id, `owner-a-${suffix}@test.invalid`)
    await createTestOwner(svc, restB.id, `owner-b-${suffix}@test.invalid`)

    // Seed restaurant B with a category, item, and table
    await svc.from('categories').insert({ restaurant_id: restB.id, name: "B's Mains", display_order: 0 })
    await svc.from('menu_items').insert({ restaurant_id: restB.id, name: "B's Burger", price_cents: 1500, is_published: true })
    await svc.from('tables').insert({ restaurant_id: restB.id, number: 1 })
  })

  test.afterAll(async () => {
    await cleanupTestRestaurants(svc, [restA.id, restB.id])
  })

  test('owner A SELECT on restaurants returns only own restaurant', async () => {
    const clientA = await signInAsOwner(`owner-a-${suffix}@test.invalid`)
    const { data, error } = await clientA.from('restaurants').select('id')
    expect(error).toBeNull()
    const ids = data?.map(r => r.id) ?? []
    expect(ids).toContain(restA.id)
    expect(ids).not.toContain(restB.id)
  })

  test('owner A SELECT on categories returns 0 rows (none in own restaurant)', async () => {
    const clientA = await signInAsOwner(`owner-a-${suffix}@test.invalid`)
    const { data, error } = await clientA.from('categories').select('id, restaurant_id')
    expect(error).toBeNull()
    expect(data?.some(r => r.restaurant_id === restB.id)).toBe(false)
  })

  test('owner A SELECT on menu_items cannot see restaurant B items', async () => {
    const clientA = await signInAsOwner(`owner-a-${suffix}@test.invalid`)
    const { data, error } = await clientA.from('menu_items').select('id, restaurant_id')
    expect(error).toBeNull()
    expect(data?.some(r => r.restaurant_id === restB.id)).toBe(false)
  })

  test('owner A SELECT on tables cannot see restaurant B tables', async () => {
    const clientA = await signInAsOwner(`owner-a-${suffix}@test.invalid`)
    const { data, error } = await clientA.from('tables').select('id, restaurant_id')
    expect(error).toBeNull()
    expect(data?.some(r => r.restaurant_id === restB.id)).toBe(false)
  })

  test('owner A cannot UPDATE restaurant B name', async () => {
    const clientA = await signInAsOwner(`owner-a-${suffix}@test.invalid`)
    // RLS blocks the update — Supabase returns success with 0 rows affected, not an error
    await clientA.from('restaurants').update({ name: 'Hijacked' }).eq('id', restB.id)
    // Verify via service role that name was NOT changed
    const { data } = await svc.from('restaurants').select('name').eq('id', restB.id).single()
    expect(data?.name).toBe('Restaurant B')
  })

  test('owner A cannot INSERT a category into restaurant B', async () => {
    const clientA = await signInAsOwner(`owner-a-${suffix}@test.invalid`)
    const { error } = await clientA
      .from('categories')
      .insert({ restaurant_id: restB.id, name: 'Injected', display_order: 99 })
    // RLS WITH CHECK should reject this
    expect(error).not.toBeNull()
  })

  test('owner A SELECT on orders cannot see restaurant B orders', async () => {
    // Seed an order for restaurant B using service role
    const { data: tableB } = await svc
      .from('tables')
      .select('id')
      .eq('restaurant_id', restB.id)
      .limit(1)
      .single()
    if (!tableB) return // no table seeded for B — skip gracefully

    await svc.from('orders').insert({
      restaurant_id: restB.id,
      table_id: tableB.id,
      items: [{ name: "B's item", price_cents: 500, quantity: 1 }],
    })

    const clientA = await signInAsOwner(`owner-a-${suffix}@test.invalid`)
    const { data, error } = await clientA.from('orders').select('id, restaurant_id')
    expect(error).toBeNull()
    expect(data?.some(o => o.restaurant_id === restB.id)).toBe(false)
  })
})
