// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getRestaurantAnalytics } from '@/lib/analytics/getRestaurantAnalytics'

const RESTAURANT_ID = '00000000-0000-4000-8000-000000000123'
const FIXED_NOW = new Date('2026-06-01T12:34:56Z')

function makeRawAnalytics(overrides: Partial<{
  order_count: number
  total_revenue_cents: number
  orders_by_day: unknown[]
  orders_by_dow_hour: unknown[]
  top_items: unknown[]
}> = {}) {
  return {
    order_count: 0,
    total_revenue_cents: 0,
    orders_by_day: [],
    orders_by_dow_hour: [],
    top_items: [],
    ...overrides,
  }
}

function makeSupabaseMock(rpcResult: { data: unknown; error: unknown }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) }
}

describe('getRestaurantAnalytics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls rpc with correct args for period=7d', async () => {
    const supabase = makeSupabaseMock({ data: makeRawAnalytics(), error: null })
    await getRestaurantAnalytics(supabase as never, RESTAURANT_ID, '7d')

    expect(supabase.rpc).toHaveBeenCalledWith('get_restaurant_analytics', {
      p_restaurant_id: RESTAURANT_ID,
      p_start: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      p_end: FIXED_NOW.toISOString(),
    })

    const args = supabase.rpc.mock.calls[0][1] as { p_start: string; p_end: string }
    const start = new Date(args.p_start)
    const end = new Date(args.p_end)
    const diffMs = end.getTime() - start.getTime()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    // Allow ±2 seconds of tolerance
    expect(Math.abs(diffMs - sevenDaysMs)).toBeLessThan(2000)
  })

  it('sets p_start to UTC midnight for period=today', async () => {
    const supabase = makeSupabaseMock({ data: makeRawAnalytics(), error: null })
    await getRestaurantAnalytics(supabase as never, RESTAURANT_ID, 'today')

    const args = supabase.rpc.mock.calls[0][1] as { p_start: string }
    // Fixed now is 2026-06-01, so midnight should be 2026-06-01T00:00:00.000Z
    expect(args.p_start).toBe('2026-06-01T00:00:00.000Z')
  })

  it('returns emptyState=true when orderCount < 30 and suppresses aggregate arrays', async () => {
    const supabase = makeSupabaseMock({
      data: makeRawAnalytics({
        order_count: 5,
        total_revenue_cents: 0,
        // Even with populated buckets from SQL, the helper suppresses them when emptyState=true
        orders_by_day: [{ day: '2026-05-01', count: 5, revenue_cents: 0 }],
        orders_by_dow_hour: [{ dow: 1, hour: 12, count: 5 }],
        top_items: [{ name: 'Pizza', quantity: 5, revenue_cents: 0, variants: { standard: 5 } }],
      }),
      error: null,
    })
    const result = await getRestaurantAnalytics(supabase as never, RESTAURANT_ID, '30d')

    expect(result.emptyState).toBe(true)
    expect(result.orderCount).toBe(5)
    // AC #2: aggregate arrays must be empty when emptyState=true (no sparse/misleading buckets)
    expect(result.ordersByDay).toEqual([])
    expect(result.ordersByDowHour).toEqual([])
    expect(result.topItems).toEqual([])
    expect(result.error).toBeUndefined()
  })

  it('returns emptyState=false and correct averageOrderValueCents when orderCount >= 30', async () => {
    const supabase = makeSupabaseMock({
      data: makeRawAnalytics({ order_count: 100, total_revenue_cents: 250000 }),
      error: null,
    })
    const result = await getRestaurantAnalytics(supabase as never, RESTAURANT_ID, '90d')

    expect(result.emptyState).toBe(false)
    expect(result.orderCount).toBe(100)
    expect(result.totalRevenueCents).toBe(250000)
    expect(result.averageOrderValueCents).toBe(2500)
  })

  it('returns all-zero emptyState result with error=true when rpc returns an error (does not throw)', async () => {
    const supabase = makeSupabaseMock({ data: null, error: { message: 'simulated error' } })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Call directly — if it throws, the test fails on its own
    const result = await getRestaurantAnalytics(supabase as never, RESTAURANT_ID, '7d')

    expect(result.emptyState).toBe(true)
    expect(result.error).toBe(true)
    expect(result.orderCount).toBe(0)
    expect(result.totalRevenueCents).toBe(0)
    expect(result.ordersByDay).toEqual([])
    expect(result.topItems).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith('[getRestaurantAnalytics]', { message: 'simulated error' })

    consoleSpy.mockRestore()
  })

  it('returns all-zero emptyState result (no error flag) when rpc returns data=null without error', async () => {
    const supabase = makeSupabaseMock({ data: null, error: null })
    const result = await getRestaurantAnalytics(supabase as never, RESTAURANT_ID, '7d')

    expect(result.emptyState).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.orderCount).toBe(0)
  })

  it('returns error=true without calling rpc when restaurantId is not a valid UUID', async () => {
    const supabase = makeSupabaseMock({ data: makeRawAnalytics(), error: null })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await getRestaurantAnalytics(supabase as never, 'not-a-uuid', '7d')

    expect(result.error).toBe(true)
    expect(result.emptyState).toBe(true)
    expect(supabase.rpc).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('normalises jsonb data into typed AnalyticsData', async () => {
    const raw = makeRawAnalytics({
      order_count: 50,
      total_revenue_cents: 100000,
      orders_by_day: [{ day: '2026-05-01', count: 10, revenue_cents: 20000 }],
      orders_by_dow_hour: [{ dow: 1, hour: 12, count: 5 }],
      top_items: [{ name: 'Pizza', quantity: 30, revenue_cents: 60000, variants: { standard: 30 } }],
    })
    const supabase = makeSupabaseMock({ data: raw, error: null })
    const result = await getRestaurantAnalytics(supabase as never, RESTAURANT_ID, '30d')

    expect(result.period).toBe('30d')
    expect(result.orderCount).toBe(50)
    expect(result.averageOrderValueCents).toBe(2000) // Math.round(100000 / 50)
    expect(result.ordersByDay).toEqual([{ day: '2026-05-01', count: 10, revenueCents: 20000 }])
    expect(result.ordersByDowHour).toEqual([{ dow: 1, hour: 12, count: 5 }])
    expect(result.topItems).toEqual([{ name: 'Pizza', quantity: 30, revenueCents: 60000, variants: { standard: 30 } }])
    expect(result.emptyState).toBe(false) // 50 >= 30
  })

  it('averageOrderValueCents is 0 (not NaN) when orderCount=0', async () => {
    const supabase = makeSupabaseMock({
      data: makeRawAnalytics({ order_count: 0, total_revenue_cents: 0 }),
      error: null,
    })
    const result = await getRestaurantAnalytics(supabase as never, RESTAURANT_ID, 'today')

    expect(result.averageOrderValueCents).toBe(0)
    expect(Number.isNaN(result.averageOrderValueCents)).toBe(false)
  })
})
