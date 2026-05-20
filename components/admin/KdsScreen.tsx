'use client'

import { useEffect, useState } from 'react'
import { useOrderStore } from '@/stores/orderStore'
import { OrderTicket } from '@/components/admin/OrderTicket'

interface Props {
  tablesById: Record<string, number>
}

export function KdsScreen({ tablesById }: Props) {
  const orders = useOrderStore((s) => s.orders)
  const [now, setNow] = useState(() => new Date())

  // Single interval at the screen level so all tickets re-render together.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // .slice() before .sort() to avoid mutating the store-owned array reference.
  // Compare timestamps via Date.parse so mixed `Z` vs `+00:00` ISO suffixes
  // sort chronologically (lexicographic compare puts `+` before `Z`).
  const activeOrders = orders
    .filter((o) => !o.is_handled)
    .slice()
    .sort((a, b) => {
      const ta = Date.parse(a.submitted_at)
      const tb = Date.parse(b.submitted_at)
      if (ta !== tb) return ta - tb
      return a.id < b.id ? -1 : 1
    })

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
            <OrderTicket
              key={order.id}
              order={order}
              tableNumber={tablesById[order.table_id] ?? null}
              now={now}
            />
          ))}
        </div>
      )}
    </main>
  )
}
