'use client'

import { useState } from 'react'
import { useOrderStore } from '@/stores/orderStore'
import { OrderCard } from '@/components/admin/OrderCard'
import { markOrderHandled } from '@/actions/orderActions'

type Tab = 'active' | 'handled' | 'all'

interface Props {
  tablesById: Record<string, number>
}

const EMPTY_STATE: Record<Tab, string> = {
  active: 'No orders yet — orders will appear here automatically',
  handled: 'No handled orders yet',
  all: 'No orders yet',
}

const TAB_LABELS: Record<Tab, string> = {
  active: 'Active',
  handled: 'Handled',
  all: 'All',
}

export function OrderFeed({ tablesById }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('active')
  const orders = useOrderStore((s) => s.orders)
  const isRealtimeReady = useOrderStore((s) => s.isRealtimeReady)
  const readyAttr = isRealtimeReady ? 'true' : 'false'

  const filteredOrders =
    activeTab === 'active'
      ? orders.filter((o) => !o.is_handled)
      : activeTab === 'handled'
        ? orders.filter((o) => o.is_handled)
        : orders

  async function handleMarkHandled(orderId: string) {
    useOrderStore.getState().markHandled(orderId) // optimistic update
    const result = await markOrderHandled(orderId) // persist to DB; Realtime UPDATE reconciles
    if (!result.success) {
      // Optimistic UI already shows handled; surface failure to operators via logs.
      console.error('[markOrderHandled]', result.error)
    }
  }

  return (
    <div>
      <div role="tablist" className="flex border-b border-border">
        {(['active', 'handled', 'all'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm ${
              activeTab === tab
                ? 'border-b-2 border-accent font-medium text-text-primary'
                : 'text-text-secondary'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div data-realtime-ready={readyAttr}>
          <p className="px-4 py-12 text-center text-sm text-text-secondary">
            {EMPTY_STATE[activeTab]}
          </p>
        </div>
      ) : (
        <ul
          className="divide-y divide-border"
          aria-label={`${TAB_LABELS[activeTab]} orders`}
          data-realtime-ready={readyAttr}
        >
          {filteredOrders.map((order) => {
            const tableNumber = tablesById[order.table_id] ?? null
            return (
              <li key={order.id}>
                <OrderCard
                  order={order}
                  tableNumber={tableNumber}
                  onMarkHandled={() => handleMarkHandled(order.id)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
