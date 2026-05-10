// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createCategory, renameCategory, deleteCategory } from '@/actions/menuActions'
import { createClient } from '@/lib/supabase/server'

const RESTAURANT_ID = 'rest-uuid-123'
const USER_ID = 'user-uuid-456'
const CATEGORY_ID = 'cat-uuid-789'

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    ...overrides,
  }
  Object.keys(chain).forEach((key) => {
    if (key !== 'single' && key !== 'maybeSingle' && typeof chain[key] === 'function') {
      ;(chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    }
  })
  return chain
}

describe('createCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)

    const result = await createCategory('Starters')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authenticated')
  })

  it('returns error when no restaurant found', async () => {
    const profileChain = makeChain({
      single: vi.fn().mockResolvedValue({ data: { restaurant_id: null }, error: null }),
    })
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockReturnValue(profileChain),
    } as any)

    const result = await createCategory('Starters')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No restaurant found')
  })

  it('creates category and returns it', async () => {
    const newCategory = { id: CATEGORY_ID, restaurant_id: RESTAURANT_ID, name: 'Starters', display_order: 0 }

    // MAX query returns null (no existing categories) → display_order = 0
    const maxChain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    const insertChain = makeChain({
      single: vi.fn().mockResolvedValue({ data: newCategory, error: null }),
    })

    let categoriesCallCount = 0
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        if (table === 'categories') {
          categoriesCallCount++
          return categoriesCallCount === 1 ? maxChain : insertChain
        }
        return makeChain()
      }),
    } as any)

    const result = await createCategory('Starters')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category.name).toBe('Starters')
      expect(result.data.category.restaurant_id).toBe(RESTAURANT_ID)
    }
  })

  it('returns error when insert fails', async () => {
    // MAX query returns existing max display_order of 1 → next = 2
    const maxChain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { display_order: 1 }, error: null }),
    })
    const insertChain = makeChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    })

    let categoriesCallCount = 0
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        if (table === 'categories') {
          categoriesCallCount++
          return categoriesCallCount === 1 ? maxChain : insertChain
        }
        return makeChain()
      }),
    } as any)

    const result = await createCategory('Starters')
    expect(result.success).toBe(false)
  })
})

describe('renameCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)

    const result = await renameCategory(CATEGORY_ID, 'Mains')
    expect(result.success).toBe(false)
  })

  it('updates category name and returns updated category', async () => {
    const updated = { id: CATEGORY_ID, restaurant_id: RESTAURANT_ID, name: 'Mains', display_order: 0 }
    const updateChain = makeChain({
      single: vi.fn().mockResolvedValue({ data: updated, error: null }),
    })

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        if (table === 'categories') return updateChain
        return makeChain()
      }),
    } as any)

    const result = await renameCategory(CATEGORY_ID, 'Mains')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.category.name).toBe('Mains')
  })
})

describe('deleteCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)

    const result = await deleteCategory(CATEGORY_ID)
    expect(result.success).toBe(false)
  })

  it('deletes menu_items first then category', async () => {
    const itemsDeleteChain = makeChain()
    const catDeleteChain = makeChain({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })

    let menuItemsCallCount = 0
    let categoriesCallCount = 0

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        if (table === 'menu_items') {
          menuItemsCallCount++
          return itemsDeleteChain
        }
        if (table === 'categories') {
          categoriesCallCount++
          return catDeleteChain
        }
        return makeChain()
      }),
    } as any)

    const result = await deleteCategory(CATEGORY_ID)
    expect(result.success).toBe(true)
    expect(menuItemsCallCount).toBe(1)
    expect(categoriesCallCount).toBe(1)
  })
})
