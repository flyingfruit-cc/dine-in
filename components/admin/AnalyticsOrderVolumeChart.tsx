import type { OrdersByDay } from '@/types/app'

interface Props {
  data: OrdersByDay[]
}

const CHART_WIDTH = 320
const CHART_HEIGHT = 240
const BAR_AREA_TOP = 30    // space above bars for value labels
const X_AXIS_HEIGHT = 30   // space below bars for date labels
const BAR_AREA_HEIGHT = CHART_HEIGHT - BAR_AREA_TOP - X_AXIS_HEIGHT
const MIN_BAR_WIDTH = 1

function formatDateLabel(day: string): string {
  const [, month, date] = day.split('-')
  return `${month}/${date}`
}

export function AnalyticsOrderVolumeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-lg border border-border">
        <p className="text-sm text-text-secondary">No orders in this period</p>
      </div>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const totalOrders = data.reduce((sum, d) => sum + d.count, 0)

  const barCount = data.length
  // Scale the gap down for large bar counts so per-bar width stays ≥1px even at 90d.
  // Reserve at least MIN_BAR_WIDTH per bar; whatever remains is distributed as gap.
  const remainingForGaps = Math.max(0, CHART_WIDTH - barCount * MIN_BAR_WIDTH)
  const barGap = barCount <= 1 ? 0 : Math.min(4, remainingForGaps / (barCount - 1))
  const totalGaps = (barCount - 1) * barGap
  const barWidth = Math.max(MIN_BAR_WIDTH, (CHART_WIDTH - totalGaps) / barCount)

  // Show every Nth label to avoid overlap; always show all for ≤14 bars
  const labelStep = barCount <= 14 ? 1 : Math.ceil(barCount / 12)
  const showValueLabels = barCount <= 14

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-text-primary">Order Volume</h2>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full h-60"
        role="img"
        aria-label={`Order volume bar chart: total ${totalOrders} orders across ${data.length} days`}
      >
        <g className="text-accent" fill="currentColor">
          {data.map((d, i) => {
            const barHeight = Math.max((d.count / maxCount) * BAR_AREA_HEIGHT, d.count > 0 ? 2 : 0)
            const x = i * (barWidth + barGap)
            const y = BAR_AREA_TOP + (BAR_AREA_HEIGHT - barHeight)
            const showLabel = i % labelStep === 0
            const label = formatDateLabel(d.day)

            return (
              <g key={d.day}>
                <rect x={x} y={y} width={barWidth} height={barHeight} rx={2}>
                  <title>{`${d.day}: ${d.count} order${d.count !== 1 ? 's' : ''}`}</title>
                </rect>
                {showValueLabels && d.count > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize={9}
                    className="fill-text-secondary"
                    fill="currentColor"
                  >
                    {d.count}
                  </text>
                )}
                {showLabel && (
                  <text
                    x={x + barWidth / 2}
                    y={CHART_HEIGHT - 6}
                    textAnchor="middle"
                    fontSize={9}
                    className="fill-text-secondary"
                    fill="currentColor"
                  >
                    {label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
