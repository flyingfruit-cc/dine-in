// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createMenuItem, updateMenuItem, deleteMenuItem, uploadMenuItemImage } from '@/actions/menuActions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const RESTAURANT_ID = 'rest-uuid-123'
const USER_ID = 'user-uuid-456'
const ITEM_ID = 'item-uuid-789'

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
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

function makeAuthClient(restaurantId = RESTAURANT_ID) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: restaurantId }, error: null }) })
      }
      return makeChain()
    }),
  }
}

describe('createMenuItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)
    const result = await createMenuItem({ name: 'Burger', price_cents: 1200 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authenticated')
  })

  it('creates item and returns it', async () => {
    const newItem = { id: ITEM_ID, restaurant_id: RESTAURANT_ID, name: 'Burger', description: null, price_cents: 1200, is_published: false, image_url: null, category_id: null, created_at: '2026-05-10' }
    const insertChain = makeChain({ single: vi.fn().mockResolvedValue({ data: newItem, error: null }) })

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        if (table === 'menu_items') return insertChain
        return makeChain()
      }),
    } as any)

    const result = await createMenuItem({ name: 'Burger', price_cents: 1200 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.item.name).toBe('Burger')
      expect(result.data.item.restaurant_id).toBe(RESTAURANT_ID)
    }
  })

  it('returns error when display_order MAX query fails', async () => {
    const maxErrChain = makeChain({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'query error' } }) })
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        return maxErrChain
      }),
    } as any)
    const result = await createMenuItem({ name: 'Burger', price_cents: 1200 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('query error')
  })

  it('returns error when insert fails', async () => {
    const errorChain = makeChain({ single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }) })
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        return errorChain
      }),
    } as any)
    const result = await createMenuItem({ name: 'Burger', price_cents: 1200 })
    expect(result.success).toBe(false)
  })
})

describe('updateMenuItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)
    const result = await updateMenuItem(ITEM_ID, { name: 'Updated' })
    expect(result.success).toBe(false)
  })

  it('updates item and returns it', async () => {
    const updated = { id: ITEM_ID, restaurant_id: RESTAURANT_ID, name: 'Updated', description: null, price_cents: 1500, is_published: false, image_url: null, category_id: null, created_at: '2026-05-10' }
    const updateChain = makeChain({ single: vi.fn().mockResolvedValue({ data: updated, error: null }) })

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        return updateChain
      }),
    } as any)

    const result = await updateMenuItem(ITEM_ID, { name: 'Updated', price_cents: 1500 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.item.name).toBe('Updated')
  })
})

describe('deleteMenuItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)
    const result = await deleteMenuItem(ITEM_ID)
    expect(result.success).toBe(false)
  })

  it('deletes item and returns success', async () => {
    const deleteChain = makeChain()
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        return deleteChain
      }),
    } as any)
    const result = await deleteMenuItem(ITEM_ID)
    expect(result.success).toBe(true)
  })
})

describe('uploadMenuItemImage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)
    const fd = new FormData()
    const result = await uploadMenuItemImage(ITEM_ID, fd)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authenticated')
  })

  it('returns error when no file provided', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        return makeChain()
      }),
    } as any)
    const fd = new FormData()
    const result = await uploadMenuItemImage(ITEM_ID, fd)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No file provided')
  })

  it('uploads image and returns public URL', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ error: null })
    const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/img' } })
    vi.mocked(createAdminClient).mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }) },
    } as any)

    const updateChain = makeChain({ single: vi.fn().mockResolvedValue({ data: null, error: null }) })
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        return updateChain
      }),
    } as any)

    const fd = new FormData()
    fd.append('file', new File(['data'], 'photo.jpg', { type: 'image/jpeg' }))

    const result = await uploadMenuItemImage(ITEM_ID, fd)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.imageUrl).toMatch(/^https:\/\/cdn\.example\.com\/img\?v=\d+$/)
    expect(mockUpload).toHaveBeenCalledWith(
      `${RESTAURANT_ID}/${ITEM_ID}/image`,
      expect.any(ArrayBuffer),
      { contentType: 'image/jpeg', upsert: true }
    )
  })

  it('returns error when storage upload fails', async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: { message: 'Storage error' } }),
          getPublicUrl: vi.fn(),
        }),
      },
    } as any)

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        return makeChain()
      }),
    } as any)

    const fd = new FormData()
    fd.append('file', new File(['data'], 'photo.jpg', { type: 'image/jpeg' }))
    const result = await uploadMenuItemImage(ITEM_ID, fd)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Storage error')
  })

  it('returns error when file is not an image (MIME type check)', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        return makeChain()
      }),
    } as any)

    const fd = new FormData()
    fd.append('file', new File(['data'], 'document.pdf', { type: 'application/pdf' }))
    const result = await uploadMenuItemImage(ITEM_ID, fd)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('File must be an image')
  })

  it('returns error when file exceeds 5 MB size limit', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        return makeChain()
      }),
    } as any)

    const largeBuffer = new Uint8Array(6 * 1024 * 1024) // 6 MB
    const fd = new FormData()
    fd.append('file', new File([largeBuffer], 'big.jpg', { type: 'image/jpeg' }))
    const result = await uploadMenuItemImage(ITEM_ID, fd)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('File must be under 5 MB')
  })

  it('returns error when DB update after upload fails', async () => {
    const mockUploadFn = vi.fn().mockResolvedValue({ error: null })
    const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/img' } })
    vi.mocked(createAdminClient).mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ upload: mockUploadFn, getPublicUrl: mockGetPublicUrl }) },
    } as any)

    // The DB update chain must be thenable so `await chain` resolves to the error response
    const dbUpdateError = { message: 'DB update failed' }
    const updateChain: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: (v: any) => any) => Promise.resolve({ data: null, error: dbUpdateError }).then(resolve),
    }

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeChain({ single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }) })
        return updateChain
      }),
    } as any)

    const fd = new FormData()
    fd.append('file', new File(['data'], 'photo.jpg', { type: 'image/jpeg' }))
    const result = await uploadMenuItemImage(ITEM_ID, fd)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('DB update failed')
  })
})
