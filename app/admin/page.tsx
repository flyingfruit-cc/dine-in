import { createClient } from '@/lib/supabase/server'
import { OnboardingChecklist } from '@/components/admin/OnboardingChecklist'

export default async function AdminPage() {
  const supabase = await createClient()

  const [{ data: restaurant }, { data: menuItemsCheck }] = await Promise.all([
    supabase.from('restaurants').select('is_published, has_previewed_menu').single(),
    supabase.from('menu_items').select('id').limit(1),
  ])

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">
          Dashboard
        </h1>
        <OnboardingChecklist
          hasMenuItems={!!menuItemsCheck?.length}
          hasPreviewedMenu={restaurant?.has_previewed_menu ?? false}
          isPublished={restaurant?.is_published ?? false}
          hasTables={false}
          hasPrintedQr={false}
        />
      </div>
    </main>
  )
}
