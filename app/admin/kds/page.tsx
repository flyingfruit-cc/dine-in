import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KdsScreen } from '@/components/admin/KdsScreen'

export const metadata = {
  title: 'Kitchen — dine-in',
}

export default async function AdminKdsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.restaurant_id) redirect('/auth/onboarding')

  const { data: tables, error: tablesError } = await supabase
    .from('tables')
    .select('id, number')
    .eq('restaurant_id', profile.restaurant_id)

  if (tablesError) {
    // RLS / network failure — surface so kitchen staff don't see silent "Table —" everywhere
    console.error('[admin/kds] failed to load tables for lookup', tablesError)
  }

  const tablesById: Record<string, number> = {}
  for (const t of tables ?? []) tablesById[t.id] = t.number

  return <KdsScreen tablesById={tablesById} />
}
