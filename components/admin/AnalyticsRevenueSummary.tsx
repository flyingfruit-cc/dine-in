import { formatPrice } from '@/utils/formatPrice'

interface Props {
  totalRevenueCents: number
  averageOrderValueCents: number
  orderCount: number
}

export function AnalyticsRevenueSummary({
  totalRevenueCents,
  averageOrderValueCents,
  orderCount,
}: Props) {
  const totalRevenueStr = formatPrice(totalRevenueCents)
  const avgOrderStr = formatPrice(averageOrderValueCents)
  const orderCountStr = orderCount.toLocaleString('en-US')

  return (
    <div
      role="group"
      aria-label="Revenue summary"
      className="rounded-lg border border-border bg-surface-raised px-4 py-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text-secondary">Total Revenue</span>
          <span
            className="text-2xl font-semibold text-text-primary"
            aria-label={`Total Revenue: ${totalRevenueStr}`}
          >
            {totalRevenueStr}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text-secondary">Average Order</span>
          <span
            className="text-2xl font-semibold text-text-primary"
            aria-label={`Average Order: ${avgOrderStr}`}
          >
            {avgOrderStr}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text-secondary">Orders</span>
          <span
            className="text-2xl font-semibold text-text-primary"
            aria-label={`Orders: ${orderCountStr}`}
          >
            {orderCountStr}
          </span>
        </div>
      </div>
    </div>
  )
}
