import { createClient } from '@/lib/supabase/server'
import { CategoryManager } from '@/components/admin/CategoryManager'
import { MenuItemList } from '@/components/admin/MenuItemList'

export default async function MenuPage() {
  const supabase = await createClient()

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from('categories').select('*').order('display_order', { ascending: true }),
    supabase.from('menu_items').select('*').order('display_order', { ascending: true }),
  ])

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">Menu</h1>
        <section className="mb-10">
          <h2 className="mb-4 text-base font-semibold text-text-primary">Categories</h2>
          <CategoryManager initialCategories={categories ?? []} />
        </section>
        <section>
          <h2 className="mb-4 text-base font-semibold text-text-primary">Items</h2>
          <MenuItemList categories={categories ?? []} items={items ?? []} />
        </section>
      </div>
    </main>
  )
}
