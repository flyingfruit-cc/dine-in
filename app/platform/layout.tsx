import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_platform_admin) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-surface-base">
      {children}
    </div>
  )
}
