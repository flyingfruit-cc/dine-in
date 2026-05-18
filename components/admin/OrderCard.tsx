import { formatRelativeTime } from '@/utils/formatTime'
import type { Order, OrderItem } from '@/types/app'

interface Props {
  order: Order
  tableNumber: number | null
}

export function itemSummary(items: OrderItem[]): string {
  if (items.length === 0) return ''
  const first = items.slice(0, 2).map((i) => i.name).join(', ')
  if (items.length <= 2) return first
  return `${first} +${items.length - 2} more`
}

// "Mark handled" action and tap-to-expand are deferred to Story 5.2.
export function OrderCard({ order, tableNumber }: Props) {
  const rawSummary = itemSummary(order.items)
  const summary = rawSummary || 'No items'
  const time = formatRelativeTime(order.submitted_at)
  const tableLabel = tableNumber !== null ? `Table ${tableNumber}` : 'Table —'
  const ariaLabel =
    tableNumber !== null
      ? `Order for Table ${tableNumber}, ${summary}, ${time}`
      : `Order, ${summary}, ${time}`
  const dotColor = order.is_handled ? 'bg-text-secondary opacity-40' : 'bg-accent'
  const rowOpacity = order.is_handled ? 'opacity-40' : ''

  return (
    <div
      aria-label={ariaLabel}
      className={`flex items-center gap-3 px-4 py-3 ${rowOpacity}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
      <span className="shrink-0 text-base font-semibold text-text-primary">
        {tableLabel}
      </span>
      <span className="flex-1 truncate text-sm text-text-secondary">{summary}</span>
      <span className="shrink-0 text-xs text-text-secondary">{time}</span>
    </div>
  )
}
