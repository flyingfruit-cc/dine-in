import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MenuItemForm } from '@/components/admin/MenuItemForm'
import type { MenuItem, VariantGroup, AvailabilitySchedule } from '@/types/app'

export default async function EditMenuItemPage({
  params,
}: {
  params: Promise<{ item_id: string }>
}) {
  const { item_id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('restaurant_id')
    .single()

  const [{ data: item }, { data: categories }, { data: restaurant }] = await Promise.all([
    supabase.from('menu_items').select('*').eq('id', item_id).single(),
    supabase.from('categories').select('*').order('display_order', { ascending: true }),
    profile?.restaurant_id
      ? supabase.from('restaurants').select('supported_languages, default_language').eq('id', profile.restaurant_id).single()
      : Promise.resolve({ data: null }),
  ])

  if (!item) notFound()

  const normalizedItem: MenuItem = {
    ...item,
    variants: (item.variants ?? []) as VariantGroup[],
    availability_schedule: item.availability_schedule as AvailabilitySchedule | null,
    translations: (item.translations ?? {}) as Record<string, { name: string; description?: string }>,
  } as MenuItem

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">Edit item</h1>
        <MenuItemForm
          item={normalizedItem}
          categories={categories ?? []}
          supportedLanguages={restaurant?.supported_languages ?? ['en']}
          defaultLanguage={restaurant?.default_language ?? 'en'}
        />
      </div>
    </main>
  )
}
