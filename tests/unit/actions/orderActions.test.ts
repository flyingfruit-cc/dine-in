// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { submitOrder, advanceOrderStatus, unbumpOrder } from '@/actions/orderActions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const RESTAURANT_ID = 'rest-uuid-111'
const TABLE_ID = 'table-uuid-222'

function makeAdminClient(overrides: {
  restaurantResult?: { data: unknown; error: unknown }
  tableResult?: { data: unknown; error: unknown }
  insertResult?: { error: unknown }
} = {}) {
  const {
    restaurantResult = { data: { id: RESTAURANT_ID, name: 'Test Restaurant' }, error: null },
    tableResult = { data: { id: TABLE_ID }, error: null },
    insertResult = { error: null },
  } = overrides

  const insertMock = vi.fn().mockResolvedValue(insertResult)

  const client = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'restaurants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(restaurantResult),
        }
      }
      if (table === 'tables') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(tableResult),
        }
      }
      if (table === 'orders') {
        return { insert: insertMock }
      }
    }),
    _insertMock: insertMock,
  }
  return client
}

describe('submitOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts unit_price_cents per item and total_cents in payload', async () => {
    const client = makeAdminClient()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    const result = await submitOrder({
      restaurantSlug: 'test-restaurant',
      tableNumber: 1,
      cartItems: [
        {
          cartItemId: 'ci-1',
          menuItemId: 'mi-1',
          name: 'Pizza',
          price_cents: 1500,
          selectedVariants: [],
        },
        {
          cartItemId: 'ci-2',
          menuItemId: 'mi-1',
          name: 'Pizza',
          price_cents: 1500,
          selectedVariants: [],
        },
      ],
    })

    expect(result.success).toBe(true)
    const insertArg = client._insertMock.mock.calls[0][0] as {
      items: Array<{ name: string; quantity: number; unit_price_cents: number }>
      total_cents: number
    }
    // Two same-item/same-variant cart items collapse into one bucket with quantity=2
    expect(insertArg.items).toHaveLength(1)
    expect(insertArg.items[0].quantity).toBe(2)
    expect(insertArg.items[0].unit_price_cents).toBe(1500)
    expect(insertArg.total_cents).toBe(3000) // 2 × 1500
  })

  it('computes total_cents correctly across multiple distinct items', async () => {
    const client = makeAdminClient()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    await submitOrder({
      restaurantSlug: 'test-restaurant',
      tableNumber: 1,
      cartItems: [
        {
          cartItemId: 'ci-1',
          menuItemId: 'mi-1',
          name: 'Pizza',
          price_cents: 1500,
          selectedVariants: [],
        },
        {
          cartItemId: 'ci-2',
          menuItemId: 'mi-2',
          name: 'Salad',
          price_cents: 900,
          selectedVariants: [],
        },
      ],
    })

    const insertArg = client._insertMock.mock.calls[0][0] as {
      items: Array<{ name: string; quantity: number; unit_price_cents: number }>
      total_cents: number
    }
    expect(insertArg.items).toHaveLength(2)
    expect(insertArg.total_cents).toBe(2400) // 1500 + 900
  })

  it('sets unit_price_cents from variant-adjusted price (price_cents on CartItem)', async () => {
    const client = makeAdminClient()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    await submitOrder({
      restaurantSlug: 'test-restaurant',
      tableNumber: 1,
      cartItems: [
        {
          cartItemId: 'ci-1',
          menuItemId: 'mi-1',
          name: 'Burger',
          price_cents: 2200,
          selectedVariants: [
            { groupId: 'g1', groupName: 'Size', optionId: 'o1', optionName: 'Large', price_cents: 200 },
          ],
        },
      ],
    })

    const insertArg = client._insertMock.mock.calls[0][0] as {
      items: Array<{ unit_price_cents: number }>
      total_cents: number
    }
    expect(insertArg.items[0].unit_price_cents).toBe(2200)
    expect(insertArg.total_cents).toBe(2200)
  })

  it('does not call .select() after insert (42501 RETURNING guard)', async () => {
    const client = makeAdminClient()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    await submitOrder({
      restaurantSlug: 'test-restaurant',
      tableNumber: 1,
      cartItems: [
        {
          cartItemId: 'ci-1',
          menuItemId: 'mi-1',
          name: 'Item',
          price_cents: 500,
          selectedVariants: [],
        },
      ],
    })

    // The insert mock chain should not have a .select() call after .insert()
    // We verify by checking the insert mock was called directly (no chained .select())
    expect(client._insertMock).toHaveBeenCalledTimes(1)
    // The result of insert() is awaited directly, not chained further
    const ordersFrom = client.from.mock.calls.find((c: string[]) => c[0] === 'orders')
    expect(ordersFrom).toBeDefined()
  })

  it('returns failure when cartItems is empty', async () => {
    const client = makeAdminClient()
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    const result = await submitOrder({
      restaurantSlug: 'test-restaurant',
      tableNumber: 1,
      cartItems: [],
    })

    expect(result.success).toBe(false)
  })
})

type OrderStatusValue = 'received' | 'preparing' | 'ready' | 'completed'

type EqCall = { col: string; val: unknown }

function makeOwnerClient(opts: {
  userId?: string | null
  currentStatus?: OrderStatusValue | null
  readError?: unknown
  updateError?: unknown
  updateCount?: number | null
} = {}) {
  const {
    userId = 'owner-1',
    currentStatus = 'received',
    readError = null,
    updateError = null,
    updateCount = 1,
  } = opts

  const updatePayloads: unknown[] = []
  const updateOptions: unknown[] = []
  const updateEqCalls: EqCall[] = []
  const selectEqCalls: EqCall[] = []

  const updateEqSecond = vi.fn().mockImplementation((col: string, val: unknown) => {
    updateEqCalls.push({ col, val })
    return Promise.resolve({ error: updateError, count: updateCount })
  })
  const updateEqFirst = vi.fn().mockImplementation((col: string, val: unknown) => {
    updateEqCalls.push({ col, val })
    return { eq: updateEqSecond }
  })
  const updateMock = vi.fn((p: unknown, options?: unknown) => {
    updatePayloads.push(p)
    updateOptions.push(options)
    return { eq: updateEqFirst }
  })

  const selectSingle = vi.fn().mockResolvedValue({
    data: currentStatus === null ? null : { status: currentStatus },
    error: readError ?? null,
  })
  const selectEq = vi.fn().mockImplementation((col: string, val: unknown) => {
    selectEqCalls.push({ col, val })
    return { single: selectSingle }
  })
  const selectMock = vi.fn().mockReturnValue({ eq: selectEq })

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table !== 'orders') throw new Error('unexpected table: ' + table)
    return {
      select: selectMock,
      update: updateMock,
    }
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
    from: fromMock,
    _updatePayloads: updatePayloads,
    _updateOptions: updateOptions,
    _updateEqCalls: updateEqCalls,
    _selectEqCalls: selectEqCalls,
    _updateMock: updateMock,
  }
}

describe('advanceOrderStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('received → preparing succeeds; writes status="preparing"; filters by (id, status); uses count: "exact"', async () => {
    const client = makeOwnerClient({ currentStatus: 'received' })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await advanceOrderStatus('order-1', 'preparing')

    expect(result).toEqual({ success: true, data: undefined })
    expect(client._updatePayloads[0]).toEqual({ status: 'preparing' })
    expect(client._updateOptions[0]).toEqual({ count: 'exact' })
    expect(client._updateEqCalls).toEqual([
      { col: 'id', val: 'order-1' },
      { col: 'status', val: 'received' },
    ])
    expect(client._selectEqCalls).toEqual([{ col: 'id', val: 'order-1' }])
  })

  it('preparing → ready succeeds; writes status="ready"; filters by (id, status="preparing")', async () => {
    const client = makeOwnerClient({ currentStatus: 'preparing' })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await advanceOrderStatus('order-1', 'ready')

    expect(result.success).toBe(true)
    expect(client._updatePayloads[0]).toEqual({ status: 'ready' })
    expect(client._updateEqCalls).toEqual([
      { col: 'id', val: 'order-1' },
      { col: 'status', val: 'preparing' },
    ])
  })

  it('ready → completed writes status, is_handled=true, handled_at as ISO string in a single update', async () => {
    const client = makeOwnerClient({ currentStatus: 'ready' })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await advanceOrderStatus('order-1', 'completed')

    expect(result.success).toBe(true)
    const payload = client._updatePayloads[0] as Record<string, unknown>
    expect(payload.status).toBe('completed')
    expect(payload.is_handled).toBe(true)
    expect(typeof payload.handled_at).toBe('string')
    expect(payload.handled_at as string).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(client._updateEqCalls).toEqual([
      { col: 'id', val: 'order-1' },
      { col: 'status', val: 'ready' },
    ])
  })

  it('received → ready returns INVALID_TRANSITION and does NOT call .update()', async () => {
    const client = makeOwnerClient({ currentStatus: 'received' })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await advanceOrderStatus('order-1', 'ready')

    expect(result).toEqual({
      success: false,
      error: 'Invalid status transition',
      code: 'INVALID_TRANSITION',
    })
    expect(client._updateMock).not.toHaveBeenCalled()
  })

  it('preparing → preparing (same-status) returns INVALID_TRANSITION and does NOT call .update()', async () => {
    const client = makeOwnerClient({ currentStatus: 'preparing' })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await advanceOrderStatus('order-1', 'preparing')

    expect(result).toEqual({
      success: false,
      error: 'Invalid status transition',
      code: 'INVALID_TRANSITION',
    })
    expect(client._updateMock).not.toHaveBeenCalled()
  })

  it.each(['preparing', 'ready', 'completed'] as OrderStatusValue[])(
    'completed → %s (terminal-state invariant) returns INVALID_TRANSITION',
    async (target) => {
      const client = makeOwnerClient({ currentStatus: 'completed' })
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await advanceOrderStatus('order-1', target)

      expect(result.success).toBe(false)
      expect((result as { code?: string }).code).toBe('INVALID_TRANSITION')
      expect(client._updateMock).not.toHaveBeenCalled()
    },
  )

  it('no session returns NOT_AUTHENTICATED and does NOT read status', async () => {
    const client = makeOwnerClient({ userId: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await advanceOrderStatus('order-1', 'preparing')

    expect(result).toEqual({
      success: false,
      error: 'Not authenticated',
      code: 'NOT_AUTHENTICATED',
    })
    expect(client.from).not.toHaveBeenCalled()
  })

  it('read returning no row (RLS-denied or genuinely missing) returns NOT_FOUND', async () => {
    const client = makeOwnerClient({ currentStatus: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await advanceOrderStatus('order-1', 'preparing')

    expect(result).toEqual({
      success: false,
      error: 'Order not found',
      code: 'NOT_FOUND',
    })
    expect(client._updateMock).not.toHaveBeenCalled()
  })

  it('DB error on the status read returns NOT_FOUND (read failed)', async () => {
    const client = makeOwnerClient({ readError: { code: 'PGRST116', message: 'not found' } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await advanceOrderStatus('order-1', 'preparing')

    expect(result).toEqual({
      success: false,
      error: 'Order not found',
      code: 'NOT_FOUND',
    })
    expect(client._updateMock).not.toHaveBeenCalled()
  })

  it('DB error on the UPDATE returns UPDATE_FAILED (retryable)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const client = makeOwnerClient({ updateError: { code: 'XX000', message: 'boom' } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await advanceOrderStatus('order-1', 'preparing')

    expect(result).toEqual({
      success: false,
      error: 'Failed to update order — tap to retry',
      code: 'UPDATE_FAILED',
    })
    consoleSpy.mockRestore()
  })

  it('stale state: UPDATE matches 0 rows returns CONCURRENT_UPDATE (optimistic-concurrency miss)', async () => {
    const client = makeOwnerClient({ currentStatus: 'received', updateCount: 0 })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await advanceOrderStatus('order-1', 'preparing')

    expect(result).toEqual({
      success: false,
      error: 'Order changed — please refresh',
      code: 'CONCURRENT_UPDATE',
    })
    // Update WAS attempted with correct filters; just matched 0 rows.
    expect(client._updateMock).toHaveBeenCalledOnce()
    expect(client._updateEqCalls).toEqual([
      { col: 'id', val: 'order-1' },
      { col: 'status', val: 'received' },
    ])
  })

  it.each([
    [null, 'null'],
    [undefined, 'undefined'],
    ['shipped', 'unknown enum string'],
    ['', 'empty string'],
    ['received', 'received (never a valid destination)'],
  ])(
    'runtime guard: nextStatus=%s (%s) returns INVALID_TRANSITION without DB access',
    async (badInput, _label) => {
      const client = makeOwnerClient({ currentStatus: 'preparing' })
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await advanceOrderStatus('order-1', badInput as never)

      expect(result.success).toBe(false)
      expect((result as { code?: string }).code).toBe('INVALID_TRANSITION')
      // Should short-circuit before touching auth or DB.
      expect(client.auth.getUser).not.toHaveBeenCalled()
      expect(client.from).not.toHaveBeenCalled()
    },
  )
})

describe('unbumpOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('success path: ready → preparing writes status="preparing", is_handled=false, handled_at=null', async () => {
    const client = makeOwnerClient({ currentStatus: 'ready' })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await unbumpOrder('order-1')

    expect(result).toEqual({ success: true, data: undefined })
    const payload = client._updatePayloads[0] as Record<string, unknown>
    expect(payload.status).toBe('preparing')
    expect(payload.is_handled).toBe(false)
    expect(payload.handled_at).toBeNull()
    expect(client._updateOptions[0]).toEqual({ count: 'exact' })
    expect(client._updateEqCalls).toEqual([
      { col: 'id', val: 'order-1' },
      { col: 'status', val: 'ready' },
    ])
  })

  it('no session returns NOT_AUTHENTICATED and does NOT read status', async () => {
    const client = makeOwnerClient({ userId: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await unbumpOrder('order-1')

    expect(result).toEqual({
      success: false,
      error: 'Not authenticated',
      code: 'NOT_AUTHENTICATED',
    })
    expect(client.from).not.toHaveBeenCalled()
  })

  it('read returning no row returns NOT_FOUND', async () => {
    const client = makeOwnerClient({ currentStatus: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await unbumpOrder('order-1')

    expect(result).toEqual({
      success: false,
      error: 'Order not found',
      code: 'NOT_FOUND',
    })
    expect(client._updateMock).not.toHaveBeenCalled()
  })

  it('DB read error returns NOT_FOUND', async () => {
    const client = makeOwnerClient({ readError: { code: 'PGRST116', message: 'not found' } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await unbumpOrder('order-1')

    expect(result).toEqual({
      success: false,
      error: 'Order not found',
      code: 'NOT_FOUND',
    })
    expect(client._updateMock).not.toHaveBeenCalled()
  })

  it.each(['received', 'preparing', 'completed'] as OrderStatusValue[])(
    'INVALID_TRANSITION when current status is %s (not ready)',
    async (currentStatus) => {
      const client = makeOwnerClient({ currentStatus })
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await unbumpOrder('order-1')

      expect(result).toEqual({
        success: false,
        error: 'Invalid status transition',
        code: 'INVALID_TRANSITION',
      })
      expect(client._updateMock).not.toHaveBeenCalled()
    },
  )

  it('DB error on UPDATE returns UPDATE_FAILED', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const client = makeOwnerClient({ currentStatus: 'ready', updateError: { code: 'XX000', message: 'boom' } })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await unbumpOrder('order-1')

    expect(result).toEqual({
      success: false,
      error: "Tap to retry — undo didn't send",
      code: 'UPDATE_FAILED',
    })
    consoleSpy.mockRestore()
  })

  it('UPDATE matches 0 rows returns CONCURRENT_UPDATE', async () => {
    const client = makeOwnerClient({ currentStatus: 'ready', updateCount: 0 })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await unbumpOrder('order-1')

    expect(result).toEqual({
      success: false,
      error: 'Order changed — please refresh',
      code: 'CONCURRENT_UPDATE',
    })
    expect(client._updateMock).toHaveBeenCalledOnce()
    expect(client._updateEqCalls).toEqual([
      { col: 'id', val: 'order-1' },
      { col: 'status', val: 'ready' },
    ])
  })
})
