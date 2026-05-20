import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AnalyticsRevenueSummary } from '@/components/admin/AnalyticsRevenueSummary'

afterEach(() => cleanup())

describe('AnalyticsRevenueSummary', () => {
  it('renders all three KPI labels', () => {
    render(
      <AnalyticsRevenueSummary
        totalRevenueCents={0}
        averageOrderValueCents={0}
        orderCount={0}
      />,
    )
    expect(screen.getByText('Total Revenue')).toBeTruthy()
    expect(screen.getByText('Average Order')).toBeTruthy()
    expect(screen.getByText('Orders')).toBeTruthy()
  })

  it('formats currency via formatPrice — no NaN or undefined for zeros', () => {
    render(
      <AnalyticsRevenueSummary
        totalRevenueCents={0}
        averageOrderValueCents={0}
        orderCount={0}
      />,
    )
    const values = screen.getAllByText('$0.00')
    expect(values.length).toBe(2)
    expect(screen.getByText('0')).toBeTruthy()
  })

  it('renders correct formatted values for non-zero data', () => {
    render(
      <AnalyticsRevenueSummary
        totalRevenueCents={150000}
        averageOrderValueCents={2500}
        orderCount={60}
      />,
    )
    expect(screen.getByText('$1500.00')).toBeTruthy()
    expect(screen.getByText('$25.00')).toBeTruthy()
    expect(screen.getByText('60')).toBeTruthy()
  })

  it('renders large order count with locale thousand separator', () => {
    render(
      <AnalyticsRevenueSummary
        totalRevenueCents={0}
        averageOrderValueCents={0}
        orderCount={1500}
      />,
    )
    // toLocaleString with no args produces "1,500" in en-US environments
    // — check the value contains '1' and '500' separated by some grouping char
    const ordersEl = screen.getByLabelText(/^Orders:/)
    expect(ordersEl.textContent).toMatch(/1[,.]?500/)
  })

  it('has accessible group role and aria-label on the container', () => {
    const { container } = render(
      <AnalyticsRevenueSummary
        totalRevenueCents={0}
        averageOrderValueCents={0}
        orderCount={0}
      />,
    )
    const group = container.querySelector('[role="group"]')
    expect(group).toBeTruthy()
    expect(group?.getAttribute('aria-label')).toBe('Revenue summary')
  })

  it('each KPI value has an aria-label with its label and value', () => {
    render(
      <AnalyticsRevenueSummary
        totalRevenueCents={5000}
        averageOrderValueCents={1000}
        orderCount={5}
      />,
    )
    expect(screen.getByLabelText('Total Revenue: $50.00')).toBeTruthy()
    expect(screen.getByLabelText('Average Order: $10.00')).toBeTruthy()
    expect(screen.getByLabelText('Orders: 5')).toBeTruthy()
  })
})
