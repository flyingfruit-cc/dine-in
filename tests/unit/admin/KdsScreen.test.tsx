import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { KdsScreen } from '@/components/admin/KdsScreen'
import type { Order } from '@/types/app'

// --- Store mock -----------------------------------------------------------
// KdsScreen calls both useOrderStore(selector) (React hook) and
// useOrderStore.getState().updateStatus (outside the React tree).
// We expose a mutable orders array so assertions can read store state.

const storeOrders: Order[] = []

const useOrderStoreMock = vi.fn()
const updateStatusMock = vi.fn()

vi.mock('@/stores/orderStore', () => ({
  useOrderStore: Object.assign(
    (selector: (s: { orders: Order[] }) => unknown) => useOrderStoreMock(selector),
    {
      getState: () => ({
        orders: storeOrders,
        updateStatus: updateStatusMock,
      }),
    },
  ),
}))

// --- Server Action mock ---------------------------------------------------
const advanceOrderStatusMock = vi.fn()
const unbumpOrderMock = vi.fn()

vi.mock('@/actions/orderActions', () => ({
  advanceOrderStatus: (...args: unknown[]) => advanceOrderStatusMock(...args),
  unbumpOrder: (...args: unknown[]) => unbumpOrderMock(...args),
}))

// -------------------------------------------------------------------------

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-' + Math.random().toString(36).slice(2),
    restaurant_id: 'rest-1',
    table_id: 'table-uuid-' + Math.random().toString(36).slice(2),
    items: [],
    submitted_at: new Date(Date.now() - 60_000).toISOString(),
    status: 'preparing',
    is_handled: false,
    handled_at: null,
    total_cents: 0,
    ...overrides,
  }
}

describe('KdsScreen', () => {
  beforeEach(() => {
    useOrderStoreMock.mockReset()
    updateStatusMock.mockReset()
    advanceOrderStatusMock.mockReset()
    unbumpOrderMock.mockReset()
    storeOrders.length = 0
    delete (globalThis.navigator as unknown as { wakeLock?: unknown }).wakeLock
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  // -----------------------------------------------------------------------
  // Filter tests (status-based)
  // -----------------------------------------------------------------------

  it('renders empty-state when no active orders', () => {
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [] }))
    render(<KdsScreen tablesById={{}} />)
    expect(screen.getByText('Waiting for orders')).toBeTruthy()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('renders one card per preparing order', () => {
    const orders = [makeOrder(), makeOrder(), makeOrder()]
    useOrderStoreMock.mockImplementation((selector) => selector({ orders }))
    render(<KdsScreen tablesById={{}} />)
    const articles = screen.getAllByRole('article')
    expect(articles.length).toBe(3)
    expect(screen.queryByText('Waiting for orders')).toBeNull()
  })

  it('received order does NOT appear on KDS (only preparing is shown)', () => {
    const orders = [makeOrder({ status: 'received' })]
    useOrderStoreMock.mockImplementation((selector) => selector({ orders }))
    render(<KdsScreen tablesById={{}} />)
    expect(screen.queryByRole('article')).toBeNull()
    expect(screen.getByText('Waiting for orders')).toBeTruthy()
  })

  it('completed order does NOT appear on KDS', () => {
    const orders = [makeOrder({ status: 'completed', is_handled: true, handled_at: new Date().toISOString() })]
    useOrderStoreMock.mockImplementation((selector) => selector({ orders }))
    render(<KdsScreen tablesById={{}} />)
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('ready order does NOT appear on KDS (ready means kitchen done)', () => {
    const orders = [makeOrder({ status: 'ready' })]
    useOrderStoreMock.mockImplementation((selector) => selector({ orders }))
    render(<KdsScreen tablesById={{}} />)
    expect(screen.queryByRole('article')).toBeNull()
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

  it('renders heading "Kitchen"', () => {
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [] }))
    render(<KdsScreen tablesById={{}} />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Kitchen')
  })

  // -----------------------------------------------------------------------
  // Wake lock tests (unchanged behavior from Story 8.3)
  // -----------------------------------------------------------------------

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
    const tablesById = {
      [earlier.table_id]: 1,
      [tieFirst.table_id]: 2,
      [tieSecond.table_id]: 3,
    }
    useOrderStoreMock.mockImplementation((selector) =>
      selector({ orders: [tieSecond, tieFirst, earlier] }),
    )
    const { container } = render(<KdsScreen tablesById={tablesById} />)
    const articles = container.querySelectorAll('article')
    expect(articles.length).toBe(3)
    const renderedTables = Array.from(articles).map(
      (a) => a.querySelector('header span')?.textContent ?? '',
    )
    expect(renderedTables[0]).toBe('Table 1')
    expect(renderedTables[1]).toBe('Table 2')
    expect(renderedTables[2]).toBe('Table 3')
  })

  it('30s tick updates elapsed time display', async () => {
    vi.useFakeTimers()
    const submittedAt = new Date(Date.now() - 10_000).toISOString()
    const order = makeOrder({ id: 'tick-test', submitted_at: submittedAt })
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: [order] }))
    const { container } = render(<KdsScreen tablesById={{}} />)

    const timeSpanBefore = container.querySelector('article header span:last-child')
    expect(timeSpanBefore?.textContent?.includes('just now')).toBe(true)

    await act(() => {
      vi.advanceTimersByTime(60_000)
    })

    const timeSpanAfter = container.querySelector('article header span:last-child')
    expect(timeSpanAfter?.textContent?.includes('1m ago')).toBe(true)
  })

  // -----------------------------------------------------------------------
  // Bump + undo orchestration tests (updated for advanceOrderStatus)
  // -----------------------------------------------------------------------

  it('bumping a ticket calls advanceOrderStatus(orderId, "ready") and shows Undo affordance', async () => {
    vi.useFakeTimers()
    advanceOrderStatusMock.mockResolvedValueOnce({ success: true, data: undefined })
    const order = makeOrder({ id: 'o1', table_id: 'tid-1' })
    storeOrders.push(order)
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-1': 5 }} />)
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(advanceOrderStatusMock).toHaveBeenCalledWith('o1', 'ready')
    expect(updateStatusMock).toHaveBeenCalledWith('o1', 'ready')
    expect(screen.getByRole('button', { name: /undo/i })).toBeTruthy()
  })

  it('ticket stays rendered during animation, then is removed after safety-net timeout', async () => {
    vi.useFakeTimers()
    advanceOrderStatusMock.mockResolvedValueOnce({ success: true, data: undefined })
    const order = makeOrder({ id: 'o-anim', table_id: 'tid-anim', status: 'preparing' })
    storeOrders.push(order)
    // Mutate the store entry so the optimistic updateStatus actually flips the
    // article's status — without this, the active-filter assertion after the
    // 250ms timer would be vacuous.
    updateStatusMock.mockImplementation((id: string, status: string) => {
      const o = storeOrders.find((x) => x.id === id)
      if (o) o.status = status as Order['status']
    })
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    const { container } = render(<KdsScreen tablesById={{ 'tid-anim': 9 }} />)
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))

    // Article should still be in DOM (bumpingIds keeps it visible despite the
    // optimistic status='ready' flip).
    expect(container.querySelector('article')).toBeTruthy()

    // Advance past the 250ms safety-net: bumpingIds drops the id, the filter
    // now excludes the order (status='ready'), and the article unmounts.
    await act(() => { vi.advanceTimersByTime(250) })
    expect(container.querySelector('article')).toBeNull()
  })

  it('bump rollback: failed advanceOrderStatus restores to preparing and shows inline error', async () => {
    vi.useFakeTimers()
    advanceOrderStatusMock.mockResolvedValueOnce({ success: false, error: "Tap to retry — bump didn't send" })
    const order = makeOrder({ id: 'o-fail', table_id: 'tid-fail', status: 'preparing' })
    storeOrders.push(order)
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-fail': 3 }} />)
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(updateStatusMock).toHaveBeenCalledWith('o-fail', 'preparing')
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
    const alert = screen.getByRole('alert')
    expect(alert.textContent?.includes("bump didn't send")).toBe(true)
  })

  it('tap Undo restores the bumped order via updateStatus("preparing") and calls unbumpOrder', async () => {
    vi.useFakeTimers()
    advanceOrderStatusMock.mockResolvedValueOnce({ success: true, data: undefined })
    unbumpOrderMock.mockResolvedValueOnce({ success: true, data: undefined })

    const order = makeOrder({ id: 'o-undo', table_id: 'tid-undo', status: 'preparing' })
    storeOrders.push(order)
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-undo': 6 }} />)
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))

    await act(async () => { await Promise.resolve() })

    const undoBtn = screen.getByRole('button', { name: /undo/i })
    fireEvent.click(undoBtn)

    await act(async () => { await Promise.resolve() })

    expect(unbumpOrderMock).toHaveBeenCalledWith('o-undo')
    expect(updateStatusMock).toHaveBeenCalledWith('o-undo', 'preparing')
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
  })

  it('Undo rollback: failed unbumpOrder restores to ready via updateStatus and shows undo error', async () => {
    vi.useFakeTimers()
    advanceOrderStatusMock.mockResolvedValueOnce({ success: true, data: undefined })
    unbumpOrderMock.mockResolvedValueOnce({ success: false, error: "Tap to retry — undo didn't send" })

    const order = makeOrder({ id: 'o-undo-fail', table_id: 'tid-uf', status: 'preparing' })
    storeOrders.push(order)
    updateStatusMock.mockImplementation((id: string, status: string) => {
      const o = storeOrders.find((x) => x.id === id)
      if (o) o.status = status as Order['status']
    })
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-uf': 7 }} />)

    fireEvent.click(screen.getByRole('button', { name: /bump/i }))
    await act(async () => { await Promise.resolve() })

    const undoBtn = screen.getByRole('button', { name: /undo bump for table 7/i })
    fireEvent.click(undoBtn)
    await act(async () => { await Promise.resolve() })

    // Undo failed — rollback fires updateStatus(id, 'ready') to restore the ready state
    const restoreCalls = updateStatusMock.mock.calls.filter(
      ([id, status]) => id === 'o-undo-fail' && status === 'ready',
    )
    expect(restoreCalls.length).toBeGreaterThanOrEqual(1)
    const errorEl = document.querySelector('[role="status"]')
    expect(errorEl?.textContent?.includes("undo didn't send")).toBe(true)
  })

  it('Undo affordance disappears after 5 seconds', async () => {
    vi.useFakeTimers()
    advanceOrderStatusMock.mockResolvedValueOnce({ success: true, data: undefined })

    const order = makeOrder({ id: 'o-timer', table_id: 'tid-timer', status: 'preparing' })
    storeOrders.push(order)
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-timer': 11 }} />)
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))

    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('button', { name: /undo/i })).toBeTruthy()

    await act(() => { vi.advanceTimersByTime(5_001) })
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
  })

  it('consecutive bumps track only the most recent for Undo (AC #7)', async () => {
    vi.useFakeTimers()
    advanceOrderStatusMock.mockResolvedValue({ success: true, data: undefined })
    unbumpOrderMock.mockResolvedValueOnce({ success: true, data: undefined })

    const orderA = makeOrder({ id: 'o-A', table_id: 'tid-A', status: 'preparing' })
    const orderB = makeOrder({ id: 'o-B', table_id: 'tid-B', status: 'preparing' })
    storeOrders.push(orderA, orderB)
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-A': 1, 'tid-B': 2 }} />)

    fireEvent.click(screen.getByRole('button', { name: /bump order for table 1/i }))
    await act(async () => { await Promise.resolve() })
    await act(() => { vi.advanceTimersByTime(250) })

    fireEvent.click(screen.getByRole('button', { name: /bump order for table 2/i }))
    await act(async () => { await Promise.resolve() })

    const undoAffordance = screen.getByRole('button', { name: /undo/i })
    expect(undoAffordance).toBeTruthy()

    fireEvent.click(undoAffordance)
    await act(async () => { await Promise.resolve() })
    expect(unbumpOrderMock).toHaveBeenCalledWith(orderB.id)
  })

  it('consecutive bumps reset the 5s timer (AC #7)', async () => {
    vi.useFakeTimers()
    advanceOrderStatusMock.mockResolvedValue({ success: true, data: undefined })

    const orderA = makeOrder({ id: 'o-timer-A', table_id: 'tid-tA', status: 'preparing' })
    const orderB = makeOrder({ id: 'o-timer-B', table_id: 'tid-tB', status: 'preparing' })
    storeOrders.push(orderA, orderB)
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-tA': 1, 'tid-tB': 2 }} />)

    const btns = screen.getAllByRole('button', { name: /bump/i })
    fireEvent.click(btns[0])
    await act(async () => { await Promise.resolve() })
    await act(() => { vi.advanceTimersByTime(250) })

    await act(() => { vi.advanceTimersByTime(3_000) })

    const btnsAfter = screen.getAllByRole('button', { name: /bump/i })
    fireEvent.click(btnsAfter[0])
    await act(async () => { await Promise.resolve() })

    await act(() => { vi.advanceTimersByTime(3_000) })
    expect(screen.queryByRole('button', { name: /undo/i })).toBeTruthy()

    await act(() => { vi.advanceTimersByTime(2_001) })
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
  })
})
