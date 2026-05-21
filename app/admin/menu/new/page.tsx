import { createClient } from '@/lib/supabase/server'
import { MenuItemForm } from '@/components/admin/MenuItemForm'

export default async function NewMenuItemPage() {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('restaurant_id')
    .single()

  const [{ data: categories }, { data: restaurant }] = await Promise.all([
    supabase.from('categories').select('*').order('display_order', { ascending: true }),
    profile?.restaurant_id
      ? supabase.from('restaurants').select('supported_languages, default_language').eq('id', profile.restaurant_id).single()
      : Promise.resolve({ data: null }),
  ])

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">New item</h1>
        <MenuItemForm
          categories={categories ?? []}
          supportedLanguages={restaurant?.supported_languages ?? ['en']}
          defaultLanguage={restaurant?.default_language ?? 'en'}
        />
      </div>
    </main>
  )
}
