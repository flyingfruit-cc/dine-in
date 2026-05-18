'use client'

import { useEffect, useRef } from 'react'

interface ConfirmedItem {
  name: string
  quantity: number
  variantNames: string[]
}

interface OrderConfirmationScreenProps {
  restaurantName: string
  tableNumber: string | number
  items: ConfirmedItem[]
}

export function OrderConfirmationScreen({ restaurantName, tableNumber, items }: OrderConfirmationScreenProps) {
  const headlineRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headlineRef.current?.focus()
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-surface px-6 pt-16 pb-12">
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
        Your order is with the kitchen
      </h1>

      <p className="mb-8 text-center text-base text-text-secondary">
        Thank you! Sit tight while we prepare your food.
      </p>

      <hr className="w-full border-border mb-6" />

      <ul className="w-full space-y-3">
        {items.map((item, idx) => (
          <li key={idx} className="flex flex-col">
            <span className="text-base font-medium text-text-primary">
              {item.quantity}× {item.name}
            </span>
            {item.variantNames.map((v, vi) => (
              <span key={vi} className="text-sm text-text-secondary">{v}</span>
            ))}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-text-secondary">
        {restaurantName} · Table {tableNumber}
      </p>
    </main>
  )
}
