'use client'

import { useEffect } from 'react'
import { useOrderStore } from '@/stores/orderStore'
import { formatRelativeTime } from '@/utils/formatTime'
import type { Order } from '@/types/app'

export function KdsScreen() {
  const orders = useOrderStore((s) => s.orders)
  const activeOrders = orders.filter((o) => !o.is_handled)

  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false
    let acquiring = false

    async function acquire() {
      if (!('wakeLock' in navigator)) return
      if (sentinel || acquiring) return
      acquiring = true
      try {
        const next = await navigator.wakeLock.request('screen')
        if (cancelled) {
          next.release().catch(() => {})
          return
        }
        sentinel = next
        // Browser may auto-release (low battery, OS policy); clear ref so
        // visibilitychange can re-acquire.
        next.addEventListener('release', () => {
          if (sentinel === next) sentinel = null
        })
      } catch {
        // user denial, low battery, or other policy denial — silent
      } finally {
        acquiring = false
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible' && !cancelled) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      sentinel?.release().catch(() => {})
    }
  }, [])

  return (
    <main className="min-h-screen bg-surface-base px-4 py-4">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Kitchen</h1>
        <span className="text-xs text-text-secondary tabular-nums">
          {activeOrders.length} {activeOrders.length === 1 ? 'order' : 'orders'}
        </span>
      </header>
      {activeOrders.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-base text-text-secondary">Waiting for orders</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {activeOrders.map((order) => (
            <KdsTicketPlaceholder key={order.id} order={order} />
          ))}
        </div>
      )}
    </main>
  )
}

function KdsTicketPlaceholder({ order }: { order: Order }) {
  return (
    <article className="rounded-lg border border-border bg-surface-raised p-4">
      <header className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold text-text-primary tabular-nums">
          Table {order.table_id}
        </span>
        <span className="text-xs text-text-secondary tabular-nums">
          {formatRelativeTime(order.submitted_at)}
        </span>
      </header>
      <p className="mt-2 text-xs italic text-text-secondary">Ticket UI coming in Story 8.2</p>
    </article>
  )
}
