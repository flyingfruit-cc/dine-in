import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { OrderCard, itemSummary } from '@/components/admin/OrderCard'
import type { Order, OrderItem, OrderStatus } from '@/types/app'

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

function items(...names: string[]): OrderItem[] {
  return names.map((n) => ({ name: n, quantity: 1, variants: [], unit_price_cents: 0 }))
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

  it('aria-label includes table, status, items, and time', () => {
    const order = makeOrder({ items: items('Burger', 'Fries'), status: 'preparing' })
    render(<OrderCard order={order} tableNumber={5} />)
    const card = screen.getByLabelText(/Order for Table 5/)
    const label = card.getAttribute('aria-label') ?? ''
    expect(label).toContain('Order for Table 5')
    expect(label).toContain('preparing')
    expect(label).toContain('Burger, Fries')
    expect(label).toMatch(/just now|m ago|AM|PM/)
  })

  it('received status: bg-accent dot, full opacity row', () => {
    const { container } = render(<OrderCard order={makeOrder({ status: 'received' })} tableNumber={1} />)
    const dot = container.querySelector('span[aria-hidden="true"]')
    expect(dot?.className).toContain('bg-accent')
    expect(dot?.className).not.toContain('opacity-40')
    expect(container.firstElementChild?.className).not.toContain('opacity-40')
  })

  it('preparing status: bg-info dot, full opacity row', () => {
    const { container } = render(<OrderCard order={makeOrder({ status: 'preparing' })} tableNumber={1} />)
    const dot = container.querySelector('span[aria-hidden="true"]')
    expect(dot?.className).toContain('bg-info')
    expect(container.firstElementChild?.className).not.toContain('opacity-40')
  })

  it('ready status: bg-success dot, full opacity row', () => {
    const { container } = render(<OrderCard order={makeOrder({ status: 'ready' })} tableNumber={1} />)
    const dot = container.querySelector('span[aria-hidden="true"]')
    expect(dot?.className).toContain('bg-success')
    expect(container.firstElementChild?.className).not.toContain('opacity-40')
  })

  it('completed status: bg-text-secondary opacity-40 dot, row dims to opacity-40', () => {
    const order = makeOrder({ status: 'completed', is_handled: true, handled_at: new Date().toISOString() })
    const { container } = render(<OrderCard order={order} tableNumber={1} />)
    const dot = container.querySelector('span[aria-hidden="true"]')
    expect(dot?.className).toContain('bg-text-secondary')
    expect(dot?.className).toContain('opacity-40')
    expect(container.firstElementChild?.className).toContain('opacity-40')
  })

  it('shows "No items" and clean aria-label when items array is empty', () => {
    render(<OrderCard order={makeOrder({ items: [] })} tableNumber={2} />)
    expect(screen.getByText('No items')).toBeDefined()
    const card = screen.getByLabelText(/Order for Table 2/)
    expect(card.getAttribute('aria-label')).toContain('No items')
  })

  it('falls back to "Table —" when tableNumber is null', () => {
    render(<OrderCard order={makeOrder()} tableNumber={null} />)
    expect(screen.getByText('Table —')).toBeDefined()
    const card = screen.getByLabelText(/^Order, /)
    expect(card.getAttribute('aria-label')).not.toContain('Table 0')
  })

  describe('action label and onAdvance', () => {
    it('received status shows "Mark preparing" action', () => {
      render(<OrderCard order={makeOrder({ status: 'received' })} tableNumber={1} onAdvance={vi.fn()} />)
      expect(screen.getByRole('button', { name: /mark preparing/i })).toBeDefined()
    })

    it('preparing status shows "Mark ready" action', () => {
      render(<OrderCard order={makeOrder({ status: 'preparing' })} tableNumber={1} onAdvance={vi.fn()} />)
      expect(screen.getByRole('button', { name: /mark ready/i })).toBeDefined()
    })

    it('ready status shows "Mark completed" action', () => {
      render(<OrderCard order={makeOrder({ status: 'ready' })} tableNumber={1} onAdvance={vi.fn()} />)
      expect(screen.getByRole('button', { name: /mark completed/i })).toBeDefined()
    })

    it('completed status shows NO action link (terminal state)', () => {
      const order = makeOrder({ status: 'completed', is_handled: true, handled_at: new Date().toISOString() })
      render(<OrderCard order={order} tableNumber={1} onAdvance={vi.fn()} />)
      expect(screen.queryByRole('button', { name: /mark/i })).toBeNull()
    })

    it('action is hidden when onAdvance is not provided', () => {
      render(<OrderCard order={makeOrder({ status: 'received' })} tableNumber={1} />)
      expect(screen.queryByRole('button', { name: /mark preparing/i })).toBeNull()
    })

    it('tapping "Mark preparing" calls onAdvance with "preparing"', () => {
      const onAdvance = vi.fn()
      render(<OrderCard order={makeOrder({ status: 'received' })} tableNumber={1} onAdvance={onAdvance} />)
      fireEvent.click(screen.getByRole('button', { name: /mark preparing/i }))
      expect(onAdvance).toHaveBeenCalledWith('preparing')
    })

    it('tapping "Mark ready" calls onAdvance with "ready"', () => {
      const onAdvance = vi.fn()
      render(<OrderCard order={makeOrder({ status: 'preparing' })} tableNumber={1} onAdvance={onAdvance} />)
      fireEvent.click(screen.getByRole('button', { name: /mark ready/i }))
      expect(onAdvance).toHaveBeenCalledWith('ready')
    })

    it('tapping "Mark completed" calls onAdvance with "completed"', () => {
      const onAdvance = vi.fn()
      render(<OrderCard order={makeOrder({ status: 'ready' })} tableNumber={1} onAdvance={onAdvance} />)
      fireEvent.click(screen.getByRole('button', { name: /mark completed/i }))
      expect(onAdvance).toHaveBeenCalledWith('completed')
    })

    it('action aria-label includes table label, action, and current status', () => {
      render(<OrderCard order={makeOrder({ status: 'preparing' })} tableNumber={4} onAdvance={vi.fn()} />)
      const btn = screen.getByRole('button', { name: /mark ready/i })
      const label = btn.getAttribute('aria-label') ?? ''
      expect(label).toContain('Table 4')
      expect(label).toContain('preparing')
    })
  })

  describe('errorMessage', () => {
    it('renders errorMessage with role="alert"', () => {
      render(
        <OrderCard
          order={makeOrder({ status: 'received' })}
          tableNumber={1}
          onAdvance={vi.fn()}
          errorMessage="Order state changed — please refresh"
        />,
      )
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('Order state changed — please refresh')
    })

    it('renders no alert when errorMessage is null', () => {
      render(
        <OrderCard order={makeOrder({ status: 'received' })} tableNumber={1} onAdvance={vi.fn()} errorMessage={null} />,
      )
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('tapping action when error is present calls onErrorDismiss before onAdvance', () => {
      const onErrorDismiss = vi.fn()
      const onAdvance = vi.fn()
      render(
        <OrderCard
          order={makeOrder({ status: 'received' })}
          tableNumber={1}
          onAdvance={onAdvance}
          errorMessage="some error"
          onErrorDismiss={onErrorDismiss}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /mark preparing/i }))
      expect(onErrorDismiss).toHaveBeenCalledOnce()
      expect(onAdvance).toHaveBeenCalledWith('preparing')
    })

    it('tapping action without error does NOT call onErrorDismiss', () => {
      const onErrorDismiss = vi.fn()
      render(
        <OrderCard
          order={makeOrder({ status: 'received' })}
          tableNumber={1}
          onAdvance={vi.fn()}
          errorMessage={null}
          onErrorDismiss={onErrorDismiss}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /mark preparing/i }))
      expect(onErrorDismiss).not.toHaveBeenCalled()
    })
  })

  it('tapping the row expand button toggles inline expanded view', () => {
    const order = makeOrder({
      items: [{ name: 'Burger', quantity: 2, variants: ['No pickles'], unit_price_cents: 0 }],
    })
    render(<OrderCard order={order} tableNumber={1} />)
    expect(screen.queryByText(/2× Burger/)).toBeNull()

    fireEvent.click(screen.getByLabelText(/Order for Table 1/))
    expect(screen.getByText(/2× Burger/)).toBeDefined()
    expect(screen.getByText('No pickles')).toBeDefined()

    fireEvent.click(screen.getByLabelText(/Order for Table 1/))
    expect(screen.queryByText(/2× Burger/)).toBeNull()
  })

  it('tapping the action link does not toggle expand', () => {
    render(<OrderCard order={makeOrder({ status: 'received' })} tableNumber={1} onAdvance={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /mark preparing/i }))
    expect(screen.queryByText(/1× Burger/)).toBeNull()
  })

  it('expanded view shows no prices', () => {
    const order = makeOrder({
      items: [{ name: 'Steak', quantity: 1, variants: ['Medium-rare'], unit_price_cents: 0 }],
    })
    render(<OrderCard order={order} tableNumber={1} />)
    fireEvent.click(screen.getByLabelText(/Order for Table 1/))
    expect(screen.queryByText(/\$/)).toBeNull()
    expect(screen.queryByText(/price/i)).toBeNull()
  })
})
