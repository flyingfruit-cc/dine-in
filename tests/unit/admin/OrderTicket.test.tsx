import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
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
    status: 'received',
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

// Fresh mocks per invocation — module-scoped vi.fn() instances accumulate calls
// across tests and silently mask "NOT called" assertions when test order shifts.
function freshDefaults() {
  return {
    isBumping: false,
    onBump: vi.fn(),
    onBumpAnimationEnd: vi.fn(),
    errorMessage: null as string | null,
    onErrorDismiss: vi.fn(),
  }
}

describe('OrderTicket — display', () => {
  it('renders "Table 7" when tableNumber=7', () => {
    const { order, now } = makeNow(1)
    render(<OrderTicket order={order} tableNumber={7} now={now} {...freshDefaults()} />)
    expect(screen.getByText('Table 7')).toBeTruthy()
  })

  it('renders "Table —" when tableNumber=null', () => {
    const { order, now } = makeNow(1)
    render(<OrderTicket order={order} tableNumber={null} now={now} {...freshDefaults()} />)
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
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={new Date()} {...freshDefaults()} />)
    const items = container.querySelectorAll('li')
    expect(items.length).toBe(2)
  })

  it('renders quantity prefix "1×"', () => {
    const order = makeOrder({
      items: [{ name: 'Burger', quantity: 1, variants: [], unit_price_cents: 1500 }],
    })
    render(<OrderTicket order={order} tableNumber={1} now={new Date()} {...freshDefaults()} />)
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
    render(<OrderTicket order={order} tableNumber={1} now={new Date()} {...freshDefaults()} />)
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
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={new Date()} {...freshDefaults()} />)
    expect(container.querySelectorAll('li').length).toBe(5)
  })
})

describe('OrderTicket — bump button', () => {
  it('renders a Bump button', () => {
    const { order, now } = makeNow(1)
    render(<OrderTicket order={order} tableNumber={3} now={now} {...freshDefaults()} />)
    expect(screen.getByRole('button', { name: /bump/i })).toBeTruthy()
  })

  it('bump button has min-h-16 class', () => {
    const { order, now } = makeNow(1)
    const { container } = render(<OrderTicket order={order} tableNumber={3} now={now} {...freshDefaults()} />)
    const btn = container.querySelector('button')
    expect(btn?.className.includes('min-h-16')).toBe(true)
  })

  it('bump button aria-label contains the table number', () => {
    const { order, now } = makeNow(1)
    render(<OrderTicket order={order} tableNumber={5} now={now} {...freshDefaults()} />)
    const btn = screen.getByRole('button', { name: /bump/i })
    expect(btn.getAttribute('aria-label')?.includes('5')).toBe(true)
  })

  it('bump button is enabled when isBumping is false and has type="button"', () => {
    const { order, now } = makeNow(1)
    render(<OrderTicket order={order} tableNumber={2} now={now} {...freshDefaults()} isBumping={false} />)
    const btn = screen.getByRole('button', { name: /bump/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('bump click calls onBump with order.id and table label', () => {
    const onBump = vi.fn()
    const order = makeOrder()
    render(<OrderTicket order={order} tableNumber={7} now={new Date()} {...freshDefaults()} onBump={onBump} />)
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))
    expect(onBump).toHaveBeenCalledWith(order.id, 'Table 7')
  })

  it('bump click calls onBump with table label "Table —" when tableNumber is null', () => {
    const onBump = vi.fn()
    const order = makeOrder()
    render(<OrderTicket order={order} tableNumber={null} now={new Date()} {...freshDefaults()} onBump={onBump} />)
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))
    expect(onBump).toHaveBeenCalledWith(order.id, 'Table —')
  })

  it('bump button is disabled when isBumping is true', () => {
    const onBump = vi.fn()
    const { order, now } = makeNow(1)
    render(<OrderTicket order={order} tableNumber={3} now={now} {...freshDefaults()} isBumping={true} onBump={onBump} />)
    const btn = screen.getByRole('button', { name: /bump/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onBump).not.toHaveBeenCalled()
  })

  it('article gets animate-out and slide-out-to-right classes when isBumping is true', () => {
    const { order, now } = makeNow(1)
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={now} {...freshDefaults()} isBumping={true} />)
    const article = container.querySelector('article')
    expect(article?.className.includes('animate-out')).toBe(true)
    expect(article?.className.includes('slide-out-to-right')).toBe(true)
    expect(article?.className.includes('duration-200')).toBe(true)
    expect(article?.className.includes('fill-mode-forwards')).toBe(true)
    expect(article?.className.includes('motion-reduce:animate-none')).toBe(true)
  })

  it('article does NOT have animate-out classes when isBumping is false', () => {
    const { order, now } = makeNow(1)
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={now} {...freshDefaults()} isBumping={false} />)
    const article = container.querySelector('article')
    expect(article?.className.includes('animate-out')).toBe(false)
  })

  it('onAnimationEnd fires onBumpAnimationEnd when isBumping is true', () => {
    const onBumpAnimationEnd = vi.fn()
    const order = makeOrder()
    const { container } = render(
      <OrderTicket order={order} tableNumber={1} now={new Date()} {...freshDefaults()} isBumping={true} onBumpAnimationEnd={onBumpAnimationEnd} />
    )
    fireEvent.animationEnd(container.querySelector('article')!)
    expect(onBumpAnimationEnd).toHaveBeenCalledWith(order.id)
  })

  it('onAnimationEnd does NOT fire onBumpAnimationEnd when isBumping is false', () => {
    const onBumpAnimationEnd = vi.fn()
    const order = makeOrder()
    const { container } = render(
      <OrderTicket order={order} tableNumber={1} now={new Date()} {...freshDefaults()} isBumping={false} onBumpAnimationEnd={onBumpAnimationEnd} />
    )
    fireEvent.animationEnd(container.querySelector('article')!)
    expect(onBumpAnimationEnd).not.toHaveBeenCalled()
  })

  it('inline error renders when errorMessage prop is set', () => {
    const { order, now } = makeNow(1)
    render(
      <OrderTicket order={order} tableNumber={1} now={now} {...freshDefaults()} errorMessage="Tap to retry — bump didn't send" />
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent?.includes("bump didn't send")).toBe(true)
  })

  it('no error renders when errorMessage prop is null', () => {
    const { order, now } = makeNow(1)
    render(<OrderTicket order={order} tableNumber={1} now={now} {...freshDefaults()} errorMessage={null} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('clicking bump after an error calls onErrorDismiss before onBump', () => {
    const onErrorDismiss = vi.fn()
    const onBump = vi.fn()
    const order = makeOrder()
    render(
      <OrderTicket
        order={order}
        tableNumber={1}
        now={new Date()}
        {...freshDefaults()}
        errorMessage="some error"
        onErrorDismiss={onErrorDismiss}
        onBump={onBump}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))
    expect(onErrorDismiss).toHaveBeenCalledOnce()
    expect(onBump).toHaveBeenCalledOnce()
  })

  it('clicking bump without an error does NOT call onErrorDismiss', () => {
    const onErrorDismiss = vi.fn()
    const order = makeOrder()
    render(
      <OrderTicket order={order} tableNumber={1} now={new Date()} {...freshDefaults()} errorMessage={null} onErrorDismiss={onErrorDismiss} />
    )
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))
    expect(onErrorDismiss).not.toHaveBeenCalled()
  })
})

describe('OrderTicket — elapsed time thresholds', () => {
  it('5 min: no animate-pulse, border-border', () => {
    const { order, now } = makeNow(5)
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={now} {...freshDefaults()} />)
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
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={now} {...freshDefaults()} />)
    const article = container.querySelector('article')
    expect(article?.className.includes('border-warning')).toBe(true)
    const timeSpan = container.querySelector('header span:last-child')
    expect(timeSpan?.className.includes('animate-pulse')).toBe(true)
  })

  it('14 min: border-warning, still pulsing', () => {
    const { order, now } = makeNow(14)
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={now} {...freshDefaults()} />)
    const article = container.querySelector('article')
    expect(article?.className.includes('border-warning')).toBe(true)
    const timeSpan = container.querySelector('header span:last-child')
    expect(timeSpan?.className.includes('animate-pulse')).toBe(true)
  })

  it('15 min: border-error, still pulsing', () => {
    const { order, now } = makeNow(15)
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={now} {...freshDefaults()} />)
    const article = container.querySelector('article')
    expect(article?.className.includes('border-error')).toBe(true)
    const timeSpan = container.querySelector('header span:last-child')
    expect(timeSpan?.className.includes('animate-pulse')).toBe(true)
  })

  it('20 min: border-error, still pulsing', () => {
    const { order, now } = makeNow(20)
    const { container } = render(<OrderTicket order={order} tableNumber={1} now={now} {...freshDefaults()} />)
    const article = container.querySelector('article')
    expect(article?.className.includes('border-error')).toBe(true)
    const timeSpan = container.querySelector('header span:last-child')
    expect(timeSpan?.className.includes('animate-pulse')).toBe(true)
  })
})
