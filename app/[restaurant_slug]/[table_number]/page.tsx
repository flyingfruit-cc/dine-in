import { createAdminClient } from '@/lib/supabase/admin'
import { CategoryTabs } from '@/components/customer/CategoryTabs'
import { MenuItemRow } from '@/components/customer/MenuItemRow'
import { SessionInitializer } from '@/components/customer/SessionInitializer'
import { isItemAvailable } from '@/utils/isAvailable'
import { UNCATEGORIZED_KEY } from '@/utils/customerMenu'
import type { MenuItem, VariantGroup, AvailabilitySchedule } from '@/types/app'

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

  const itemsByCategory = safeCategories.reduce<Record<string, typeof items>>((acc, cat) => {
    acc[cat.id] = items.filter((i) => i.category_id === cat.id)
    return acc
  }, {})
  const uncategorized = items.filter((i) => i.category_id === null)
  const hasUncategorized = uncategorized.length > 0
  const showTabBar = safeCategories.length > 0 || hasUncategorized

  return (
    <div>
      <SessionInitializer restaurantId={restaurant.id} tableNumber={tableNum} />

      {showTabBar && (
        <CategoryTabs
          categories={safeCategories.map((c) => ({ ...c, restaurant_id: restaurant.id }))}
          hasUncategorized={hasUncategorized}
        />
      )}

      <header className="px-4 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-text-primary">{restaurant.name}</h1>
      </header>

      <div>
        {safeCategories.map((cat) => {
          const catItems = itemsByCategory[cat.id] ?? []
          return (
            <section
              key={cat.id}
              id={cat.id}
              className="scroll-mt-14 px-4 py-4"
            >
              <h2 className="mb-3 text-base font-semibold text-text-primary">{cat.name}</h2>
              <div className="flex flex-col">
                {catItems.map((item) => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    isAvailable={isItemAvailable(item.availability_schedule, now)}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {hasUncategorized && (
          <section
            id={UNCATEGORIZED_KEY}
            className="scroll-mt-14 px-4 py-4"
          >
            <h2 className="mb-3 text-base font-semibold text-text-primary">Uncategorized</h2>
            <div className="flex flex-col">
              {uncategorized.map((item) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  isAvailable={isItemAvailable(item.availability_schedule, now)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
