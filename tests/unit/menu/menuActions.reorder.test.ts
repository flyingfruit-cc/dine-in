// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { reorderMenuItems } from '@/actions/menuActions'
import { createClient } from '@/lib/supabase/server'

const RESTAURANT_ID = 'rest-uuid-123'
const USER_ID = 'user-uuid-456'

function makeProfileChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }),
  }
}

// Returns a factory: each call to fromFactory() produces a fresh chain for one update call.
// reorderMenuItems calls: supabase.from('menu_items').update({}).eq('id', id).eq('restaurant_id', restaurantId)
// The final .eq() must resolve (be awaitable by Promise.all).
function makeUpdateChainFactory(error: null | { message: string } = null) {
  return () => {
    const resolvedValue = { data: null, error }
    let eqCallCount = 0
    const chain: Record<string, unknown> = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(() => {
        eqCallCount++
        return eqCallCount < 2 ? chain : Promise.resolve(resolvedValue)
      }),
    }
    return chain
  }
}

function makeClientWithUpdateFactory(factory: () => Record<string, unknown>) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') return makeProfileChain()
      return factory()
    }),
  } as any
}

describe('reorderMenuItems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)

    const result = await reorderMenuItems([{ id: 'item-1', display_order: 0 }])
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authenticated')
  })

  it('returns error when no restaurant found', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    } as any)

    const result = await reorderMenuItems([{ id: 'item-1', display_order: 0 }])
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No restaurant found')
  })

  it('returns success when all updates succeed', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClientWithUpdateFactory(makeUpdateChainFactory(null))
    )

    const result = await reorderMenuItems([
      { id: 'item-1', display_order: 0 },
      { id: 'item-2', display_order: 1 },
    ])
    expect(result.success).toBe(true)
  })

  it('calls from("menu_items") once per update item', async () => {
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') return makeProfileChain()
      return makeUpdateChainFactory(null)()
    })

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: fromMock,
    } as any)

    await reorderMenuItems([
      { id: 'item-1', display_order: 0 },
      { id: 'item-2', display_order: 1 },
    ])

    const menuItemCalls = fromMock.mock.calls.filter((c: string[]) => c[0] === 'menu_items')
    expect(menuItemCalls.length).toBe(2)
  })

  it('returns error when any update fails', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClientWithUpdateFactory(makeUpdateChainFactory({ message: 'DB update failed' }))
    )

    const result = await reorderMenuItems([{ id: 'item-1', display_order: 0 }])
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('DB update failed')
  })
})
