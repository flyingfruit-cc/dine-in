import { createClient } from '@/lib/supabase/server'
import { RestaurantSettings } from '@/components/admin/RestaurantSettings'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, slug, supported_languages, default_language')
    .single()

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">Settings</h1>
        <RestaurantSettings
          name={restaurant?.name ?? ''}
          slug={restaurant?.slug ?? ''}
          supportedLanguages={restaurant?.supported_languages ?? ['en']}
          defaultLanguage={restaurant?.default_language ?? 'en'}
        />
      </div>
    </main>
  )
}
