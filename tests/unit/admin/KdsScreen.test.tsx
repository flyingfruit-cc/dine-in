import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { KdsScreen } from '@/components/admin/KdsScreen'
import type { Order } from '@/types/app'

const useOrderStoreMock = vi.fn()

vi.mock('@/stores/orderStore', () => ({
  useOrderStore: (selector: (s: { orders: Order[] }) => unknown) =>
    useOrderStoreMock(selector),
}))

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-' + Math.random().toString(36).slice(2),
    restaurant_id: 'rest-1',
    table_id: 'table-uuid-' + Math.random().toString(36).slice(2),
    items: [],
    submitted_at: new Date(Date.now() - 60_000).toISOString(),
    is_handled: false,
    handled_at: null,
    total_cents: 0,
    ...overrides,
  }
}

describe('KdsScreen', () => {
  beforeEach(() => {
    useOrderStoreMock.mockReset()
    delete (globalThis.navigator as unknown as { wakeLock?: unknown }).wakeLock
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders empty-state when no active orders', () => {
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [] }))
    render(<KdsScreen tablesById={{}} />)
    expect(screen.getByText('Waiting for orders')).toBeTruthy()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('renders one card per active order', () => {
    const orders = [makeOrder(), makeOrder(), makeOrder()]
    useOrderStoreMock.mockImplementation((selector) => selector({ orders }))
    render(<KdsScreen tablesById={{}} />)
    const articles = screen.getAllByRole('article')
    expect(articles.length).toBe(3)
    expect(screen.queryByText('Waiting for orders')).toBeNull()
  })

  it('header counter reads "1 order" (singular) for one active order', () => {
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [makeOrder()] }))
    render(<KdsScreen tablesById={{}} />)
    expect(screen.getByText('1 order')).toBeTruthy()
  })

  it('header counter reads "3 orders" (plural) for multiple active orders', () => {
    useOrderStoreMock.mockImplementation((selector) =>
      selector({ orders: [makeOrder(), makeOrder(), makeOrder()] }),
    )
    render(<KdsScreen tablesById={{}} />)
    expect(screen.getByText('3 orders')).toBeTruthy()
  })

  it('filters out handled orders', () => {
    const active = makeOrder({ is_handled: false })
    const handled = makeOrder({ is_handled: true, handled_at: new Date().toISOString() })
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [active, handled] }))
    render(<KdsScreen tablesById={{}} />)
    expect(screen.getAllByRole('article').length).toBe(1)
    expect(screen.getByText('1 order')).toBeTruthy()
  })

  it('renders heading "Kitchen"', () => {
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [] }))
    render(<KdsScreen tablesById={{}} />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Kitchen')
  })

  it('requests screen wake lock on mount when supported', async () => {
    const request = vi.fn().mockResolvedValue({
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    })
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
    })
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [] }))
    await act(async () => {
      render(<KdsScreen tablesById={{}} />)
    })
    expect(request).toHaveBeenCalledWith('screen')
  })

  it('does not throw when wake lock is unsupported (no navigator.wakeLock)', () => {
    // wakeLock deleted in beforeEach
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [] }))
    expect(() => render(<KdsScreen tablesById={{}} />)).not.toThrow()
  })

  it('releases wake lock sentinel on unmount', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ release, addEventListener: vi.fn() })
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
    })
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [] }))
    let unmount: () => void = () => {}
    await act(async () => {
      const result = render(<KdsScreen tablesById={{}} />)
      unmount = result.unmount
    })
    await act(async () => {
      unmount()
    })
    expect(release).toHaveBeenCalled()
  })

  it('does not double-acquire when visibilitychange fires while sentinel is held', async () => {
    const request = vi.fn().mockResolvedValue({
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    })
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
    })
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [] }))
    await act(async () => {
      render(<KdsScreen tablesById={{}} />)
    })
    expect(request).toHaveBeenCalledTimes(1)
    // Tab stays visible, fire visibilitychange anyway — should NOT acquire a second sentinel
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('re-acquires wake lock after browser auto-releases sentinel', async () => {
    const releaseListeners: Array<() => void> = []
    const request = vi.fn().mockImplementation(() =>
      Promise.resolve({
        release: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn((event: string, cb: () => void) => {
          if (event === 'release') releaseListeners.push(cb)
        }),
      }),
    )
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
    })
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [] }))
    await act(async () => {
      render(<KdsScreen tablesById={{}} />)
    })
    expect(request).toHaveBeenCalledTimes(1)
    // Simulate browser auto-release (e.g., low battery)
    await act(async () => {
      releaseListeners.forEach((cb) => cb())
    })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('sorts orders ASC by submitted_at then by id (tie-break)', () => {
    const tieTime = new Date('2026-05-20T10:00:00.000Z').toISOString()
    const earlier = makeOrder({ id: 'aaa-order', submitted_at: new Date('2026-05-20T09:59:00.000Z').toISOString() })
    const tieFirst = makeOrder({ id: 'bbb-order', submitted_at: tieTime })
    const tieSecond = makeOrder({ id: 'ccc-order', submitted_at: tieTime })
    // Map each order's table_id to a distinct, recognizable number so the
    // rendered DOM order can be asserted via the visible "Table N" text.
    const tablesById = {
      [earlier.table_id]: 1,
      [tieFirst.table_id]: 2,
      [tieSecond.table_id]: 3,
    }
    // Provide in reverse order to confirm the sort reorders them.
    useOrderStoreMock.mockImplementation((selector) =>
      selector({ orders: [tieSecond, tieFirst, earlier] }),
    )
    const { container } = render(<KdsScreen tablesById={tablesById} />)
    const articles = container.querySelectorAll('article')
    expect(articles.length).toBe(3)
    // Expected ASC order: earlier (Table 1), tieFirst (Table 2 — id 'bbb' < 'ccc'), tieSecond (Table 3)
    const renderedTables = Array.from(articles).map(
      (a) => a.querySelector('header span')?.textContent ?? '',
    )
    expect(renderedTables[0]).toBe('Table 1')
    expect(renderedTables[1]).toBe('Table 2')
    expect(renderedTables[2]).toBe('Table 3')
  })

  it('30s tick updates elapsed time display', async () => {
    vi.useFakeTimers()
    const submittedAt = new Date(Date.now() - 10_000).toISOString() // 10 seconds ago — "just now"
    const order = makeOrder({ id: 'tick-test', submitted_at: submittedAt })
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [order] }))
    const { container } = render(<KdsScreen tablesById={{}} />)

    // Initially "just now" (< 1 min ago) — target the ticket's time span, not the KDS header count span
    const timeSpanBefore = container.querySelector('article header span:last-child')
    expect(timeSpanBefore?.textContent?.includes('just now')).toBe(true)

    // Advance 60 seconds — the 30s interval fires, now is ~70s after submission
    await act(() => {
      vi.advanceTimersByTime(60_000)
    })

    const timeSpanAfter = container.querySelector('article header span:last-child')
    expect(timeSpanAfter?.textContent?.includes('1m ago')).toBe(true)
  })
})
