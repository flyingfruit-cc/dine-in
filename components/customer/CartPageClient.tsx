'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/stores/cartStore'
import { formatPrice } from '@/utils/formatPrice'
import { pickTranslation } from '@/utils/pickTranslation'
import { formatChrome } from '@/utils/formatChrome'
import { HtmlLangPatcher } from '@/components/customer/HtmlLangPatcher'
import { submitOrder } from '@/actions/orderActions'
import type { CartItem, ChromeStrings, SelectedVariant } from '@/types/app'

interface Props {
  restaurantSlug: string
  tableNumber: string
  lang: string
  chrome: ChromeStrings
  defaultLanguage: string
}

interface CartLineItem {
  key: string
  menuItemId: string
  name: string
  price_cents: number
  selectedVariants: SelectedVariant[]
  quantity: number
  cartItemIds: string[]
  translations?: Record<string, { name: string; description?: string }>
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
        translations: item.translations,
      })
    }
  }
  return Array.from(map.values())
}

export function CartPageClient({
  restaurantSlug,
  tableNumber,
  lang,
  chrome,
  defaultLanguage,
}: Props) {
  const router = useRouter()
  const items = useCartStore((state) => state.items)
  const hasSubmittedRef = useRef(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const langSuffix = lang === defaultLanguage ? '' : `?lang=${encodeURIComponent(lang)}`

  useEffect(() => {
    if (items.length === 0 && !hasSubmittedRef.current) {
      router.replace(`/${restaurantSlug}/${tableNumber}${langSuffix}`)
    }
  }, [items.length, restaurantSlug, tableNumber, router, langSuffix])

  const lineItems = groupCartItems(items)
  const grandTotal = lineItems.reduce((sum, l) => sum + l.price_cents * l.quantity, 0)

  if (hasSubmittedRef.current || items.length === 0) return null

  async function handlePlaceOrder() {
    const currentItems = items
    setIsSubmitting(true)
    setSubmitError(null)
    const result = await submitOrder({
      restaurantSlug,
      tableNumber: Number(tableNumber),
      cartItems: currentItems,
    })
    if (result.success) {
      hasSubmittedRef.current = true
      useCartStore.getState().clearCart()
      router.replace(`/${restaurantSlug}/${tableNumber}/order/${result.data.id}${langSuffix}`)
    } else {
      setSubmitError(result.error)
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <HtmlLangPatcher lang={lang} />
      <header className="border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="shrink-0 text-sm font-medium text-accent"
          aria-label={chrome['cart.addMoreItems']}
        >
          {chrome['cart.addMoreItems']}
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-text-primary">
          {chrome['cart.reviewOrderTitle']}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        <ul className="divide-y divide-border">
          {lineItems.map((line) => {
            const { name } = pickTranslation(
              { name: line.name, translations: line.translations },
              lang,
            )
            const removeAriaLabel = formatChrome(chrome['cart.removeAriaLabel'], { name })
            return (
              <li key={line.key} className="flex items-start gap-3 px-4 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-text-primary">{name}</p>
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
                    aria-label={removeAriaLabel}
                    className="text-sm text-text-secondary underline"
                  >
                    {chrome['cart.remove']}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="border-t border-border px-4 py-4 flex items-center justify-between">
          <span className="text-base font-semibold text-text-primary">{chrome['cart.total']}</span>
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
          aria-label={isSubmitting ? chrome['cart.placingOrderAriaLabel'] : chrome['cart.placeOrder']}
          className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-accent text-base font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? chrome['cart.placingOrder'] : chrome['cart.placeOrder']}
        </button>
      </div>
    </main>
  )
}
