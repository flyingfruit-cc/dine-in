export default function KdsLoading() {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-4">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="h-6 w-20 animate-pulse rounded bg-surface-overlay" />
        <div className="h-3 w-16 animate-pulse rounded bg-surface-overlay" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-surface-overlay" />
        ))}
      </div>
    </main>
  )
}
