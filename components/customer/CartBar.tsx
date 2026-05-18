'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCartStore } from '@/stores/cartStore'
import { formatPrice } from '@/utils/formatPrice'

export function CartBar() {
  const params = useParams<{ restaurant_slug: string; table_number: string }>()
  const router = useRouter()
  const items = useCartStore((state) => state.items)
  const count = items.length
  const total = items.reduce((sum, item) => sum + item.price_cents, 0)

  if (count === 0) return null

  return (
    <div
      role="complementary"
      className="fixed bottom-0 left-0 right-0 bg-accent text-white"
    >
      <span className="sr-only" aria-live="polite">
        {count} {count === 1 ? 'item' : 'items'} in cart
      </span>
      <button
        onClick={() => router.push(`/${params.restaurant_slug}/${params.table_number}/cart`)}
        className="flex w-full items-center justify-between px-4 py-3"
        style={{ paddingBottom: `max(0.75rem, env(safe-area-inset-bottom))` }}
        aria-label={`Cart: ${count} ${count === 1 ? 'item' : 'items'}, ${formatPrice(total)} — tap to review order`}
      >
        <span
          aria-hidden="true"
          className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm font-semibold"
        >
          {count}
        </span>
        <span className="text-base font-semibold">Review Order</span>
        <span className="font-mono text-sm font-semibold">{formatPrice(total)}</span>
      </button>
    </div>
  )
}
