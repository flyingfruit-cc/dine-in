export default function AnalyticsLoading() {
  return (
    <main className="min-h-screen bg-surface-base">
      <header className="border-b border-border px-4 py-4">
        <div className="h-6 w-24 animate-pulse rounded bg-surface-overlay" />
      </header>
      <div className="px-4 py-4">
        {/* Period selector chips */}
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 w-20 animate-pulse rounded-full bg-surface-overlay"
            />
          ))}
        </div>

        {/* Order Volume chart: title + chart area */}
        <div className="mt-6">
          <div className="mb-3 h-4 w-28 animate-pulse rounded bg-surface-overlay" />
          <div className="h-60 w-full animate-pulse rounded-lg bg-surface-overlay" />
        </div>

        {/* Peak Hours heatmap: title + grid (matching real layout: 3rem label col + 24 hour cols) */}
        <div className="mt-8">
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-surface-overlay" />
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `3rem repeat(24, minmax(12px, 1fr))` }}
          >
            {Array.from({ length: 8 * 25 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-sm bg-surface-overlay"
                style={{ minWidth: '12px', minHeight: '12px' }}
              />
            ))}
          </div>
          <div className="mt-2 h-3 w-32 animate-pulse rounded bg-surface-overlay" />
        </div>
      </div>
    </main>
  )
}
