import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type {
  AnalyticsData,
  AnalyticsPeriod,
  OrdersByDay,
  OrdersByDowHour,
  TopItem,
} from '@/types/app'

// MVP: period boundaries are computed in UTC.
// Restaurant-local timezone support is deferred — charts are directionally correct
// over 7d/30d/90d windows even with slight boundary drift.
function periodToRange(period: AnalyticsPeriod): { periodStart: string; periodEnd: string } {
  const now = new Date()
  const periodEnd = now.toISOString()

  if (period === 'today') {
    const periodStart = now.toISOString().slice(0, 10) + 'T00:00:00.000Z'
    return { periodStart, periodEnd }
  }

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return { periodStart: start.toISOString(), periodEnd }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function emptyResult(
  period: AnalyticsPeriod,
  periodStart: string,
  periodEnd: string,
  opts?: { error?: boolean },
): AnalyticsData {
  return {
    period,
    periodStart,
    periodEnd,
    orderCount: 0,
    totalRevenueCents: 0,
    averageOrderValueCents: 0,
    ordersByDay: [],
    ordersByDowHour: [],
    topItems: [],
    emptyState: true,
    ...(opts?.error ? { error: true } : {}),
  }
}

// Raw shape returned by the Postgres function (snake_case jsonb keys).
interface RawAnalytics {
  order_count: number
  total_revenue_cents: number
  orders_by_day: Array<{ day: string; count: number; revenue_cents: number }>
  orders_by_dow_hour: Array<{ dow: number; hour: number; count: number }>
  top_items: Array<{ name: string; quantity: number; revenue_cents: number; variants: Record<string, number> }>
}

/**
 * Fetches restaurant analytics via the `get_restaurant_analytics` Postgres function.
 *
 * Accepts any SupabaseClient — the caller decides which client to use:
 *   - Owner analytics page: server cookie client (RLS-protected, owner sees own restaurant only)
 *   - Platform admin page: admin client (service role, bypasses RLS for cross-tenant access)
 *
 * Never throws. On Supabase error or null result, returns an all-zero AnalyticsData
 * with emptyState: true so the page degrades gracefully. When the failure is an
 * RPC/transport error (not "zero rows"), `error: true` is set so callers can render
 * an "analytics temporarily unavailable" state instead of "no orders yet".
 *
 * MVP note: "completed orders" = "submitted orders" (any row in orders).
 * When Epic 9 adds an order status enum, the emptyState threshold may need to filter
 * by a completed/ready status instead.
 */
export async function getRestaurantAnalytics(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
  period: AnalyticsPeriod
): Promise<AnalyticsData> {
  const { periodStart, periodEnd } = periodToRange(period)

  if (!UUID_REGEX.test(restaurantId)) {
    console.error('[getRestaurantAnalytics] invalid restaurantId', restaurantId)
    return emptyResult(period, periodStart, periodEnd, { error: true })
  }

  const { data, error } = await supabase.rpc('get_restaurant_analytics', {
    p_restaurant_id: restaurantId,
    p_start: periodStart,
    p_end: periodEnd,
  })

  if (error) {
    console.error('[getRestaurantAnalytics]', error)
    return emptyResult(period, periodStart, periodEnd, { error: true })
  }

  if (data === null || data === undefined) {
    return emptyResult(period, periodStart, periodEnd)
  }

  const raw = data as unknown as RawAnalytics

  const orderCount = raw.order_count ?? 0
  const totalRevenueCents = raw.total_revenue_cents ?? 0
  const averageOrderValueCents =
    orderCount === 0 ? 0 : Math.round(totalRevenueCents / orderCount)
  const emptyState = orderCount < 30

  // AC #2: when emptyState=true the aggregate arrays must not show sparse/misleading buckets
  const ordersByDay: OrdersByDay[] = emptyState
    ? []
    : (raw.orders_by_day ?? []).map((r) => ({
        day: r.day,
        count: r.count,
        revenueCents: r.revenue_cents,
      }))

  const ordersByDowHour: OrdersByDowHour[] = emptyState
    ? []
    : (raw.orders_by_dow_hour ?? []).map((r) => ({
        dow: r.dow,
        hour: r.hour,
        count: r.count,
      }))

  const topItems: TopItem[] = emptyState
    ? []
    : (raw.top_items ?? []).map((r) => ({
        name: r.name,
        quantity: r.quantity,
        revenueCents: r.revenue_cents,
        variants: r.variants ?? {},
      }))

  return {
    period,
    periodStart,
    periodEnd,
    orderCount,
    totalRevenueCents,
    averageOrderValueCents,
    ordersByDay,
    ordersByDowHour,
    topItems,
    emptyState,
  }
}
