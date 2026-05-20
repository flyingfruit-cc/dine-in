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

        {/* Revenue Summary tile: 3 KPI skeletons */}
        <div className="mt-6 rounded-lg border border-border bg-surface-raised px-4 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-1 flex-col gap-2">
                <div className="h-3 w-20 animate-pulse rounded bg-surface-overlay" />
                <div className="h-7 w-24 animate-pulse rounded bg-surface-overlay" />
              </div>
            ))}
          </div>
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

        {/* Popular Items: title + 10 row skeletons */}
        <div className="mt-8">
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-surface-overlay" />
          <div className="rounded-lg border border-border bg-surface-raised">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="h-4 w-6 animate-pulse rounded bg-surface-overlay" />
                <div className="h-4 flex-1 animate-pulse rounded bg-surface-overlay" />
                <div className="h-4 w-10 animate-pulse rounded bg-surface-overlay" />
                <div className="h-4 w-16 animate-pulse rounded bg-surface-overlay" />
                <div className="h-4 w-4 animate-pulse rounded bg-surface-overlay" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
