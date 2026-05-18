'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCartStore } from '@/stores/cartStore'
import { formatPrice } from '@/utils/formatPrice'
import { submitOrder } from '@/actions/orderActions'
import { OrderConfirmationScreen } from '@/components/customer/OrderConfirmationScreen'
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

interface ConfirmedOrderState {
  restaurantName: string
  tableNumber: number
  lineItems: CartLineItem[]
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

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrderState | null>(null)

  useEffect(() => {
    if (items.length === 0 && !confirmedOrder) {
      router.replace(`/${restaurant_slug}/${table_number}`)
    }
  }, [items.length, restaurant_slug, table_number, router, confirmedOrder])

  const lineItems = groupCartItems(items)
  const grandTotal = lineItems.reduce((sum, l) => sum + l.price_cents * l.quantity, 0)

  if (items.length === 0 && !confirmedOrder) return null

  if (confirmedOrder) {
    return (
      <OrderConfirmationScreen
        restaurantName={confirmedOrder.restaurantName}
        tableNumber={confirmedOrder.tableNumber}
        items={confirmedOrder.lineItems.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          variantNames: l.selectedVariants.map((v) => v.optionName),
        }))}
      />
    )
  }

  async function handlePlaceOrder() {
    const currentLineItems = lineItems
    const currentItems = items
    setIsSubmitting(true)
    setSubmitError(null)
    const result = await submitOrder({
      restaurantSlug: restaurant_slug,
      tableNumber: Number(table_number),
      cartItems: currentItems,
    })
    if (result.success) {
      setConfirmedOrder({ ...result.data, lineItems: currentLineItems })
      useCartStore.getState().clearCart()
    } else {
      setSubmitError(result.error)
      setIsSubmitting(false)
    }
  }

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
        {submitError && (
          <p role="alert" className="pb-2 text-sm text-error text-center">
            {submitError}
          </p>
        )}
        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={isSubmitting}
          aria-label={isSubmitting ? 'Placing order, please wait' : 'Place Order'}
          className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-accent text-base font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? 'Placing order…' : 'Place Order'}
        </button>
      </div>
    </main>
  )
}
