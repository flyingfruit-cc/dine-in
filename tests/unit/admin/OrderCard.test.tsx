import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OrderCard, itemSummary } from '@/components/admin/OrderCard'
import type { Order, OrderItem } from '@/types/app'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o-1',
    restaurant_id: 'r-1',
    table_id: 't-1',
    items: [{ name: 'Burger', quantity: 1, variants: [] }],
    submitted_at: new Date(Date.now() - 30_000).toISOString(),
    is_handled: false,
    handled_at: null,
    ...overrides,
  }
}

function items(...names: string[]): OrderItem[] {
  return names.map((n) => ({ name: n, quantity: 1, variants: [] }))
}

afterEach(() => cleanup())

describe('itemSummary', () => {
  it('returns empty string for no items', () => {
    expect(itemSummary([])).toBe('')
  })

  it('returns "A" for one item', () => {
    expect(itemSummary(items('Burger'))).toBe('Burger')
  })

  it('returns "A, B" for two items', () => {
    expect(itemSummary(items('Burger', 'Fries'))).toBe('Burger, Fries')
  })

  it('returns "A, B +N more" for >2 items', () => {
    expect(itemSummary(items('Burger', 'Fries', 'Coke'))).toBe('Burger, Fries +1 more')
    expect(itemSummary(items('A', 'B', 'C', 'D', 'E'))).toBe('A, B +3 more')
  })
})

describe('OrderCard', () => {
  it('renders bold table number', () => {
    render(<OrderCard order={makeOrder()} tableNumber={3} />)
    expect(screen.getByText('Table 3')).toBeDefined()
  })

  it('renders item summary with first 2 + truncation', () => {
    render(
      <OrderCard
        order={makeOrder({ items: items('Burger', 'Fries', 'Coke', 'Salad') })}
        tableNumber={1}
      />,
    )
    expect(screen.getByText(/Burger, Fries \+2 more/)).toBeDefined()
  })

  it('aria-label includes table, items, and time', () => {
    const order = makeOrder({ items: items('Burger', 'Fries') })
    render(<OrderCard order={order} tableNumber={5} />)
    const card = screen.getByLabelText(/Order for Table 5/)
    const label = card.getAttribute('aria-label') ?? ''
    expect(label).toContain('Order for Table 5')
    expect(label).toContain('Burger, Fries')
    expect(label).toMatch(/just now|m ago|AM|PM/)
  })

  it('renders the active orange dot when not handled', () => {
    const { container } = render(<OrderCard order={makeOrder()} tableNumber={1} />)
    const dot = container.querySelector('span[aria-hidden="true"]')
    expect(dot?.className).toContain('bg-accent')
    expect(dot?.className).not.toContain('opacity-40')
  })

  it('renders the muted handled dot when handled', () => {
    const order = makeOrder({ is_handled: true, handled_at: new Date().toISOString() })
    const { container } = render(<OrderCard order={order} tableNumber={1} />)
    const dot = container.querySelector('span[aria-hidden="true"]')
    expect(dot?.className).toContain('bg-text-secondary')
    expect(dot?.className).toContain('opacity-40')
  })

  it('shows "No items" and clean aria-label when items array is empty', () => {
    render(<OrderCard order={makeOrder({ items: [] })} tableNumber={2} />)
    expect(screen.getByText('No items')).toBeDefined()
    const card = screen.getByLabelText(/Order for Table 2, No items/)
    expect(card).toBeDefined()
  })

  it('falls back to "Table —" when tableNumber is null', () => {
    render(<OrderCard order={makeOrder()} tableNumber={null} />)
    expect(screen.getByText('Table —')).toBeDefined()
    const card = screen.getByLabelText(/^Order, /)
    expect(card.getAttribute('aria-label')).not.toContain('Table 0')
  })
})
