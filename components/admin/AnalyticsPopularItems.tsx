import type { TopItem } from '@/types/app'
import { AnalyticsPopularItemRow } from '@/components/admin/AnalyticsPopularItemRow'

interface Props {
  items: TopItem[]
}

export function AnalyticsPopularItems({ items }: Props) {
  const top10 = items.slice(0, 10)

  return (
    <section role="region" aria-labelledby="analytics-popular-items-heading">
      <h2
        id="analytics-popular-items-heading"
        className="mb-3 text-sm font-semibold text-text-primary"
      >
        Popular Items
      </h2>
      {top10.length === 0 ? (
        <div className="rounded-lg border border-border py-8 text-center">
          <p className="text-sm text-text-secondary">No items sold yet in this period</p>
        </div>
      ) : (
        <ul role="list" className="rounded-lg border border-border bg-surface-raised">
          {top10.map((item, index) => {
            const rank = index + 1
            return (
              <li key={`${item.name}-${rank}`}>
                <AnalyticsPopularItemRow rank={rank} item={item} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
