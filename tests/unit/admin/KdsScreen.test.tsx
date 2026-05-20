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
  })

  it('renders empty-state when no active orders', () => {
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [] }))
    render(<KdsScreen />)
    expect(screen.getByText('Waiting for orders')).toBeTruthy()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('renders one card per active order', () => {
    const orders = [makeOrder(), makeOrder(), makeOrder()]
    useOrderStoreMock.mockImplementation((selector) => selector({ orders }))
    render(<KdsScreen />)
    const articles = screen.getAllByRole('article')
    expect(articles.length).toBe(3)
    expect(screen.queryByText('Waiting for orders')).toBeNull()
  })

  it('header counter reads "1 order" (singular) for one active order', () => {
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [makeOrder()] }))
    render(<KdsScreen />)
    expect(screen.getByText('1 order')).toBeTruthy()
  })

  it('header counter reads "3 orders" (plural) for multiple active orders', () => {
    useOrderStoreMock.mockImplementation((selector) =>
      selector({ orders: [makeOrder(), makeOrder(), makeOrder()] }),
    )
    render(<KdsScreen />)
    expect(screen.getByText('3 orders')).toBeTruthy()
  })

  it('filters out handled orders', () => {
    const active = makeOrder({ is_handled: false })
    const handled = makeOrder({ is_handled: true, handled_at: new Date().toISOString() })
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [active, handled] }))
    render(<KdsScreen />)
    expect(screen.getAllByRole('article').length).toBe(1)
    expect(screen.getByText('1 order')).toBeTruthy()
  })

  it('renders heading "Kitchen"', () => {
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [] }))
    render(<KdsScreen />)
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
      render(<KdsScreen />)
    })
    expect(request).toHaveBeenCalledWith('screen')
  })

  it('does not throw when wake lock is unsupported (no navigator.wakeLock)', () => {
    // wakeLock deleted in beforeEach
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [] }))
    expect(() => render(<KdsScreen />)).not.toThrow()
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
      const result = render(<KdsScreen />)
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
      render(<KdsScreen />)
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
      render(<KdsScreen />)
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

})
