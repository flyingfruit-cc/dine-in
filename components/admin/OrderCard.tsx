'use client'

import { useId, useState } from 'react'
import { formatRelativeTime } from '@/utils/formatTime'
import { STATUS_DOT_CLASS, NEXT_STATUS_LABEL, NEXT_STATUS } from '@/utils/orderStatus'
import type { Order, OrderItem, OrderStatus } from '@/types/app'

interface Props {
  order: Order
  tableNumber: number | null
  onAdvance?: (nextStatus: OrderStatus) => void
  errorMessage?: string | null
  onErrorDismiss?: () => void
}

export function itemSummary(items: OrderItem[]): string {
  if (items.length === 0) return ''
  const first = items.slice(0, 2).map((i) => i.name).join(', ')
  if (items.length <= 2) return first
  return `${first} +${items.length - 2} more`
}

export function OrderCard({ order, tableNumber, onAdvance, errorMessage, onErrorDismiss }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const panelId = useId()
  const rawSummary = itemSummary(order.items)
  const summary = rawSummary || 'No items'
  const time = formatRelativeTime(order.submitted_at)
  const tableLabel = tableNumber !== null ? `Table ${tableNumber}` : 'Table —'
  const dotClass = STATUS_DOT_CLASS[order.status]
  const actionLabel = NEXT_STATUS_LABEL[order.status]
  const nextStatus = NEXT_STATUS[order.status]
  const rowOpacity = order.status === 'completed' ? 'opacity-40' : ''
  const ariaLabel =
    tableNumber !== null
      ? `Order for Table ${tableNumber}, ${order.status}, ${summary}, ${time}`
      : `Order, ${order.status}, ${summary}, ${time}`

  return (
    <div className={rowOpacity}>
      {/* Compact row — tap to expand/collapse full item list */}
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        <span className="shrink-0 text-base font-semibold text-text-primary">
          {tableLabel}
        </span>
        <span className="flex-1 truncate text-sm text-text-secondary">{summary}</span>
        <span className="shrink-0 text-xs text-text-secondary">{time}</span>
      </button>

      {/* Inline status advance action — hidden for completed orders */}
      {actionLabel && nextStatus && onAdvance && (
        <button
          type="button"
          onClick={() => {
            if (errorMessage) onErrorDismiss?.()
            onAdvance(nextStatus)
          }}
          aria-label={`${actionLabel} for ${tableLabel} (currently ${order.status})`}
          className="px-4 pb-2 text-sm text-accent"
        >
          {actionLabel}
        </button>
      )}

      {/* Inline error message — shown when an advance action fails */}
      {errorMessage && (
        <p className="px-4 pb-2 text-sm text-error" role="alert">
          {errorMessage}
        </p>
      )}

      {/* Inline expanded: full item list with variants. No prices (owner-side never shows prices). */}
      {isExpanded && (
        <ul id={panelId} className="px-4 pb-3">
          {order.items.map((item, i) => (
            <li key={i} className="py-0.5">
              <span className="text-sm text-text-primary">
                {item.quantity}× {item.name}
              </span>
              {item.variants.length > 0 && (
                <p className="text-xs text-text-secondary">{item.variants.join(', ')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
