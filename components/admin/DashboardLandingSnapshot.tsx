import Link from 'next/link'
import { Receipt, UtensilsCrossed, Settings, ChefHat } from 'lucide-react'
import { OrderCard } from '@/components/admin/OrderCard'
import { formatPrice } from '@/utils/formatPrice'
import type { Order } from '@/types/app'

interface Props {
  activeOrderCount: number
  todayOrderCount: number
  todayRevenueCents: number
  recentOrders: Order[]
  tablesById: Record<string, number>
}

export function DashboardLandingSnapshot({
  activeOrderCount,
  todayOrderCount,
  todayRevenueCents,
  recentOrders,
  tablesById,
}: Props) {
  const revenueFormatted = formatPrice(todayRevenueCents)

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="dashboard-today-heading"
        className="rounded-lg border border-border bg-surface-raised p-6"
      >
        <h2
          id="dashboard-today-heading"
          className="mb-2 text-base font-semibold text-text-primary"
        >
          Today
        </h2>
        <p className="text-sm text-text-secondary">
          <span className="text-text-primary">{activeOrderCount} active</span>
          <span className="sr-only">, </span>
          <span aria-hidden="true"> · </span>
          <span>{todayOrderCount} today</span>
          <span className="sr-only">, </span>
          <span aria-hidden="true"> · </span>
          <span>{revenueFormatted}</span>
        </p>
      </section>

      <section
        aria-labelledby="dashboard-latest-heading"
        className="rounded-lg border border-border bg-surface-raised"
      >
        <h2
          id="dashboard-latest-heading"
          className="border-b border-border px-4 py-3 text-base font-semibold text-text-primary"
        >
          Latest orders
        </h2>
        {recentOrders.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-secondary">
            No orders yet. Your first customer order will show up here on next visit.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <OrderCard
                  order={order}
                  tableNumber={tablesById[order.table_id] ?? null}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border px-4 py-3">
          <Link href="/admin/orders" className="text-sm text-accent hover:underline">
            Go to Orders <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <nav
        aria-label="Quick actions"
        className="flex flex-wrap gap-2"
      >
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface"
        >
          <Receipt size={16} strokeWidth={1.75} />
          Orders
        </Link>
        <Link
          href="/admin/kds"
          className="hidden lg:inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface"
        >
          <ChefHat size={16} strokeWidth={1.75} />
          Kitchen
        </Link>
        <Link
          href="/admin/menu"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface"
        >
          <UtensilsCrossed size={16} strokeWidth={1.75} />
          Menu
        </Link>
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface"
        >
          <Settings size={16} strokeWidth={1.75} />
          Settings
        </Link>
      </nav>
    </div>
  )
}
