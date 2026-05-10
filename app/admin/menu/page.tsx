import { createClient } from '@/lib/supabase/server'
import { CategoryManager } from '@/components/admin/CategoryManager'
import type { Category } from '@/types/app'

export default async function MenuPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true })

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">Menu</h1>
        <section>
          <h2 className="mb-4 text-base font-semibold text-text-primary">Categories</h2>
          <CategoryManager initialCategories={categories ?? []} />
        </section>
      </div>
    </main>
  )
}
