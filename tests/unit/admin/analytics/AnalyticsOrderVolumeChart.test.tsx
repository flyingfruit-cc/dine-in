import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AnalyticsOrderVolumeChart } from '@/components/admin/AnalyticsOrderVolumeChart'
import type { OrdersByDay } from '@/types/app'

function makeDay(day: string, count: number): OrdersByDay {
  return { day, count, revenueCents: count * 1000 }
}

describe('AnalyticsOrderVolumeChart', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders one <rect> per data point', () => {
    const data = [makeDay('2026-05-01', 3), makeDay('2026-05-02', 7), makeDay('2026-05-03', 2)]
    const { container } = render(<AnalyticsOrderVolumeChart data={data} />)
    const rects = container.querySelectorAll('rect')
    expect(rects).toHaveLength(3)
  })

  it('aria-label on svg mentions total order count', () => {
    const data = [makeDay('2026-05-01', 5), makeDay('2026-05-02', 10)]
    const { container } = render(<AnalyticsOrderVolumeChart data={data} />)
    const svg = container.querySelector('svg[role="img"]')
    expect(svg?.getAttribute('aria-label')).toContain('15 orders')
  })

  it('single-bar dataset: maxCount=1 does not divide by zero', () => {
    const data = [makeDay('2026-05-01', 1)]
    const { container } = render(<AnalyticsOrderVolumeChart data={data} />)
    const rect = container.querySelector('rect')
    expect(rect).not.toBeNull()
    const height = parseFloat(rect!.getAttribute('height') ?? '0')
    expect(height).toBeGreaterThan(0)
  })

  it('empty data renders fallback message without crashing', () => {
    render(<AnalyticsOrderVolumeChart data={[]} />)
    expect(screen.getByText('No orders in this period')).toBeTruthy()
  })

  it('each bar has a <title> with the count', () => {
    const data = [makeDay('2026-06-01', 4)]
    const { container } = render(<AnalyticsOrderVolumeChart data={data} />)
    const title = container.querySelector('rect title')
    expect(title?.textContent).toContain('4 order')
  })

  it('90-day dataset: all bars have non-negative width (regression P1 — bars must not overlap)', () => {
    // 90 buckets x 4px gap would be 356px > 320 viewBox → naive math gives negative width
    const data = Array.from({ length: 90 }, (_, i) =>
      makeDay(`2026-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`, i),
    )
    const { container } = render(<AnalyticsOrderVolumeChart data={data} />)
    const rects = container.querySelectorAll('rect')
    expect(rects).toHaveLength(90)
    rects.forEach((rect) => {
      const width = parseFloat(rect.getAttribute('width') ?? '0')
      expect(width).toBeGreaterThanOrEqual(1)
    })
  })
})
