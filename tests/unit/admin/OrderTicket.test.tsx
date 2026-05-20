import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OrderTicket } from '@/components/admin/OrderTicket'
import type { Order } from '@/types/app'

afterEach(cleanup)

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    restaurant_id: 'rest-1',
    table_id: 'table-uuid-1',
    items: [],
    submitted_at: new Date(Date.now() - 60_000).toISOString(),
    is_handled: false,
    handled_at: null,
    total_cents: 0,
    ...overrides,
  }
}

function makeNow(minutesAgo: number): { order: Order; now: Date } {
  const submittedAt = new Date(Date.now() - minutesAgo * 60_000)
  return {
    order: makeOrder({ submitted_at: submittedAt.toISOString() }),
    now: new Date(),
  }
}

describe('OrderTicket — display', () => {
  it('renders "Table 7" when tableNumber=7', () => {
    const { order, now } = makeNow(1)
    render(<OrderTicket order={order} tableNumber={7} now={now} />)
    expect(screen.getByText('Table 7')).toBeTruthy()
  })

  it('renders "Table —" when tableNumber=null', () => {
    const { order, now } = makeNow(1)
    render(<OrderTicket order={order} tableNumber={null} now={now} />)
    expect(screen.getByText('Table —')).toBeTruthy()
  })
})

describe('OrderTicket — item list', () => {
  it('renders one <li> per item', () => {
    const order = makeOrder({
      items: [
        { name: 'Burger', quantity: 1, variants: [], unit_price_cents: 1500 },
        { name: 'Fries', quantity: 2, variants: [], unit_price_cents: 500 },
      ],
    })
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={new Date()} />)
    const items = container.querySelectorAll('li')
    expect(items.length).toBe(2)
  })

  it('renders quantity prefix "1×"', () => {
    const order = makeOrder({
      items: [{ name: 'Burger', quantity: 1, variants: [], unit_price_cents: 1500 }],
    })
    render(<OrderTicket order={order} tableNumber={1} now={new Date()} />)
    expect(screen.getByText('1×')).toBeTruthy()
  })

  it('joins variants with ", "', () => {
    const order = makeOrder({
      items: [
        {
          name: 'Burger',
          quantity: 1,
          variants: ['no cheese', 'well done'],
          unit_price_cents: 1500,
        },
      ],
    })
    render(<OrderTicket order={order} tableNumber={1} now={new Date()} />)
    expect(screen.getByText('no cheese, well done')).toBeTruthy()
  })

  it('shows all items without truncation', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      name: `Item ${i}`,
      quantity: 1,
      variants: [],
      unit_price_cents: 100,
    }))
    const order = makeOrder({ items })
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={new Date()} />)
    expect(container.querySelectorAll('li').length).toBe(5)
  })
})

describe('OrderTicket — bump button', () => {
  it('renders a Bump button', () => {
    const { order, now } = makeNow(1)
    render(<OrderTicket order={order} tableNumber={3} now={now} />)
    expect(screen.getByRole('button', { name: /bump/i })).toBeTruthy()
  })

  it('bump button has min-h-16 class', () => {
    const { order, now } = makeNow(1)
    const { container } = render(<OrderTicket order={order} tableNumber={3} now={now} />)
    const btn = container.querySelector('button')
    expect(btn?.className.includes('min-h-16')).toBe(true)
  })

  it('bump button aria-label contains the table number', () => {
    const { order, now } = makeNow(1)
    render(<OrderTicket order={order} tableNumber={5} now={now} />)
    const btn = screen.getByRole('button', { name: /bump/i })
    expect(btn.getAttribute('aria-label')?.includes('5')).toBe(true)
  })

  it('bump button is enabled and has type="button" (Story 8.2 ships no-op; Story 8.3 wires the handler)', () => {
    const { order, now } = makeNow(1)
    render(<OrderTicket order={order} tableNumber={2} now={now} />)
    const btn = screen.getByRole('button', { name: /bump/i }) as HTMLButtonElement
    // Per AC #1: button must be enabled so the structural / accessibility ACs are testable now.
    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute('type')).toBe('button')
  })
})

describe('OrderTicket — elapsed time thresholds', () => {
  it('5 min: no animate-pulse, border-border', () => {
    const { order, now } = makeNow(5)
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={now} />)
    const article = container.querySelector('article')
    expect(article?.className.includes('border-border')).toBe(true)
    expect(article?.className.includes('border-warning')).toBe(false)
    expect(article?.className.includes('border-error')).toBe(false)
    // No animate-pulse on time span
    const timeSpan = container.querySelector('header span:last-child')
    expect(timeSpan?.className.includes('animate-pulse')).toBe(false)
  })

  it('10 min: animate-pulse on time, border-warning on article', () => {
    const { order, now } = makeNow(10)
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={now} />)
    const article = container.querySelector('article')
    expect(article?.className.includes('border-warning')).toBe(true)
    const timeSpan = container.querySelector('header span:last-child')
    expect(timeSpan?.className.includes('animate-pulse')).toBe(true)
  })

  it('14 min: border-warning, still pulsing', () => {
    const { order, now } = makeNow(14)
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={now} />)
    const article = container.querySelector('article')
    expect(article?.className.includes('border-warning')).toBe(true)
    const timeSpan = container.querySelector('header span:last-child')
    expect(timeSpan?.className.includes('animate-pulse')).toBe(true)
  })

  it('15 min: border-error, still pulsing', () => {
    const { order, now } = makeNow(15)
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={now} />)
    const article = container.querySelector('article')
    expect(article?.className.includes('border-error')).toBe(true)
    const timeSpan = container.querySelector('header span:last-child')
    expect(timeSpan?.className.includes('animate-pulse')).toBe(true)
  })

  it('20 min: border-error, still pulsing', () => {
    const { order, now } = makeNow(20)
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={now} />)
    const article = container.querySelector('article')
    expect(article?.className.includes('border-error')).toBe(true)
    const timeSpan = container.querySelector('header span:last-child')
    expect(timeSpan?.className.includes('animate-pulse')).toBe(true)
  })
})
