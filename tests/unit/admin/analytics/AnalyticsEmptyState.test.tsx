import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AnalyticsEmptyState } from '@/components/admin/AnalyticsEmptyState'

describe('AnalyticsEmptyState', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders correct heading copy', () => {
    render(<AnalyticsEmptyState orderCount={5} />)
    const heading = screen.getByRole('heading')
    expect(heading.textContent).toMatch(/Not enough data yet — keep serving!/i)
  })

  it('shows count-specific message when orderCount > 0', () => {
    render(<AnalyticsEmptyState orderCount={12} />)
    const body = screen.getByText(/12 order/)
    expect(body).toBeTruthy()
    expect(body.textContent).toContain('≥30')
  })

  it('shows generic message when orderCount is 0', () => {
    render(<AnalyticsEmptyState orderCount={0} />)
    expect(screen.getByText('Come back when you have ≥30 orders')).toBeTruthy()
  })
})
