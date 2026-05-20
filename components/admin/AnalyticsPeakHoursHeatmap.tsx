import { Fragment } from 'react'
import type { OrdersByDowHour } from '@/types/app'

// MUST be a static literal array — Tailwind purger cannot see dynamically interpolated class strings
const HEATMAP_OPACITY_CLASSES = [
  'bg-accent/0',   // index 0 — not used directly (zero count → bg-surface-overlay)
  'bg-accent/10',
  'bg-accent/20',
  'bg-accent/30',
  'bg-accent/40',
  'bg-accent/50',
  'bg-accent/60',
  'bg-accent/70',
  'bg-accent/80',
  'bg-accent/90',
  'bg-accent/100',
] as const

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface Props {
  data: OrdersByDowHour[]
}

export function AnalyticsPeakHoursHeatmap({ data }: Props) {
  // Build lookup: "${dow}-${hour}" → count
  const lookup = new Map<string, number>()
  for (const { dow, hour, count } of data) {
    lookup.set(`${dow}-${hour}`, count)
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-text-primary">Peak Hours</h2>
      <div className="overflow-x-auto">
        <div
          role="grid"
          aria-label="Order volume by day of week and hour, UTC"
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `3rem repeat(24, minmax(12px, 1fr))` }}
        >
          {/* Header row: empty corner + hour labels */}
          <div role="row" className="contents">
            <div role="columnheader" aria-hidden="true" />
            {HOURS.map((h) => (
              <div
                key={h}
                role="columnheader"
                className="text-center text-[9px] font-medium text-text-secondary"
              >
                {`${String(h).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Data rows: day label + 24 cells */}
          {DAY_NAMES.map((dayName, dow) => (
            <Fragment key={dow}>
              <div role="row" className="contents">
                <div
                  role="rowheader"
                  className="flex items-center text-[10px] font-medium text-text-secondary pr-1"
                >
                  {dayName}
                </div>
                {HOURS.map((hour) => {
                  const count = lookup.get(`${dow}-${hour}`) ?? 0
                  const opacityIndex =
                    count === 0 ? 0 : Math.max(1, Math.round((count / maxCount) * 10))
                  const isZero = count === 0
                  const cellClass = isZero
                    ? 'bg-surface-overlay'
                    : HEATMAP_OPACITY_CLASSES[opacityIndex]
                  const ariaLabel = isZero
                    ? `No orders on ${dayName} at ${String(hour).padStart(2, '0')}:00 UTC`
                    : `${count} order${count !== 1 ? 's' : ''} on ${dayName} at ${String(hour).padStart(2, '0')}:00 UTC`

                  return (
                    <div
                      key={`${dow}-${hour}`}
                      role="gridcell"
                      className={`min-h-3 min-w-3 rounded-sm sm:min-h-4 sm:min-w-4 ${cellClass}`}
                      aria-label={ariaLabel}
                      style={{ aspectRatio: '1' }}
                    />
                  )
                })}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-text-secondary">All times shown in UTC</p>
    </div>
  )
}
