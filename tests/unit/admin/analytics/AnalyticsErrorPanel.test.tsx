import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AnalyticsErrorPanel } from '@/components/admin/AnalyticsErrorPanel'

describe('AnalyticsErrorPanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders correct heading copy', () => {
    render(<AnalyticsErrorPanel />)
    const heading = screen.getByRole('heading')
    expect(heading.textContent).toMatch(/Analytics temporarily unavailable/i)
  })

  it('renders refresh instruction', () => {
    render(<AnalyticsErrorPanel />)
    expect(screen.getByText(/Please refresh in a moment/i)).toBeTruthy()
  })
})
