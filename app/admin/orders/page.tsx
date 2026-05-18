import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrderFeed } from '@/components/admin/OrderFeed'

export default async function AdminOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.restaurant_id) redirect('/auth/onboarding')

  // Tables are stable across a service session; fetch once for the lookup map.
  // Orders themselves are hydrated client-side by RealtimeProvider (admin layout).
  const { data: tables } = await supabase
    .from('tables')
    .select('id, number')
    .eq('restaurant_id', profile.restaurant_id)

  const tablesById: Record<string, number> = {}
  for (const t of tables ?? []) tablesById[t.id] = t.number

  return (
    <main className="min-h-screen bg-surface-base">
      <header className="border-b border-border px-4 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Orders</h1>
      </header>
      <OrderFeed tablesById={tablesById} />
    </main>
  )
}
