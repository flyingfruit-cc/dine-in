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

  return <KdsScreen />
}
