// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { publishMenu, takeMenuOffline, recordMenuPreview } from '@/actions/restaurantActions'
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

function makeUpdateChain(error: { message: string } | null = null) {
  const chain: any = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (v: any) => any) =>
      Promise.resolve({ data: null, error }).then(resolve),
  }
  chain.update.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

function makeAuthClient(restaurantId: string | null = RESTAURANT_ID) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileData = restaurantId ? { restaurant_id: restaurantId } : null
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: profileData, error: null }),
        }
      }
      return makeUpdateChain()
    }),
  }
}

describe('publishMenu', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)
    const result = await publishMenu()
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authenticated')
  })

  it('returns error when no restaurant found', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(null) as any)
    const result = await publishMenu()
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No restaurant found')
  })

  it('calls update with is_published true and returns success', async () => {
    const updateChain = makeUpdateChain()
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeProfileChain()
        return updateChain
      }),
    } as any)

    const result = await publishMenu()
    expect(result.success).toBe(true)
    expect(updateChain.update).toHaveBeenCalledWith({ is_published: true })
    expect(updateChain.eq).toHaveBeenCalledWith('id', RESTAURANT_ID)
  })

  it('returns error when DB update fails', async () => {
    const updateChain = makeUpdateChain({ message: 'DB error' })
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeProfileChain()
        return updateChain
      }),
    } as any)

    const result = await publishMenu()
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('DB error')
  })
})

describe('takeMenuOffline', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)
    const result = await takeMenuOffline()
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authenticated')
  })

  it('returns error when no restaurant found', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(null) as any)
    const result = await takeMenuOffline()
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No restaurant found')
  })

  it('calls update with is_published false and returns success', async () => {
    const updateChain = makeUpdateChain()
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeProfileChain()
        return updateChain
      }),
    } as any)

    const result = await takeMenuOffline()
    expect(result.success).toBe(true)
    expect(updateChain.update).toHaveBeenCalledWith({ is_published: false })
    expect(updateChain.eq).toHaveBeenCalledWith('id', RESTAURANT_ID)
  })

  it('returns error when DB update fails', async () => {
    const updateChain = makeUpdateChain({ message: 'DB error' })
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeProfileChain()
        return updateChain
      }),
    } as any)

    const result = await takeMenuOffline()
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('DB error')
  })
})

describe('recordMenuPreview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)
    const result = await recordMenuPreview()
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authenticated')
  })

  it('returns error when no restaurant found', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(null) as any)
    const result = await recordMenuPreview()
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No restaurant found')
  })

  it('calls update with has_previewed_menu true and returns success', async () => {
    const updateChain = makeUpdateChain()
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeProfileChain()
        return updateChain
      }),
    } as any)

    const result = await recordMenuPreview()
    expect(result.success).toBe(true)
    expect(updateChain.update).toHaveBeenCalledWith({ has_previewed_menu: true })
    expect(updateChain.eq).toHaveBeenCalledWith('id', RESTAURANT_ID)
  })

  it('returns error when DB update fails', async () => {
    const updateChain = makeUpdateChain({ message: 'DB error' })
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return makeProfileChain()
        return updateChain
      }),
    } as any)

    const result = await recordMenuPreview()
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('DB error')
  })
})
