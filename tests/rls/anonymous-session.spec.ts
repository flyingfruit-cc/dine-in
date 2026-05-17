import { test, expect } from '@playwright/test'
import {
  getServiceClient,
  createTestRestaurant,
  createAnonCustomerClient,
  cleanupTestRestaurants,
  cleanupTestUsers,
} from './helpers'

/**
 * P0: Anonymous Session Scoping
 * Verifies that anonymous customer JWTs are scoped to their restaurant + table.
 *
 * PREREQUISITE: custom_access_token_hook must be registered in Supabase Dashboard:
 *   Authentication → Hooks → Custom Access Token → public.custom_access_token_hook
 *   Without this, app_metadata claims won't appear in JWTs and all tests will fail.
 */
test.describe('Anonymous Session Scoping', () => {
  const svc = getServiceClient()
  const suffix = `anon-${Date.now()}`
  let restA: { id: string }
  let restB: { id: string }
  let tableA: { id: string; number: number }
  const createdAnonUserIds: string[] = []

  test.beforeAll(async () => {
    restA = await createTestRestaurant(svc, `anon-rest-a-${suffix}`, 'Anon Restaurant A')
    restB = await createTestRestaurant(svc, `anon-rest-b-${suffix}`, 'Anon Restaurant B')

    // Table for restaurant A
    const { data: t } = await svc
      .from('tables')
      .insert({ restaurant_id: restA.id, number: 5 })
      .select()
      .single()
    if (!t) throw new Error('Failed to create tableA for anon tests')
    tableA = t

    // Items in both restaurants
    await svc.from('menu_items').insert([
      { restaurant_id: restA.id, name: 'Item A1', price_cents: 1000 },
      { restaurant_id: restA.id, name: 'Item A2', price_cents: 500 },
      { restaurant_id: restB.id, name: 'Item B1', price_cents: 2000 },
    ])
  })

  test.afterAll(async () => {
    await cleanupTestUsers(svc, createdAnonUserIds)
    await cleanupTestRestaurants(svc, [restA.id, restB.id])
  })

  test('anon customer can SELECT items for own restaurant only', async () => {
    const { client, userId } = await createAnonCustomerClient(svc, restA.id, tableA.number)
    createdAnonUserIds.push(userId)

    const { data, error } = await client.from('menu_items').select('id, name, restaurant_id')
    expect(error).toBeNull()

    // Only sees restaurant A items
    expect(data?.every(i => i.restaurant_id === restA.id)).toBe(true)
    // Cannot see restaurant B
    expect(data?.some(i => i.restaurant_id === restB.id)).toBe(false)
  })

  test('anon customer can INSERT order for own restaurant and table', async () => {
    const { client, userId } = await createAnonCustomerClient(svc, restA.id, tableA.number)
    createdAnonUserIds.push(userId)

    const { error } = await client.from('orders').insert({
      restaurant_id: restA.id,
      table_id: tableA.id,
      items: [{ name: 'Item A1', price_cents: 1000, quantity: 1 }],
    })
    expect(error).toBeNull()

    // Verify order was persisted via service role
    const { data } = await svc
      .from('orders')
      .select('restaurant_id, table_id')
      .eq('restaurant_id', restA.id)
      .eq('table_id', tableA.id)
    expect(data?.length).toBeGreaterThan(0)
  })

  test('anon customer cannot INSERT order for a different restaurant', async () => {
    const { client, userId } = await createAnonCustomerClient(svc, restA.id, tableA.number)
    createdAnonUserIds.push(userId)

    // Attempt to insert an order for restaurant B (should be blocked by RLS)
    // Need a table in B — create one via service role first
    const { data: tableB } = await svc
      .from('tables')
      .insert({ restaurant_id: restB.id, number: 1 })
      .select()
      .single()
    if (!tableB) throw new Error('Failed to create tableB for cross-restaurant test')

    try {
      const { error } = await client.from('orders').insert({
        restaurant_id: restB.id,
        table_id: tableB.id,
        items: [{ name: 'Stolen item', price_cents: 1000, quantity: 1 }],
      })
      expect(error).not.toBeNull()
    } finally {
      await svc.from('tables').delete().eq('id', tableB.id)
    }
  })

  test('anon customer cannot INSERT order for wrong table number', async () => {
    const { client, userId } = await createAnonCustomerClient(svc, restA.id, tableA.number)
    createdAnonUserIds.push(userId)

    // Create a second table in restaurant A with a different number
    const { data: tableC } = await svc
      .from('tables')
      .insert({ restaurant_id: restA.id, number: 99 })
      .select()
      .single()
    if (!tableC) throw new Error('Failed to create tableC for wrong-table test')

    try {
      // JWT has table_number = tableA.number — inserting for tableC should be blocked
      const { error } = await client.from('orders').insert({
        restaurant_id: restA.id,
        table_id: tableC.id,
        items: [{ name: 'Item A1', price_cents: 1000, quantity: 1 }],
      })
      expect(error).not.toBeNull()
    } finally {
      await svc.from('tables').delete().eq('id', tableC.id)
    }
  })

  test('anon customer cannot SELECT from orders', async () => {
    const { client, userId } = await createAnonCustomerClient(svc, restA.id, tableA.number)
    createdAnonUserIds.push(userId)

    const { data, error } = await client.from('orders').select('id')
    // No SELECT policy exists for anonymous users on orders
    expect(error).toBeNull()
    expect(data?.length ?? 0).toBe(0)
  })

  test('anon customer cannot SELECT from profiles or other owner-scoped tables', async () => {
    const { client, userId } = await createAnonCustomerClient(svc, restA.id, tableA.number)
    createdAnonUserIds.push(userId)

    // profiles has no anon SELECT policy — should return empty or error
    const { data } = await client.from('profiles').select('id')
    expect(data?.length ?? 0).toBe(0)
  })

  test('tables.number unique constraint prevents duplicate table numbers per restaurant', async () => {
    const { error } = await svc.from('tables').insert({ restaurant_id: restA.id, number: 5 }) // duplicate
    expect(error).not.toBeNull()
    expect(error!.code).toBe('23505') // unique_violation
  })
})
