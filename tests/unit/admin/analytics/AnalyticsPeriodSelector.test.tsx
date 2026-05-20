import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AnalyticsPeriodSelector } from '@/components/admin/AnalyticsPeriodSelector'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

describe('AnalyticsPeriodSelector', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all four period buttons', () => {
    render(<AnalyticsPeriodSelector currentPeriod="7d" />)
    expect(screen.getByRole('tab', { name: 'Today' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '7 days' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '30 days' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '90 days' })).toBeTruthy()
  })

  it('active period button has aria-selected="true"', () => {
    render(<AnalyticsPeriodSelector currentPeriod="30d" />)
    const thirtyDay = screen.getByRole('tab', { name: '30 days' })
    expect(thirtyDay.getAttribute('aria-selected')).toBe('true')
  })

  it('inactive period buttons have aria-selected="false"', () => {
    render(<AnalyticsPeriodSelector currentPeriod="7d" />)
    const today = screen.getByRole('tab', { name: 'Today' })
    expect(today.getAttribute('aria-selected')).toBe('false')
  })

  it('clicking inactive period calls router.push with correct URL', () => {
    render(<AnalyticsPeriodSelector currentPeriod="7d" />)
    fireEvent.click(screen.getByRole('tab', { name: '30 days' }))
    expect(mockPush).toHaveBeenCalledWith('/admin/analytics?period=30d')
  })

  it('clicking "Today" calls router.push with period=today', () => {
    render(<AnalyticsPeriodSelector currentPeriod="7d" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Today' }))
    expect(mockPush).toHaveBeenCalledWith('/admin/analytics?period=today')
  })

  it('container has role="tablist"', () => {
    render(<AnalyticsPeriodSelector currentPeriod="7d" />)
    expect(screen.getAllByRole('tablist').length).toBeGreaterThanOrEqual(1)
  })
})
