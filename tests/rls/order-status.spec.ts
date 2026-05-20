import { test, expect } from '@playwright/test'
import {
  getServiceClient,
  getAnonClient,
  createTestRestaurant,
  createTestOwner,
  signInAsOwner,
  createTestTable,
  createTestOrder,
  cleanupTestRestaurants,
  cleanupTestUsers,
} from './helpers'

/**
 * P0: Order Status RLS
 * Verifies the order_status enum migration, owner advance RLS, cross-tenant denial,
 * and the permissive anon SELECT policy added in Story 9.1.
 */
test.describe('Order Status', () => {
  const svc = getServiceClient()
  const suffix = `os-${Date.now()}`

  let restA: { id: string }
  let restB: { id: string }
  let ownerAId: string
  let ownerBId: string
  let tableAId: string
  let tableBId: string
  let orderAId: string

  test.beforeAll(async () => {
    restA = await createTestRestaurant(svc, `rest-os-a-${suffix}`, 'OS Restaurant A')
    restB = await createTestRestaurant(svc, `rest-os-b-${suffix}`, 'OS Restaurant B')
    const ownerA = await createTestOwner(svc, restA.id, `owner-os-a-${suffix}@test.invalid`)
    const ownerB = await createTestOwner(svc, restB.id, `owner-os-b-${suffix}@test.invalid`)
    ownerAId = ownerA.id
    ownerBId = ownerB.id

    tableAId = await createTestTable(svc, restA.id, 1)
    tableBId = await createTestTable(svc, restB.id, 1)
    orderAId = await createTestOrder(
      svc,
      restA.id,
      tableAId,
      [{ name: 'Test Item', quantity: 1, variants: [], unit_price_cents: 1000 }],
    )
  })

  test.afterAll(async () => {
    await cleanupTestRestaurants(svc, [restA.id, restB.id])
    await cleanupTestUsers(svc, [ownerAId, ownerBId])
  })

  test('new orders default to status="received" (migration DEFAULT clause)', async () => {
    // Asserts the migration's `ALTER COLUMN status SET DEFAULT 'received'` is in effect.
    // The migration's one-shot backfill UPDATE cannot be re-tested post-hoc (it ran once
    // against this DB), so the DEFAULT clause is the observable migration behavior.
    const orderId = await createTestOrder(svc, restA.id, tableAId, [
      { name: 'Default Test', quantity: 1, variants: [], unit_price_cents: 100 },
    ])
    const { data } = await svc
      .from('orders')
      .select('status, is_handled')
      .eq('id', orderId)
      .single()
    expect(data?.status).toBe('received')
    expect(data?.is_handled).toBe(false)
  })

  test('backfill invariant: is_handled=true ⇔ status="completed" across all rows', async () => {
    // The migration backfilled status from is_handled via CASE. Subsequent rows are
    // maintained by advanceOrderStatus, which atomically sets both fields on the
    // completed transition. This test asserts the invariant across the entire table
    // — catches a botched backfill OR any future drift in the action.
    const { data, error } = await svc
      .from('orders')
      .select('id, is_handled, status')

    expect(error).toBeNull()
    expect(data).not.toBeNull()

    const violations = (data ?? []).filter(
      (row) =>
        (row.is_handled === true && row.status !== 'completed') ||
        (row.is_handled === false && row.status === 'completed'),
    )

    expect(violations).toEqual([])
  })

  test('AC #4 invalid-transition: DB does NOT enforce transitions; advanceOrderStatus validator is the only enforcement', async () => {
    // Per Task 1: "DO NOT add a CHECK constraint that enforces transitions in SQL".
    // The Server Action's VALID_NEXT_STATUS map is the sole enforcement layer.
    // Per-transition validator behavior is exhaustively covered in
    // tests/unit/actions/orderActions.test.ts.
    //
    // This RLS-layer test verifies the schema design: a skip-ahead UPDATE via raw
    // owner client succeeds at SQL level. The action would NEVER issue this UPDATE
    // (it returns 'Invalid status transition' first), so DB rows remain unchanged
    // when the action's validator path is taken — satisfying AC #4 second clause.
    const orderId = await createTestOrder(svc, restA.id, tableAId, [
      { name: 'AC4 Skip-Ahead Probe', quantity: 1, variants: [], unit_price_cents: 100 },
    ])

    const clientA = await signInAsOwner(`owner-os-a-${suffix}@test.invalid`)
    const { error, count } = await clientA
      .from('orders')
      .update({ status: 'ready' }, { count: 'exact' })
      .eq('id', orderId)
      .eq('status', 'received')

    // DB allows the skip-ahead — validator is the only barrier.
    expect(error).toBeNull()
    expect(count).toBe(1)

    // Restore valid state so subsequent table-wide invariant assertions remain clean.
    await svc.from('orders').update({ status: 'received' }).eq('id', orderId)
  })

  test('owner can advance their own order: received → preparing → ready → completed', async () => {
    const clientA = await signInAsOwner(`owner-os-a-${suffix}@test.invalid`)

    // received → preparing
    const { error: e1 } = await clientA
      .from('orders')
      .update({ status: 'preparing' })
      .eq('id', orderAId)
      .eq('status', 'received')
    expect(e1).toBeNull()

    const { data: r1 } = await svc.from('orders').select('status').eq('id', orderAId).single()
    expect(r1?.status).toBe('preparing')

    // preparing → ready
    const { error: e2 } = await clientA
      .from('orders')
      .update({ status: 'ready' })
      .eq('id', orderAId)
      .eq('status', 'preparing')
    expect(e2).toBeNull()

    const { data: r2 } = await svc.from('orders').select('status').eq('id', orderAId).single()
    expect(r2?.status).toBe('ready')

    // ready → completed (atomic: sets is_handled + handled_at too, as the Server Action does)
    const completedAt = new Date().toISOString()
    const { error: e3 } = await clientA
      .from('orders')
      .update({ status: 'completed', is_handled: true, handled_at: completedAt })
      .eq('id', orderAId)
      .eq('status', 'ready')
    expect(e3).toBeNull()

    const { data: r3 } = await svc
      .from('orders')
      .select('status, is_handled, handled_at')
      .eq('id', orderAId)
      .single()
    expect(r3?.status).toBe('completed')
    expect(r3?.is_handled).toBe(true)
    expect(r3?.handled_at).not.toBeNull()
  })

  test('cross-tenant owner cannot update another restaurant\'s order — 0 rows affected, status unchanged', async () => {
    // Create an order in restB
    const orderBId = await createTestOrder(
      svc,
      restB.id,
      tableBId,
      [{ name: 'B Item', quantity: 1, variants: [], unit_price_cents: 800 }],
    )

    // Owner A tries to advance owner B's order
    const clientA = await signInAsOwner(`owner-os-a-${suffix}@test.invalid`)
    const { error } = await clientA
      .from('orders')
      .update({ status: 'preparing' })
      .eq('id', orderBId)
      .eq('status', 'received')
    // RLS returns success with 0 rows matched — no error, no mutation
    expect(error).toBeNull()

    // Verify via service role that status was NOT changed
    const { data } = await svc
      .from('orders')
      .select('status')
      .eq('id', orderBId)
      .single()
    expect(data?.status).toBe('received')

    // Owner A SELECT also returns 0 rows for order B (owner_select_orders RLS)
    const { data: rows } = await clientA
      .from('orders')
      .select('id')
      .eq('id', orderBId)
    expect(rows?.length ?? 0).toBe(0)
  })

  test('anon role can SELECT an order by id via the orders_customer_status view (id + status only)', async () => {
    // After code-review D1, anon's only path to read order state is the
    // orders_customer_status view. The view exposes (id, status) only —
    // items / total_cents / restaurant_id / table_id / handled_at are no
    // longer reachable via the anon role.
    const anonClient = getAnonClient()
    const { data, error } = await anonClient
      .from('orders_customer_status')
      .select('id, status')
      .eq('id', orderAId)
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
    expect(data?.[0]?.id).toBe(orderAId)
    expect(typeof data?.[0]?.status).toBe('string')
  })

  test('anon role CANNOT SELECT public.orders directly — view is the only path', async () => {
    // The customer_select_order_by_id policy was dropped in migration
    // 20260520170000_replace_orders_customer_select_with_view.sql.
    // Anon SELECTs on public.orders should now return 0 rows (no policy matches).
    const anonClient = getAnonClient()
    const { data, error } = await anonClient
      .from('orders')
      .select('id, status')
      .eq('id', orderAId)
    expect(error).toBeNull()
    expect(data?.length ?? 0).toBe(0)
  })

  test('anon role can SELECT any order by id (any tenant) via the view — server-side tuple validation owns the security boundary', async () => {
    // INTENTIONAL assertion that the view's grant is permissive by design.
    // GRANT SELECT ON orders_customer_status TO anon allows any UUID lookup.
    // Security relies on UUID entropy (~10^36) as an implicit auth token; the
    // (restaurant_slug, table_number, order_id) tuple is validated server-side via
    // the admin-client SSR fetch in Story 9.3 before order_id reaches the client.
    // See Dev Notes "Customer auth model" in story 9-1-order-status-data-model-server-action.md.
    // If this test fails, a migration tightened the grant WITHOUT updating Story 9.3's
    // server-side validation — investigate before merging.
    const anonClient = getAnonClient()

    // Create a second order in restB that anon should be able to see via the view
    const anonTestOrderId = await createTestOrder(
      svc,
      restB.id,
      tableBId,
      [{ name: 'Anon Test Item', quantity: 1, variants: [], unit_price_cents: 300 }],
    )

    const { data, error } = await anonClient
      .from('orders_customer_status')
      .select('id, status')
      .eq('id', anonTestOrderId)
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
  })
})
