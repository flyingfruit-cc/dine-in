'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCartStore } from '@/stores/cartStore'
import { formatPrice } from '@/utils/formatPrice'
import { formatChrome } from '@/utils/formatChrome'
import type { ChromeStrings } from '@/types/app'

interface Props {
  lang: string
  chrome: ChromeStrings
  defaultLanguage: string
}

export function CartBar({ lang, chrome, defaultLanguage }: Props) {
  const params = useParams<{ restaurant_slug: string; table_number: string }>()
  const router = useRouter()
  const items = useCartStore((state) => state.items)
  const count = items.length
  const total = items.reduce((sum, item) => sum + item.price_cents, 0)

  if (count === 0) return null

  const itemWord =
    count === 1 ? chrome['cart.barItemSingular'] : chrome['cart.barItemPlural']
  const formattedTotal = formatPrice(total)
  const ariaLabel = formatChrome(chrome['cart.barAriaLabel'], {
    count,
    itemWord,
    total: formattedTotal,
  })
  const srText = formatChrome(chrome['cart.srItemsInCart'], { count, itemWord })

  const langSuffix = lang === defaultLanguage ? '' : `?lang=${encodeURIComponent(lang)}`

  return (
    <div
      role="complementary"
      className="fixed bottom-0 left-0 right-0 bg-accent text-white"
    >
      <span className="sr-only" aria-live="polite">
        {srText}
      </span>
      <button
        onClick={() =>
          router.push(`/${params.restaurant_slug}/${params.table_number}/cart${langSuffix}`)
        }
        className="flex w-full items-center justify-between px-4 py-3"
        style={{ paddingBottom: `max(0.75rem, env(safe-area-inset-bottom))` }}
        aria-label={ariaLabel}
      >
        <span
          aria-hidden="true"
          className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm font-semibold"
        >
          {count}
        </span>
        <span className="text-base font-semibold">{chrome['cart.barReviewOrder']}</span>
        <span className="font-mono text-sm font-semibold">{formattedTotal}</span>
      </button>
    </div>
  )
}
