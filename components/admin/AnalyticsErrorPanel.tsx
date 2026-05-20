export function AnalyticsErrorPanel() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border py-16 text-center">
      <h2 className="text-lg font-semibold text-text-primary">
        Analytics temporarily unavailable
      </h2>
      <p className="mt-2 text-sm text-text-secondary">Please refresh in a moment</p>
    </div>
  )
}
