export default function KdsLoading() {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-4">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="h-6 w-20 animate-pulse rounded bg-surface-overlay" />
        <div className="h-3 w-16 animate-pulse rounded bg-surface-overlay" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border-2 border-border bg-surface-raised p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="h-10 w-32 animate-pulse rounded bg-surface-overlay" />
              <div className="h-4 w-16 animate-pulse rounded bg-surface-overlay" />
            </div>
            <div className="my-4 space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-5 w-full animate-pulse rounded bg-surface-overlay" />
              ))}
            </div>
            <div className="h-16 w-full animate-pulse rounded-lg bg-surface-overlay" />
          </div>
        ))}
      </div>
    </main>
  )
}
