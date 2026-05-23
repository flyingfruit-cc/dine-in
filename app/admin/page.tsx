import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingChecklist } from '@/components/admin/OnboardingChecklist'
import { DashboardLandingSnapshot } from '@/components/admin/DashboardLandingSnapshot'
import { getRestaurantAnalytics } from '@/lib/analytics/getRestaurantAnalytics'
import type { Order } from '@/types/app'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) console.error('[admin/page] getUser failed', authError)
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('restaurant_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.restaurant_id) redirect('/auth/onboarding')

  // Each of the snapshot queries degrades to a safe fallback if it throws —
  // a transient blip on one read must not blank the entire dashboard.
  const [
    { data: restaurant },
    { data: menuItemsCheck },
    { data: tables },
    analytics,
    activeOrdersData,
    recentOrdersData,
  ] = await Promise.all([
    supabase
      .from('restaurants')
      .select('is_published, has_previewed_menu, has_printed_qr')
      .eq('id', profile.restaurant_id)
      .single(),
    supabase.from('menu_items').select('id').limit(1),
    supabase.from('tables').select('id, number').eq('restaurant_id', profile.restaurant_id),
    getRestaurantAnalytics(supabase, profile.restaurant_id, 'today').catch((err) => {
      console.error('[admin/page] analytics fetch failed', err)
      return {
        period: 'today' as const,
        periodStart: '',
        periodEnd: '',
        orderCount: 0,
        totalRevenueCents: 0,
        averageOrderValueCents: 0,
        ordersByDay: [],
        ordersByDowHour: [],
        topItems: [],
        emptyState: true,
        error: true,
      }
    }),
    supabase
      .from('orders')
      .select('id')
      .eq('restaurant_id', profile.restaurant_id)
      .neq('status', 'completed')
      .then(
        (r) => r.data,
        (err) => {
          console.error('[admin/page] active-orders fetch failed', err)
          return null
        },
      ),
    supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', profile.restaurant_id)
      .order('submitted_at', { ascending: false })
      .limit(5)
      .then(
        (r) => r.data,
        (err) => {
          console.error('[admin/page] recent-orders fetch failed', err)
          return null
        },
      ),
  ])

  const hasMenuItems = !!menuItemsCheck?.length
  const hasPreviewedMenu = restaurant?.has_previewed_menu ?? false
  const isPublished = restaurant?.is_published ?? false
  const hasTables = !!tables?.length
  const hasPrintedQr = restaurant?.has_printed_qr ?? false
  const allComplete =
    hasMenuItems && hasPreviewedMenu && isPublished && hasTables && hasPrintedQr

  const wrapperClass = allComplete ? 'mx-auto max-w-4xl' : 'mx-auto max-w-2xl'

  const tablesById: Record<string, number> = {}
  for (const t of tables ?? []) tablesById[t.id] = t.number

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className={wrapperClass}>
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">
          Dashboard
        </h1>
        {allComplete ? (
          <DashboardLandingSnapshot
            activeOrderCount={activeOrdersData?.length ?? 0}
            todayOrderCount={analytics.orderCount}
            todayRevenueCents={analytics.totalRevenueCents}
            recentOrders={(recentOrdersData ?? []) as Order[]}
            tablesById={tablesById}
          />
        ) : (
          <OnboardingChecklist
            hasMenuItems={hasMenuItems}
            hasPreviewedMenu={hasPreviewedMenu}
            isPublished={isPublished}
            hasTables={hasTables}
            hasPrintedQr={hasPrintedQr}
          />
        )}
      </div>
    </main>
  )
}
