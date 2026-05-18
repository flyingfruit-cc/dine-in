'use client'

import { useCartStore } from '@/stores/cartStore'
import { formatPrice } from '@/utils/formatPrice'

export function CartBar() {
  const items = useCartStore((state) => state.items)
  const count = items.length
  const total = items.reduce((sum, item) => sum + item.price_cents, 0)

  if (count === 0) return null

  return (
    <div
      role="complementary"
      aria-label={`Cart: ${count} ${count === 1 ? 'item' : 'items'}, ${formatPrice(total)}`}
      onClick={() => {
        // story 4-4 wires cart review navigation
      }}
      className="fixed bottom-0 left-0 right-0 flex cursor-pointer items-center justify-between bg-accent px-4 py-3 text-white"
      style={{ paddingBottom: `max(0.75rem, env(safe-area-inset-bottom))` }}
    >
      <span
        aria-live="polite"
        className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm font-semibold"
      >
        {count}
      </span>
      <span className="text-base font-semibold">Review Order</span>
      <span className="font-mono text-sm font-semibold">{formatPrice(total)}</span>
    </div>
  )
}
