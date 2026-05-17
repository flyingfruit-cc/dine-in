'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, UtensilsCrossed, QrCode, Settings } from 'lucide-react'

const tabs = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/menu', label: 'Menu', icon: UtensilsCrossed, exact: false },
  { href: '/admin/tables', label: 'Tables', icon: QrCode, exact: false },
  { href: '/admin/settings', label: 'Settings', icon: Settings, exact: false },
]

export function AdminNav() {
  const pathname = usePathname()

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile: bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface-raised lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Admin navigation"
      >
        <div className="flex">
          {tabs.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact)
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
                  active ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop: left sidebar */}
      <nav
        className="fixed left-0 top-0 hidden h-full w-56 flex-col border-r border-border bg-surface-raised lg:flex"
        aria-label="Admin navigation"
      >
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
            dine-in
          </p>
        </div>
        <div className="flex flex-col gap-1 p-2">
          {tabs.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent-muted text-accent'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
