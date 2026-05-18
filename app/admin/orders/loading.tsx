export default function OrdersLoading() {
  return (
    <main className="min-h-screen bg-surface-base" aria-busy="true" aria-label="Loading orders">
      <header className="border-b border-border px-4 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Orders</h1>
      </header>
      <ul className="divide-y divide-border" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="flex items-center gap-3 px-4 py-3"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-border" />
            <span className="h-6 w-16 shrink-0 rounded bg-border" />
            <span className="h-5 flex-1 rounded bg-border" />
            <span className="h-4 w-12 shrink-0 rounded bg-border" />
          </li>
        ))}
      </ul>
    </main>
  )
}
