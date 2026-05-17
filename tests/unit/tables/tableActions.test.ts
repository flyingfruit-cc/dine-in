// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createTable } from '@/actions/tableActions'
import { createClient } from '@/lib/supabase/server'

const RESTAURANT_ID = 'rest-uuid-123'
const USER_ID = 'user-uuid-456'
const TABLE_ID = 'table-uuid-789'

function makeProfileChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { restaurant_id: RESTAURANT_ID }, error: null }),
  }
}

function makeInsertChain(
  result: { data: { id: string } | null; error: { code?: string; message: string } | null }
) {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
}

function makeAuthClient(restaurantId: string | null = RESTAURANT_ID, insertResult = { data: { id: TABLE_ID }, error: null }) {
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
      return makeInsertChain(insertResult)
    }),
  }
}

describe('createTable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)
    const result = await createTable(5)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authenticated')
  })

  it('returns error when no restaurant found', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient(null) as any)
    const result = await createTable(5)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No restaurant found')
  })

  it('returns error when number is 0 (invalid)', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient() as any)
    const result = await createTable(0)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Table number must be an integer between 1 and 999')
  })

  it('returns error when number is 1000 (out of range)', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient() as any)
    const result = await createTable(1000)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Table number must be an integer between 1 and 999')
  })

  it('returns error when number is not an integer', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient() as any)
    const result = await createTable(1.5)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Table number must be an integer between 1 and 999')
  })

  it('returns success with new table id on valid insert', async () => {
    vi.mocked(createClient).mockResolvedValue(makeAuthClient() as any)
    const result = await createTable(5)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual({ id: TABLE_ID })
  })

  it('returns friendly error when table number already exists (unique violation)', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient(RESTAURANT_ID, { data: null, error: { code: '23505', message: 'unique violation' } }) as any
    )
    const result = await createTable(5)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Table 5 already exists')
  })

  it('returns DB error message on generic failure', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeAuthClient(RESTAURANT_ID, { data: null, error: { message: 'connection refused' } }) as any
    )
    const result = await createTable(5)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('connection refused')
  })
})
