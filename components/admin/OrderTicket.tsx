'use client'

import type { Order } from '@/types/app'
import { formatRelativeTime } from '@/utils/formatTime'

interface Props {
  order: Order
  tableNumber: number | null
  now: Date
  isBumping: boolean
  onBump: (orderId: string, tableLabel: string) => void
  onBumpAnimationEnd: (orderId: string) => void
  errorMessage: string | null
  onErrorDismiss: () => void
}

export function OrderTicket({ order, tableNumber, now, isBumping, onBump, onBumpAnimationEnd, errorMessage, onErrorDismiss }: Props) {
  const elapsedMs = now.getTime() - new Date(order.submitted_at).getTime()
  // Clamp negative skew (tablet clock behind server) to 0 so brand-new orders
  // never mis-classify into warning/error border states.
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000))

  const borderClass =
    elapsedMinutes >= 15 ? 'border-error'
    : elapsedMinutes >= 10 ? 'border-warning'
    : 'border-border'

  const tableLabel = tableNumber !== null ? `Table ${tableNumber}` : 'Table —'
  const accessibleTable = tableNumber !== null ? `Table ${tableNumber}` : 'unknown table'

  return (
    <article
      className={`rounded-lg border-2 bg-surface-raised p-4 ${borderClass} ${
        isBumping
          ? 'animate-out fade-out slide-out-to-right duration-200 fill-mode-forwards motion-reduce:animate-none'
          : ''
      }`}
      onAnimationEnd={(e) => {
        // Guard against child animations (e.g. animate-pulse on the time span) bubbling up.
        if (isBumping && e.target === e.currentTarget) onBumpAnimationEnd(order.id)
      }}
      aria-label={`Order for ${accessibleTable}, ${formatRelativeTime(order.submitted_at, now)}`}
    >
      <header className="flex items-baseline justify-between gap-3">
        <span className="text-4xl font-bold text-text-primary tabular-nums">
          {tableLabel}
        </span>
        <span
          className={`text-sm text-text-secondary tabular-nums ${elapsedMinutes >= 10 ? 'animate-pulse' : ''}`}
        >
          {formatRelativeTime(order.submitted_at, now)}
        </span>
      </header>
      <ul className="my-4 space-y-2">
        {order.items.map((item, i) => (
          <li key={i} className="text-base text-text-primary">
            <span className="font-semibold tabular-nums">{item.quantity}×</span> {item.name}
            {item.variants.length > 0 && (
              <p className="ml-6 text-sm text-text-secondary">{item.variants.join(', ')}</p>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={isBumping}
        onClick={() => {
          if (errorMessage) onErrorDismiss()
          onBump(order.id, tableLabel)
        }}
        aria-label={`Bump order for ${accessibleTable}`}
        className="min-h-16 w-full rounded-lg bg-accent text-base font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Bump
      </button>
      {errorMessage && (
        <p className="mt-2 text-sm text-error" role="alert">
          {errorMessage}
        </p>
      )}
    </article>
  )
}
