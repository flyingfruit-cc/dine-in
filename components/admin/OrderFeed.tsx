'use client'

import { useRef, useState } from 'react'
import { useOrderStore } from '@/stores/orderStore'
import { OrderCard } from '@/components/admin/OrderCard'
import { advanceOrderStatus } from '@/actions/orderActions'
import type { OrderStatus } from '@/types/app'

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

const ERROR_MESSAGE: Record<string, string> = {
  CONCURRENT_UPDATE: 'Order changed — please refresh',
  INVALID_TRANSITION: 'Order state changed — please refresh',
  UPDATE_FAILED: "Tap to retry — update didn't send",
  NOT_AUTHENTICATED: 'Session expired — please log in',
  NOT_FOUND: 'Order not found — please refresh',
}

function errorMessageFor(code: string | undefined): string {
  return (code && ERROR_MESSAGE[code]) || "Tap to retry — update didn't send"
}

export function OrderFeed({ tablesById }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('active')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const inFlightRef = useRef<Set<string>>(new Set())
  const orders = useOrderStore((s) => s.orders)
  const isRealtimeReady = useOrderStore((s) => s.isRealtimeReady)
  const readyAttr = isRealtimeReady ? 'true' : 'false'

  const filteredOrders =
    activeTab === 'active'
      ? orders.filter((o) => o.status !== 'completed')
      : activeTab === 'handled'
        ? orders.filter((o) => o.status === 'completed')
        : orders

  async function handleAdvance(orderId: string, nextStatus: OrderStatus) {
    if (inFlightRef.current.has(orderId)) return
    inFlightRef.current.add(orderId)

    const prev = useOrderStore.getState().orders.find((o) => o.id === orderId)
    if (!prev) {
      inFlightRef.current.delete(orderId)
      return
    }

    useOrderStore.getState().updateStatus(orderId, nextStatus)
    setErrors((e) => {
      if (!(orderId in e)) return e
      const { [orderId]: _, ...rest } = e
      return rest
    })

    try {
      const result = await advanceOrderStatus(orderId, nextStatus)
      if (!result.success) {
        // State-desync codes (CONCURRENT_UPDATE, INVALID_TRANSITION) mean the
        // server has a truth we don't — Realtime will deliver it. Rolling back
        // to prev.status would stomp a Realtime echo that may have already
        // arrived during the await. For transport/identity codes, no Realtime
        // echo is coming, so we must roll back the optimistic write ourselves.
        if (result.code !== 'CONCURRENT_UPDATE' && result.code !== 'INVALID_TRANSITION') {
          useOrderStore.getState().updateStatus(orderId, prev.status)
        }
        setErrors((e) => ({ ...e, [orderId]: errorMessageFor(result.code) }))
      }
    } finally {
      inFlightRef.current.delete(orderId)
    }
  }

  function dismissError(orderId: string) {
    setErrors((e) => {
      if (!(orderId in e)) return e
      const { [orderId]: _, ...rest } = e
      return rest
    })
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
                  onAdvance={(next) => handleAdvance(order.id, next)}
                  errorMessage={errors[order.id] ?? null}
                  onErrorDismiss={() => dismissError(order.id)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
