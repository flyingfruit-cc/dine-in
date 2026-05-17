export function MenuSkeleton() {
  return (
    <div>
      {/* Tab bar placeholder */}
      <div className="sticky top-0 z-10 flex h-10 gap-2 overflow-x-auto border-b border-border bg-background px-4 py-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-6 w-20 shrink-0 animate-pulse rounded-full bg-surface-overlay"
          />
        ))}
      </div>

      {/* Item row placeholders */}
      <div className="flex flex-col gap-3 px-4 py-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 py-3 border-b border-border">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-lg bg-surface-overlay" />
            <div className="flex flex-col gap-2 flex-1 py-1">
              <div className="h-4 w-3/4 animate-pulse rounded bg-surface-overlay" />
              <div className="h-3 w-full animate-pulse rounded bg-surface-overlay" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-surface-overlay" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
