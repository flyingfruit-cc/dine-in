// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { updateMenuItemTranslation } from '@/actions/menuActions'
import { createClient } from '@/lib/supabase/server'

const RESTAURANT_ID = 'rest-uuid-123'
const USER_ID = 'user-uuid-456'
const ITEM_ID = 'item-uuid-789'

function makeSingleChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
}

function makeAuthClient({
  restaurant = { supported_languages: ['en', 'es'] } as unknown,
  restaurantError = null as unknown,
  rpcResult = {
    data: [{ id: ITEM_ID, restaurant_id: RESTAURANT_ID, name: 'Burger', description: null, price_cents: 1200, image_url: null, category_id: null, display_order: 0, variants: [], availability_schedule: null, created_at: '2026-05-21', translations: { es: { name: 'Hamburguesa' } } }],
    error: null,
  } as { data: unknown; error: unknown },
} = {}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeSingleChain({ restaurant_id: RESTAURANT_ID })
      }
      if (table === 'restaurants') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: restaurant, error: restaurantError }) }
      }
      return makeSingleChain(null)
    }),
    rpc: vi.fn().mockResolvedValue(rpcResult),
  }
}

describe('updateMenuItemTranslation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns NOT_AUTHENTICATED when no user', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)
    const result = await updateMenuItemTranslation(ITEM_ID, 'es', { name: 'Hamburguesa' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.code).toBe('NOT_AUTHENTICATED')
  })

  it('returns NOT_FOUND when no restaurantId', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation(() =>
        makeSingleChain(null)
      ),
    } as any)
    const result = await updateMenuItemTranslation(ITEM_ID, 'es', { name: 'Hamburguesa' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.code).toBe('NOT_FOUND')
  })

  it('returns INVALID_NAME when name is empty after trim', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient() as any)
    const result = await updateMenuItemTranslation(ITEM_ID, 'es', { name: '   ' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.code).toBe('INVALID_NAME')
  })

  it('returns INVALID_LANGUAGE when langCode not in supported_languages', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient() as any)
    const result = await updateMenuItemTranslation(ITEM_ID, 'fr', { name: 'Hamburger' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('INVALID_LANGUAGE')
      expect(result.error).toBe('Language not enabled for this restaurant')
    }
  })

  it('returns NOT_FOUND when RPC returns no rows', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient({ rpcResult: { data: [], error: null } }) as any
    )
    const result = await updateMenuItemTranslation(ITEM_ID, 'es', { name: 'Hamburguesa' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.code).toBe('NOT_FOUND')
  })

  it('returns UPDATE_FAILED when RPC errors', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient({ rpcResult: { data: null, error: { message: 'db error' } } }) as any
    )
    const result = await updateMenuItemTranslation(ITEM_ID, 'es', { name: 'Hamburguesa' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.code).toBe('UPDATE_FAILED')
  })

  it('success: returns updated item with translation', async () => {
    const clientMock = makeAuthClient()
    vi.mocked(createClient).mockResolvedValue(clientMock as any)
    const result = await updateMenuItemTranslation(ITEM_ID, 'es', { name: 'Hamburguesa', description: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.item.id).toBe(ITEM_ID)
      expect(clientMock.rpc).toHaveBeenCalledWith('update_menu_item_translation', expect.objectContaining({
        item_id: ITEM_ID,
        lang_code: 'es',
        payload: expect.objectContaining({ name: 'Hamburguesa' }),
      }))
    }
  })

  it('strips empty description from the payload', async () => {
    const clientMock = makeAuthClient()
    vi.mocked(createClient).mockResolvedValue(clientMock as any)
    await updateMenuItemTranslation(ITEM_ID, 'es', { name: 'Hamburguesa', description: '  ' })
    const rpcCall = (clientMock.rpc as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(rpcCall.payload).not.toHaveProperty('description')
  })
})
