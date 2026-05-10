import { createClient } from '@/lib/supabase/server'
import { MenuItemForm } from '@/components/admin/MenuItemForm'

export default async function NewMenuItemPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true })

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">New item</h1>
        <MenuItemForm categories={categories ?? []} />
      </div>
    </main>
  )
}
