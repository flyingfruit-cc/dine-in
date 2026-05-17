import { createClient } from '@/lib/supabase/server'
import { MenuPreview } from '@/components/admin/MenuPreview'
import { recordMenuPreview } from '@/actions/restaurantActions'

export default async function MenuPreviewPage() {
  await recordMenuPreview()

  const supabase = await createClient()

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from('categories').select('*').order('display_order', { ascending: true }),
    supabase.from('menu_items').select('*').order('display_order', { ascending: true }),
  ])

  return (
    <main className="min-h-screen">
      <MenuPreview categories={categories ?? []} items={items ?? []} />
    </main>
  )
}
