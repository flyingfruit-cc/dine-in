'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isOrderStatus } from '@/utils/orderStatus'
import { pickTranslation } from '@/utils/pickTranslation'
import { formatChrome } from '@/utils/formatChrome'
import { HtmlLangPatcher } from '@/components/customer/HtmlLangPatcher'
import type { ChromeStrings, OrderStatus } from '@/types/app'

interface ConfirmedItem {
  name: string
  quantity: number
  variantNames: string[]
  translations?: Record<string, { name: string; description?: string }>
}

interface OrderConfirmationScreenProps {
  orderId: string
  initialStatus: OrderStatus
  restaurantName: string
  tableNumber: string | number
  items: ConfirmedItem[]
  lang: string
  chrome: ChromeStrings
}

const PILL_CLASS: Record<OrderStatus, string> = {
  received: 'bg-accent/10 text-accent',
  preparing: 'bg-info/10 text-info animate-pulse',
  ready: 'bg-success/10 text-success',
  completed: 'bg-surface-overlay text-text-secondary opacity-60',
}

const DOT_CLASS: Record<OrderStatus, string> = {
  received: 'bg-accent',
  preparing: 'bg-info',
  ready: 'bg-success',
  completed: 'bg-text-secondary',
}

export function OrderConfirmationScreen({
  orderId,
  initialStatus,
  restaurantName,
  tableNumber,
  items,
  lang,
  chrome,
}: OrderConfirmationScreenProps) {
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const [status, setStatus] = useState<OrderStatus>(initialStatus)

  useEffect(() => {
    headlineRef.current?.focus()
  }, [])

  useEffect(() => {
    if (status === 'completed') return

    const supabase = createClient()
    let cancelled = false
    const inFlight = { current: false }

    async function poll() {
      if (inFlight.current || cancelled) return
      inFlight.current = true
      try {
        const { data, error } = await supabase
          .from('orders_customer_status')
          .select('id, status')
          .eq('id', orderId)
          .single()
        if (cancelled) return
        if (error) return
        if (data && isOrderStatus(data.status) && data.status !== status) {
          setStatus(data.status)
        }
      } finally {
        inFlight.current = false
      }
    }

    const intervalId = setInterval(poll, 4000)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [orderId, status])

  const headline = chrome[`order.headline.${status}`]
  const subhead = chrome[`order.subhead.${status}`]
  const pillLabel = chrome[`order.pill.${status}`]
  const caption = formatChrome(chrome['order.tableCaption'], {
    restaurantName,
    tableNumber: String(tableNumber),
  })

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-surface px-6 pt-16 pb-12">
      <HtmlLangPatcher lang={lang} />
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-10 w-10 text-success"
          aria-hidden="true"
        >
          <circle cx={12} cy={12} r={10} />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>

      <h1
        ref={headlineRef}
        tabIndex={-1}
        aria-live="assertive"
        className="mb-2 text-center text-2xl font-semibold text-text-primary focus:outline-none"
      >
        {headline}
      </h1>

      <p className="mb-6 text-center text-base text-text-secondary">
        {subhead}
      </p>

      <p
        role="status"
        aria-live="polite"
        className={`mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${PILL_CLASS[status]}`}
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT_CLASS[status]}`} />
        {pillLabel}
      </p>

      <hr className="w-full border-border mb-6" />

      <ul className="w-full space-y-3">
        {items.map((item, idx) => {
          const { name } = pickTranslation(item, lang)
          return (
            <li key={idx} className="flex flex-col">
              <span className="text-base font-medium text-text-primary">
                {item.quantity}× {name}
              </span>
              {item.variantNames.map((v, vi) => (
                <span key={vi} className="text-sm text-text-secondary">{v}</span>
              ))}
            </li>
          )
        })}
      </ul>

      <p className="mt-8 text-sm text-text-secondary">{caption}</p>
    </main>
  )
}
