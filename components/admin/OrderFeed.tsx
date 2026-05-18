'use client'

import { useOrderStore } from '@/stores/orderStore'
import { OrderCard } from '@/components/admin/OrderCard'

interface Props {
  tablesById: Record<string, number>
}

// Story 5.1 renders only the Active view (unhandled orders).
// Active/Handled/All tab switching is deferred to Story 5.2.
export function OrderFeed({ tablesById }: Props) {
  const orders = useOrderStore((s) => s.orders)
  const isRealtimeReady = useOrderStore((s) => s.isRealtimeReady)
  const activeOrders = orders.filter((o) => !o.is_handled)
  const readyAttr = isRealtimeReady ? 'true' : 'false'

  if (activeOrders.length === 0) {
    return (
      <div data-realtime-ready={readyAttr}>
        <p className="px-4 py-12 text-center text-sm text-text-secondary">
          No orders yet — orders will appear here automatically
        </p>
      </div>
    )
  }

  return (
    <ul
      className="divide-y divide-border"
      aria-label="Active orders"
      data-realtime-ready={readyAttr}
    >
      {activeOrders.map((order) => {
        const tableNumber = tablesById[order.table_id] ?? null
        return (
          <li key={order.id}>
            <OrderCard order={order} tableNumber={tableNumber} />
          </li>
        )
      })}
    </ul>
  )
}
