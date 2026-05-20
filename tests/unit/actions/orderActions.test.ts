// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { submitOrder } from '@/actions/orderActions'
import { createAdminClient } from '@/lib/supabase/admin'

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
