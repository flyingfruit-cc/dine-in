import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MenuItemForm } from '@/components/admin/MenuItemForm'
import type { MenuItem, VariantGroup } from '@/types/app'

export default async function EditMenuItemPage({
  params,
}: {
  params: Promise<{ item_id: string }>
}) {
  const { item_id } = await params
  const supabase = await createClient()

  const [{ data: item }, { data: categories }] = await Promise.all([
    supabase.from('menu_items').select('*').eq('id', item_id).single(),
    supabase.from('categories').select('*').order('display_order', { ascending: true }),
  ])

  if (!item) notFound()

  const normalizedItem: MenuItem = { ...item, variants: (item.variants ?? []) as VariantGroup[] } as MenuItem

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">Edit item</h1>
        <MenuItemForm item={normalizedItem} categories={categories ?? []} />
      </div>
    </main>
  )
}
