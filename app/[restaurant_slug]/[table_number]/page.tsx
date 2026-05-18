import { createAdminClient } from '@/lib/supabase/admin'
import { SessionInitializer } from '@/components/customer/SessionInitializer'
import { CustomerMenuClient } from '@/components/customer/CustomerMenuClient'
import { isItemAvailable } from '@/utils/isAvailable'
import type { MenuItem, VariantGroup, AvailabilitySchedule, EnrichedMenuItem } from '@/types/app'

function MenuUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-base text-text-primary">
        This menu isn&apos;t available right now. Please ask your server.
      </p>
    </div>
  )
}

interface Props {
  params: Promise<{ restaurant_slug: string; table_number: string }>
}

export default async function CustomerMenuPage({ params }: Props) {
  const { restaurant_slug, table_number } = await params
  const tableNum = parseInt(table_number, 10)
  if (isNaN(tableNum)) return <MenuUnavailable />

  const adminClient = createAdminClient()

  // Resolve restaurant
  const { data: restaurant } = await adminClient
    .from('restaurants')
    .select('id, name, slug, is_published')
    .eq('slug', restaurant_slug)
    .single()

  if (!restaurant || !restaurant.is_published) {
    return <MenuUnavailable />
  }

  // Resolve table
  const { data: table } = await adminClient
    .from('tables')
    .select('id, number')
    .eq('restaurant_id', restaurant.id)
    .eq('number', tableNum)
    .single()

  if (!table) {
    return <MenuUnavailable />
  }

  // Fetch menu data with admin client (service role bypasses RLS for reliable SSR)
  const [{ data: categories }, { data: rawItems }] = await Promise.all([
    adminClient
      .from('categories')
      .select('id, name, display_order')
      .eq('restaurant_id', restaurant.id)
      .order('display_order'),
    adminClient
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('display_order'),
  ])

  const safeCategories = categories ?? []
  const items: MenuItem[] = (rawItems ?? []).map((item) => ({
    ...(item as unknown as Record<string, unknown>),
    variants: ((item as unknown as Record<string, unknown>).variants as VariantGroup[]) ?? [],
    availability_schedule: ((item as unknown as Record<string, unknown>).availability_schedule as AvailabilitySchedule | null) ?? null,
  } as MenuItem))

  const now = new Date()

  const enrichedItems: EnrichedMenuItem[] = items.map((item) => ({
    ...item,
    isAvailable: isItemAvailable(item.availability_schedule, now),
  }))

  const hasUncategorized = enrichedItems.some((i) => i.category_id === null)

  return (
    <div>
      <SessionInitializer restaurantId={restaurant.id} tableNumber={tableNum} />
      <CustomerMenuClient
        categories={safeCategories.map((c) => ({ ...c, restaurant_id: restaurant.id }))}
        items={enrichedItems}
        hasUncategorized={hasUncategorized}
        restaurantName={restaurant.name}
      />
    </div>
  )
}
