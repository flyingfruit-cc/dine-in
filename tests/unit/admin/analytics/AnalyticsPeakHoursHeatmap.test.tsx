import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AnalyticsPeakHoursHeatmap } from '@/components/admin/AnalyticsPeakHoursHeatmap'
import type { OrdersByDowHour } from '@/types/app'

describe('AnalyticsPeakHoursHeatmap', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders 7×24 = 168 gridcells even for sparse data', () => {
    const data: OrdersByDowHour[] = [
      { dow: 1, hour: 12, count: 5 },
      { dow: 3, hour: 18, count: 3 },
      { dow: 5, hour: 8, count: 10 },
    ]
    const { container } = render(<AnalyticsPeakHoursHeatmap data={data} />)
    const cells = container.querySelectorAll('[role="gridcell"]')
    expect(cells).toHaveLength(168)
  })

  it('container has role="grid" with aria-label', () => {
    const { container } = render(<AnalyticsPeakHoursHeatmap data={[]} />)
    const grid = container.querySelector('[role="grid"]')
    expect(grid).not.toBeNull()
    expect(grid?.getAttribute('aria-label')).toContain('UTC')
  })

  it('zero-count cells get bg-surface-overlay class', () => {
    const data: OrdersByDowHour[] = [{ dow: 0, hour: 0, count: 5 }]
    const { container } = render(<AnalyticsPeakHoursHeatmap data={data} />)
    const zeroCells = container.querySelectorAll('[role="gridcell"].bg-surface-overlay')
    // 168 total - 1 non-zero = 167 zero cells
    expect(zeroCells.length).toBe(167)
  })

  it('zero cells have aria-label "No orders..."', () => {
    const data: OrdersByDowHour[] = []
    const { container } = render(<AnalyticsPeakHoursHeatmap data={data} />)
    const firstCell = container.querySelector('[role="gridcell"][aria-label^="No orders"]')
    expect(firstCell).not.toBeNull()
  })

  it('non-zero cells have aria-label with count (queryable via getByRole)', () => {
    const data: OrdersByDowHour[] = [{ dow: 2, hour: 14, count: 8 }]
    render(<AnalyticsPeakHoursHeatmap data={data} />)
    const cell = screen.getByRole('gridcell', { name: '8 orders on Tue at 14:00 UTC' })
    expect(cell).toBeTruthy()
  })

  it('zero-count cell uses "No orders" label for Sun 00:00', () => {
    render(<AnalyticsPeakHoursHeatmap data={[]} />)
    const cell = screen.getByRole('gridcell', { name: 'No orders on Sun at 00:00 UTC' })
    expect(cell).toBeTruthy()
  })

  it('max-count cell uses bg-accent/100 from static lookup', () => {
    const data: OrdersByDowHour[] = [{ dow: 0, hour: 0, count: 10 }]
    const { container } = render(<AnalyticsPeakHoursHeatmap data={data} />)
    const maxCell = container.querySelector('.bg-accent\\/100')
    expect(maxCell).not.toBeNull()
  })

  it('low-count cell maps to bg-accent/10 (1 of maxCount 10)', () => {
    const data: OrdersByDowHour[] = [
      { dow: 0, hour: 0, count: 10 }, // sets maxCount = 10
      { dow: 1, hour: 1, count: 1 },  // 1/10 = 0.1 → round(1) → bg-accent/10
    ]
    const { container } = render(<AnalyticsPeakHoursHeatmap data={data} />)
    const lowCell = container.querySelector('.bg-accent\\/10')
    expect(lowCell).not.toBeNull()
  })

  it('column headers render hour with :00 suffix (e.g. "00:00", "23:00")', () => {
    render(<AnalyticsPeakHoursHeatmap data={[]} />)
    expect(screen.getByText('00:00')).toBeTruthy()
    expect(screen.getByText('23:00')).toBeTruthy()
  })

  it('row headers render day names (rowheader role)', () => {
    render(<AnalyticsPeakHoursHeatmap data={[]} />)
    const dayHeaders = screen.getAllByRole('rowheader')
    expect(dayHeaders.map((h) => h.textContent?.trim())).toEqual([
      'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
    ])
  })

  it('shows UTC footnote', () => {
    render(<AnalyticsPeakHoursHeatmap data={[]} />)
    expect(screen.getByText('All times shown in UTC')).toBeTruthy()
  })
})
