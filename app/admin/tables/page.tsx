import { createClient } from '@/lib/supabase/server'
import { TableCard } from '@/components/admin/TableCard'
import { CreateTableForm } from '@/components/admin/CreateTableForm'

export default async function TablesPage() {
  const supabase = await createClient()

  const [{ data: restaurant }, { data: tables }] = await Promise.all([
    supabase.from('restaurants').select('id, slug').single(),
    supabase.from('tables').select('*').order('number', { ascending: true }),
  ])

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">Tables</h1>
        <CreateTableForm />
        <div className="mt-6">
          {!tables?.length ? (
            <p className="text-sm text-text-secondary">Create your first table →</p>
          ) : restaurant ? (
            <div className="flex flex-col gap-4">
              {tables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  restaurantSlug={restaurant.slug}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}
