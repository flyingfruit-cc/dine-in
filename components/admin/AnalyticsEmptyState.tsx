interface Props {
  orderCount: number
}

export function AnalyticsEmptyState({ orderCount }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border py-16 text-center">
      <h2 className="text-lg font-semibold text-text-primary">
        Not enough data yet — keep serving!
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        {orderCount > 0
          ? `You have ${orderCount} order${orderCount !== 1 ? 's' : ''} — come back when you have ≥30`
          : 'Come back when you have ≥30 orders'}
      </p>
    </div>
  )
}
