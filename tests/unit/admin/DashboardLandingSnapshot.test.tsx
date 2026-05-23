import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { DashboardLandingSnapshot } from '@/components/admin/DashboardLandingSnapshot'
import type { Order } from '@/types/app'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o-1',
    restaurant_id: 'r-1',
    table_id: 't-1',
    items: [{ name: 'Burger', quantity: 1, variants: [], unit_price_cents: 0 }],
    total_cents: 0,
    submitted_at: new Date(Date.now() - 30_000).toISOString(),
    status: 'received',
    is_handled: false,
    handled_at: null,
    ...overrides,
  }
}

afterEach(() => cleanup())

describe('DashboardLandingSnapshot — Today section', () => {
  it('renders the Today region labelled by its heading', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={3}
        todayOrderCount={12}
        todayRevenueCents={28450}
        recentOrders={[]}
        tablesById={{}}
      />,
    )
    // Section uses aria-labelledby pointing at the H2 — accessible name is "Today"
    expect(screen.getByRole('region', { name: 'Today' })).toBeDefined()
  })

  it('renders the stat triplet "3 active · 12 today · $284.50"', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={3}
        todayOrderCount={12}
        todayRevenueCents={28450}
        recentOrders={[]}
        tablesById={{}}
      />,
    )
    const today = screen.getByRole('region', { name: 'Today' })
    expect(today.textContent).toContain('3 active')
    expect(today.textContent).toContain('12 today')
    expect(today.textContent).toContain('$284.50')
  })

  it('formats zero revenue as "$0.00"', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={0}
        todayOrderCount={0}
        todayRevenueCents={0}
        recentOrders={[]}
        tablesById={{}}
      />,
    )
    const today = screen.getByRole('region', { name: 'Today' })
    expect(today.textContent).toContain('0 active')
    expect(today.textContent).toContain('0 today')
    expect(today.textContent).toContain('$0.00')
  })

  it('formats fractional cents via formatPrice (1234 → $12.34)', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={0}
        todayOrderCount={1}
        todayRevenueCents={1234}
        recentOrders={[]}
        tablesById={{}}
      />,
    )
    const today = screen.getByRole('region', { name: 'Today' })
    expect(today.textContent).toContain('$12.34')
  })
})

describe('DashboardLandingSnapshot — Latest Orders section', () => {
  it('renders one OrderCard per row when recentOrders is non-empty', () => {
    const orders = [
      makeOrder({ id: 'o-1', table_id: 't-1' }),
      makeOrder({ id: 'o-2', table_id: 't-2' }),
      makeOrder({ id: 'o-3', table_id: 't-1' }),
    ]
    render(
      <DashboardLandingSnapshot
        activeOrderCount={0}
        todayOrderCount={3}
        todayRevenueCents={0}
        recentOrders={orders}
        tablesById={{ 't-1': 4, 't-2': 7 }}
      />,
    )
    const list = within(screen.getByRole('region', { name: 'Latest orders' })).getByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items.length).toBe(3)
    // table number resolved via tablesById and rendered by OrderCard
    expect(within(list).getAllByText('Table 4').length).toBe(2)
    expect(within(list).getAllByText('Table 7').length).toBe(1)
  })

  it('renders OrderCard with tableNumber=null fallback "Table —" when table_id missing from tablesById', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={0}
        todayOrderCount={1}
        todayRevenueCents={0}
        recentOrders={[makeOrder({ id: 'o-1', table_id: 't-missing' })]}
        tablesById={{}}
      />,
    )
    expect(screen.getByText('Table —')).toBeDefined()
  })

  it('does NOT render an inline status-advance button on rows (snapshot is read-only)', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={1}
        todayOrderCount={1}
        todayRevenueCents={0}
        recentOrders={[makeOrder({ id: 'o-1', status: 'received', table_id: 't-1' })]}
        tablesById={{ 't-1': 1 }}
      />,
    )
    expect(screen.queryByRole('button', { name: /mark preparing/i })).toBeNull()
  })

  it('renders the empty-state copy when recentOrders is empty', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={0}
        todayOrderCount={0}
        todayRevenueCents={0}
        recentOrders={[]}
        tablesById={{}}
      />,
    )
    expect(
      screen.getByText('No orders yet. Your first customer order will show up here on next visit.'),
    ).toBeDefined()
  })

  it('does NOT render the orders <ul> when recentOrders is empty', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={0}
        todayOrderCount={0}
        todayRevenueCents={0}
        recentOrders={[]}
        tablesById={{}}
      />,
    )
    const latest = screen.getByRole('region', { name: 'Latest orders' })
    expect(within(latest).queryByRole('list')).toBeNull()
  })

  it('renders "Go to Orders →" link when Latest Orders is populated', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={0}
        todayOrderCount={1}
        todayRevenueCents={0}
        recentOrders={[makeOrder()]}
        tablesById={{ 't-1': 1 }}
      />,
    )
    // Arrow is aria-hidden, so accessible name is just "Go to Orders"
    const link = screen.getByRole('link', { name: 'Go to Orders' })
    expect(link.getAttribute('href')).toBe('/admin/orders')
  })

  it('renders "Go to Orders →" link when Latest Orders is empty', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={0}
        todayOrderCount={0}
        todayRevenueCents={0}
        recentOrders={[]}
        tablesById={{}}
      />,
    )
    const link = screen.getByRole('link', { name: 'Go to Orders' })
    expect(link.getAttribute('href')).toBe('/admin/orders')
  })
})

describe('DashboardLandingSnapshot — Quick Actions row', () => {
  it('renders the Quick Actions nav landmark', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={0}
        todayOrderCount={0}
        todayRevenueCents={0}
        recentOrders={[]}
        tablesById={{}}
      />,
    )
    expect(screen.getByRole('navigation', { name: 'Quick actions' })).toBeDefined()
  })

  it('renders four quick-action links with correct hrefs', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={0}
        todayOrderCount={0}
        todayRevenueCents={0}
        recentOrders={[]}
        tablesById={{}}
      />,
    )
    const nav = screen.getByRole('navigation', { name: 'Quick actions' })
    const links = within(nav).getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/admin/orders')
    expect(hrefs).toContain('/admin/kds')
    expect(hrefs).toContain('/admin/menu')
    expect(hrefs).toContain('/admin/settings')
    expect(links.length).toBe(4)
  })

  it('KDS link is hidden on mobile via "hidden lg:inline-flex" classes (mirrors AdminNav.desktopOnly)', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={0}
        todayOrderCount={0}
        todayRevenueCents={0}
        recentOrders={[]}
        tablesById={{}}
      />,
    )
    const kds = screen.getByRole('link', { name: /kitchen/i })
    const cls = kds.className
    expect(cls).toContain('hidden')
    expect(cls).toContain('lg:inline-flex')
  })

  it('non-KDS quick-action links do NOT carry the "hidden" mobile-hide class', () => {
    render(
      <DashboardLandingSnapshot
        activeOrderCount={0}
        todayOrderCount={0}
        todayRevenueCents={0}
        recentOrders={[]}
        tablesById={{}}
      />,
    )
    for (const name of [/^orders$/i, /^menu$/i, /^settings$/i]) {
      const link = screen.getByRole('link', { name })
      expect(link.className).not.toContain('hidden')
    }
  })
})
