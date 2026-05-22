import { createAdminClient } from '@/lib/supabase/admin'
import { CustomerMenuClient } from '@/components/customer/CustomerMenuClient'
import { isItemAvailable } from '@/utils/isAvailable'
import { resolveLanguage } from '@/utils/resolveLanguage'
import { loadI18nBundle } from '@/utils/loadI18nBundle'
import type { MenuItem, VariantGroup, AvailabilitySchedule, EnrichedMenuItem } from '@/types/app'

function MenuUnavailable({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-base text-text-primary">{message}</p>
    </div>
  )
}

interface Props {
  params: Promise<{ restaurant_slug: string; table_number: string }>
  searchParams: Promise<{ lang?: string }>
}

export default async function CustomerMenuPage({ params, searchParams }: Props) {
  const [{ restaurant_slug, table_number }, { lang: urlLang }] = await Promise.all([
    params,
    searchParams,
  ])
  const tableNum = parseInt(table_number, 10)

  const adminClient = createAdminClient()

  const fallbackBundle = loadI18nBundle('en')
  if (isNaN(tableNum)) {
    return <MenuUnavailable message={fallbackBundle['menu.unavailable']} />
  }

  const { data: restaurant } = await adminClient
    .from('restaurants')
    .select('id, name, slug, is_published, supported_languages, default_language')
    .eq('slug', restaurant_slug)
    .single()

  if (!restaurant || !restaurant.is_published) {
    return <MenuUnavailable message={fallbackBundle['menu.unavailable']} />
  }

  const supportedLanguages = (restaurant.supported_languages as string[] | null) ?? ['en']
  const defaultLanguage = (restaurant.default_language as string | null) ?? 'en'
  const lang = resolveLanguage({
    urlLang,
    supportedLanguages,
    defaultLanguage,
  })
  const chrome = loadI18nBundle(lang)

  const { data: table } = await adminClient
    .from('tables')
    .select('id, number')
    .eq('restaurant_id', restaurant.id)
    .eq('number', tableNum)
    .single()

  if (!table) {
    return <MenuUnavailable message={chrome['menu.unavailable']} />
  }

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
    translations: ((item as unknown as Record<string, unknown>).translations as Record<string, { name: string; description?: string }>) ?? {},
  } as MenuItem))

  const now = new Date()

  const enrichedItems: EnrichedMenuItem[] = items.map((item) => ({
    ...item,
    isAvailable: isItemAvailable(item.availability_schedule, now),
  }))

  const hasUncategorized = enrichedItems.some((i) => i.category_id === null)

  return (
    <CustomerMenuClient
      categories={safeCategories.map((c) => ({ ...c, restaurant_id: restaurant.id }))}
      items={enrichedItems}
      hasUncategorized={hasUncategorized}
      restaurantName={restaurant.name}
      lang={lang}
      chrome={chrome}
      supportedLanguages={supportedLanguages}
      defaultLanguage={defaultLanguage}
    />
  )
}
