'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCartStore } from '@/stores/cartStore'
import { formatPrice } from '@/utils/formatPrice'
import type { CartItem, SelectedVariant } from '@/types/app'

interface CartLineItem {
  key: string
  menuItemId: string
  name: string
  price_cents: number
  selectedVariants: SelectedVariant[]
  quantity: number
  cartItemIds: string[]
}

function groupCartItems(items: CartItem[]): CartLineItem[] {
  const map = new Map<string, CartLineItem>()
  for (const item of items) {
    const variantKey = item.selectedVariants
      .map((v) => `${v.groupId}:${v.optionId}`)
      .sort()
      .join(',')
    const key = `${item.menuItemId}:${variantKey}`
    const existing = map.get(key)
    if (existing) {
      existing.quantity++
      existing.cartItemIds.push(item.cartItemId)
    } else {
      map.set(key, {
        key,
        menuItemId: item.menuItemId,
        name: item.name,
        price_cents: item.price_cents,
        selectedVariants: item.selectedVariants,
        quantity: 1,
        cartItemIds: [item.cartItemId],
      })
    }
  }
  return Array.from(map.values())
}

export default function CartPage() {
  const { restaurant_slug, table_number } = useParams<{ restaurant_slug: string; table_number: string }>()
  const router = useRouter()
  const items = useCartStore((state) => state.items)

  useEffect(() => {
    if (items.length === 0) {
      router.replace(`/${restaurant_slug}/${table_number}`)
    }
  }, [items.length, restaurant_slug, table_number, router])

  const lineItems = groupCartItems(items)
  const grandTotal = lineItems.reduce((sum, l) => sum + l.price_cents * l.quantity, 0)

  if (items.length === 0) return null

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="shrink-0 text-sm font-medium text-accent"
          aria-label="Add more items — return to menu"
        >
          ← Add more items
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-text-primary">Order Review</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        <ul className="divide-y divide-border">
          {lineItems.map((line) => (
            <li key={line.key} className="flex items-start gap-3 px-4 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-text-primary">{line.name}</p>
                {line.selectedVariants.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5">
                    {line.selectedVariants.map((v) => (
                      <li key={v.optionId} className="text-sm text-text-secondary">
                        {v.optionName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm text-text-secondary">×{line.quantity}</span>
                <span className="font-mono text-sm font-medium text-text-primary">
                  {formatPrice(line.price_cents * line.quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => useCartStore.getState().removeItem(line.cartItemIds[0])}
                  aria-label={`Remove one ${line.name} from cart`}
                  className="text-sm text-text-secondary underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-border px-4 py-4 flex items-center justify-between">
          <span className="text-base font-semibold text-text-primary">Total</span>
          <span className="font-mono text-base font-semibold text-text-primary">
            {formatPrice(grandTotal)}
          </span>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface px-4 pt-3"
        style={{ paddingBottom: `max(0.75rem, env(safe-area-inset-bottom))` }}
      >
        <button
          type="button"
          onClick={() => {
            // story 4-5 wires submitOrder Server Action here
          }}
          aria-label="Place Order"
          className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-accent text-base font-semibold text-white"
        >
          Place Order
        </button>
      </div>
    </main>
  )
}
