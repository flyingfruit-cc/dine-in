import { createAdminClient } from '@/lib/supabase/admin'
import { TenantList } from '@/components/platform/TenantList'

export default async function TenantsPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('restaurants')
    .select('id, name, slug, created_at, is_published')
    .order('created_at', { ascending: false })

  const restaurants = data ?? []

  return (
    <main className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">Tenants</h1>
      <TenantList restaurants={restaurants} />
    </main>
  )
}
