import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getRestaurantAnalytics } from '@/lib/analytics/getRestaurantAnalytics'
import { AnalyticsPeriodSelector } from '@/components/admin/AnalyticsPeriodSelector'
import { AnalyticsOrderVolumeChart } from '@/components/admin/AnalyticsOrderVolumeChart'
import { AnalyticsPeakHoursHeatmap } from '@/components/admin/AnalyticsPeakHoursHeatmap'
import { AnalyticsEmptyState } from '@/components/admin/AnalyticsEmptyState'
import { AnalyticsErrorPanel } from '@/components/admin/AnalyticsErrorPanel'
import { AnalyticsRevenueSummary } from '@/components/admin/AnalyticsRevenueSummary'
import { AnalyticsPopularItems } from '@/components/admin/AnalyticsPopularItems'
import type { AnalyticsPeriod } from '@/types/app'

const VALID_PERIODS = ['today', '7d', '30d', '90d'] as const

// Next.js can deliver the same query key as `string | string[] | undefined`
// (e.g. `?period=7d&period=30d`); narrow to a string before validating.
export function parsePeriodParam(raw: string | string[] | undefined): AnalyticsPeriod {
  const first = Array.isArray(raw) ? raw[0] : raw
  if (first && (VALID_PERIODS as readonly string[]).includes(first)) {
    return first as AnalyticsPeriod
  }
  return '7d'
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.restaurant_id) redirect('/auth/onboarding')

  const { period: rawPeriod } = await searchParams
  const period = parsePeriodParam(rawPeriod)

  const data = await getRestaurantAnalytics(supabase, profile.restaurant_id, period)

  return (
    <main className="min-h-screen bg-surface-base">
      <header className="border-b border-border px-4 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Analytics</h1>
      </header>
      <div className="px-4 py-4">
        <AnalyticsPeriodSelector currentPeriod={period} />
        <div className="mt-6">
          {data.error ? (
            <AnalyticsErrorPanel />
          ) : data.emptyState ? (
            <AnalyticsEmptyState orderCount={data.orderCount} />
          ) : (
            <>
              <AnalyticsRevenueSummary
                totalRevenueCents={data.totalRevenueCents}
                averageOrderValueCents={data.averageOrderValueCents}
                orderCount={data.orderCount}
              />
              <div className="mt-6">
                <AnalyticsOrderVolumeChart data={data.ordersByDay} />
              </div>
              <div className="mt-8">
                <AnalyticsPeakHoursHeatmap data={data.ordersByDowHour} />
              </div>
              <div className="mt-8">
                <AnalyticsPopularItems items={data.topItems} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
