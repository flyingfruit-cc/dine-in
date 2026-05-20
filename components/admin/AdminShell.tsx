'use client'

import { usePathname } from 'next/navigation'
import { AdminNav } from '@/components/admin/AdminNav'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isKds = pathname != null && (pathname === '/admin/kds' || pathname.startsWith('/admin/kds/'))

  if (isKds) return <>{children}</>

  return (
    <div className="min-h-screen">
      <AdminNav />
      <div className="pb-16 lg:pl-56 lg:pb-0">{children}</div>
    </div>
  )
}
