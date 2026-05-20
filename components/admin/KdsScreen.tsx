'use client'

import { useEffect, useRef, useState } from 'react'
import { useOrderStore } from '@/stores/orderStore'
import { OrderTicket } from '@/components/admin/OrderTicket'
import { markOrderHandled, unbumpOrder } from '@/actions/orderActions'

interface Props {
  tablesById: Record<string, number>
}

export function KdsScreen({ tablesById }: Props) {
  const orders = useOrderStore((s) => s.orders)
  const [now, setNow] = useState(() => new Date())
  const [bumpingIds, setBumpingIds] = useState<Set<string>>(new Set())
  const [recentlyBumped, setRecentlyBumped] = useState<{ id: string; tableLabel: string } | null>(null)
  const [bumpError, setBumpError] = useState<{ id: string; message: string } | null>(null)
  const [undoError, setUndoError] = useState<string | null>(null)

  // Synchronous guards (refs avoid React's batching gaps where two rapid clicks
  // can fire before disabled props apply).
  const bumpInFlightRef = useRef<Set<string>>(new Set())
  const undoInFlightRef = useRef(false)
  const undoClaimedRef = useRef<Set<string>>(new Set())
  const safetyTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Single interval at the screen level so all tickets re-render together.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Clear Undo affordance after 5s; cleanup cancels the timer on re-bump so
  // consecutive bumps reset the window (AC #7).
  useEffect(() => {
    if (!recentlyBumped) return
    const t = setTimeout(() => setRecentlyBumped(null), 5_000)
    return () => clearTimeout(t)
  }, [recentlyBumped])

  // Auto-dismiss the undo error so it doesn't linger across new bumps.
  useEffect(() => {
    if (!undoError) return
    const t = setTimeout(() => setUndoError(null), 5_000)
    return () => clearTimeout(t)
  }, [undoError])

  // Clear all pending safety-net timers on unmount.
  useEffect(() => {
    const timers = safetyTimersRef.current
    return () => {
      timers.forEach((id) => clearTimeout(id))
      timers.clear()
    }
  }, [])

  // Keep mid-animation tickets visible even after the optimistic is_handled=true flip.
  // Without bumpingIds.has(o.id), the article unmounts before the slide-out plays.
  const activeOrders = orders
    .filter((o) => !o.is_handled || bumpingIds.has(o.id))
    .slice()
    .sort((a, b) => {
      const ta = Date.parse(a.submitted_at)
      const tb = Date.parse(b.submitted_at)
      if (ta !== tb) return ta - tb
      return a.id < b.id ? -1 : 1
    })

  function handleBumpAnimationEnd(orderId: string) {
    setBumpingIds((prev) => {
      if (!prev.has(orderId)) return prev
      const next = new Set(prev)
      next.delete(orderId)
      return next
    })
  }

  async function handleBump(orderId: string, tableLabel: string) {
    // Synchronous re-entrancy guard; protects against double-tap before the
    // disabled prop reaches the DOM.
    if (bumpInFlightRef.current.has(orderId)) return
    bumpInFlightRef.current.add(orderId)

    setBumpingIds((prev) => {
      const next = new Set(prev)
      next.add(orderId)
      return next
    })

    // Safety net for prefers-reduced-motion path where onAnimationEnd never fires.
    // Track per-id so a re-bump replaces the prior timer instead of racing it.
    const prevTimer = safetyTimersRef.current.get(orderId)
    if (prevTimer !== undefined) clearTimeout(prevTimer)
    const timer = setTimeout(() => {
      safetyTimersRef.current.delete(orderId)
      handleBumpAnimationEnd(orderId)
    }, 250)
    safetyTimersRef.current.set(orderId, timer)

    useOrderStore.getState().markHandled(orderId)
    setRecentlyBumped({ id: orderId, tableLabel })
    if (bumpError?.id === orderId) setBumpError(null)

    try {
      const result = await markOrderHandled(orderId)
      if (!result.success) {
        setBumpingIds((prev) => {
          const next = new Set(prev)
          next.delete(orderId)
          return next
        })

        // If the user already tapped Undo for this id, the store and UI are
        // consistent — don't roll back or show a stale bump error.
        if (undoClaimedRef.current.has(orderId)) {
          undoClaimedRef.current.delete(orderId)
          return
        }

        useOrderStore.getState().unmarkHandled(orderId)
        // Only clear the banner if it still points at THIS id (a newer bump may have claimed it).
        setRecentlyBumped((cur) => (cur?.id === orderId ? null : cur))
        setBumpError({ id: orderId, message: "Tap to retry — bump didn't send" })
      }
    } finally {
      bumpInFlightRef.current.delete(orderId)
    }
  }

  async function handleUndo() {
    if (undoInFlightRef.current) return
    if (!recentlyBumped) return
    undoInFlightRef.current = true

    const orderId = recentlyBumped.id
    const beforeRestore = useOrderStore.getState().orders.find((o) => o.id === orderId)

    // Mark this id as claimed by Undo so a still-pending bump rollback knows to skip.
    undoClaimedRef.current.add(orderId)

    useOrderStore.getState().unmarkHandled(orderId)
    setRecentlyBumped(null)
    setUndoError(null)

    try {
      const result = await unbumpOrder(orderId)
      if (!result.success) {
        if (beforeRestore?.is_handled) useOrderStore.getState().markHandled(orderId)
        setUndoError(result.error || "Tap to retry — undo didn't send")
      }
    } finally {
      undoInFlightRef.current = false
    }
  }

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
        // pb-24 leaves room for the fixed Undo banner so it never covers the last ticket.
        <div className="grid grid-cols-2 gap-4 pb-24 lg:grid-cols-3">
          {activeOrders.map((order) => (
            <OrderTicket
              key={order.id}
              order={order}
              tableNumber={tablesById[order.table_id] ?? null}
              now={now}
              isBumping={bumpingIds.has(order.id)}
              onBump={handleBump}
              onBumpAnimationEnd={handleBumpAnimationEnd}
              errorMessage={bumpError?.id === order.id ? bumpError.message : null}
              onErrorDismiss={() => setBumpError((cur) => (cur?.id === order.id ? null : cur))}
            />
          ))}
        </div>
      )}
      {recentlyBumped && (
        <div className="fixed inset-x-0 bottom-4 z-10 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg bg-surface-overlay p-3">
          <span className="text-sm text-text-primary">Bumped {recentlyBumped.tableLabel}</span>
          <button
            type="button"
            onClick={handleUndo}
            className="min-h-12 rounded-md bg-accent px-4 text-sm font-semibold text-white"
            aria-label={`Undo bump for ${recentlyBumped.tableLabel}`}
          >
            Undo
          </button>
        </div>
      )}
      {undoError && (
        <p className="fixed inset-x-0 bottom-20 z-10 mx-auto max-w-md text-center text-sm text-error" role="status">
          {undoError}
        </p>
      )}
    </main>
  )
}
