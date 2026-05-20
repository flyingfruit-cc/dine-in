import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { KdsScreen } from '@/components/admin/KdsScreen'
import type { Order } from '@/types/app'

// --- Store mock -----------------------------------------------------------
// KdsScreen calls both useOrderStore(selector) (React hook) and
// useOrderStore.getState().markHandled/unmarkHandled (outside the React tree).
// We expose a mutable orders array so assertions can read store state.

const storeOrders: Order[] = []

const useOrderStoreMock = vi.fn()
const markHandledMock = vi.fn()
const unmarkHandledMock = vi.fn()

vi.mock('@/stores/orderStore', () => ({
  useOrderStore: Object.assign(
    (selector: (s: { orders: Order[] }) => unknown) => useOrderStoreMock(selector),
    {
      getState: () => ({
        orders: storeOrders,
        markHandled: markHandledMock,
        unmarkHandled: unmarkHandledMock,
      }),
    },
  ),
}))

// --- Server Action mock ---------------------------------------------------
const markOrderHandledMock = vi.fn()
const unbumpOrderMock = vi.fn()

vi.mock('@/actions/orderActions', () => ({
  markOrderHandled: (...args: unknown[]) => markOrderHandledMock(...args),
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
    is_handled: false,
    handled_at: null,
    total_cents: 0,
    ...overrides,
  }
}

describe('KdsScreen', () => {
  beforeEach(() => {
    useOrderStoreMock.mockReset()
    markHandledMock.mockReset()
    unmarkHandledMock.mockReset()
    markOrderHandledMock.mockReset()
    unbumpOrderMock.mockReset()
    storeOrders.length = 0
    delete (globalThis.navigator as unknown as { wakeLock?: unknown }).wakeLock
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  // -----------------------------------------------------------------------
  // Existing tests (preserved, updated render props signature unchanged)
  // -----------------------------------------------------------------------

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
  // New bump + undo orchestration tests
  // -----------------------------------------------------------------------

  it('bumping a ticket calls markOrderHandled and shows Undo affordance', async () => {
    vi.useFakeTimers()
    markOrderHandledMock.mockResolvedValueOnce({ success: true, data: undefined })
    const order = makeOrder({ id: 'o1', table_id: 'tid-1' })
    storeOrders.push(order)
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-1': 5 }} />)
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(markOrderHandledMock).toHaveBeenCalledWith('o1')
    expect(markHandledMock).toHaveBeenCalledWith('o1')
    expect(screen.getByRole('button', { name: /undo/i })).toBeTruthy()
  })

  it('ticket stays rendered during animation, then is removed after safety-net timeout', async () => {
    vi.useFakeTimers()
    markOrderHandledMock.mockResolvedValueOnce({ success: true, data: undefined })
    const order = makeOrder({ id: 'o-anim', table_id: 'tid-anim', is_handled: false })
    storeOrders.push(order)
    // Mutate the store entry so the optimistic markHandled actually flips the
    // article's is_handled flag — without this, the active-filter assertion
    // after the 250ms timer would be vacuous (the store is static otherwise).
    markHandledMock.mockImplementation((id: string) => {
      const o = storeOrders.find((x) => x.id === id)
      if (o) o.is_handled = true
    })
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    const { container } = render(<KdsScreen tablesById={{ 'tid-anim': 9 }} />)
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))

    // Article should still be in DOM (bumpingIds keeps it visible despite
    // the optimistic is_handled=true flip).
    expect(container.querySelector('article')).toBeTruthy()

    // Advance past the 250ms safety-net: bumpingIds drops the id, the filter
    // now excludes the order, and the article unmounts.
    await act(() => { vi.advanceTimersByTime(250) })
    expect(container.querySelector('article')).toBeNull()
  })

  it('bump rollback: failed Server Action restores the order and shows inline error', async () => {
    vi.useFakeTimers()
    markOrderHandledMock.mockResolvedValueOnce({ success: false, error: 'Network unavailable' })
    const order = makeOrder({ id: 'o-fail', table_id: 'tid-fail', is_handled: false })
    storeOrders.push(order)
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-fail': 3 }} />)
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(unmarkHandledMock).toHaveBeenCalledWith('o-fail')
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
    const alert = screen.getByRole('alert')
    expect(alert.textContent?.includes("bump didn't send")).toBe(true)
  })

  it('tap Undo restores the bumped order and calls unbumpOrder', async () => {
    vi.useFakeTimers()
    markOrderHandledMock.mockResolvedValueOnce({ success: true, data: undefined })
    unbumpOrderMock.mockResolvedValueOnce({ success: true, data: undefined })

    const order = makeOrder({ id: 'o-undo', table_id: 'tid-undo', is_handled: false })
    storeOrders.push(order)
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-undo': 6 }} />)
    fireEvent.click(screen.getByRole('button', { name: /bump/i }))

    await act(async () => { await Promise.resolve() })

    const undoBtn = screen.getByRole('button', { name: /undo/i })
    fireEvent.click(undoBtn)

    await act(async () => { await Promise.resolve() })

    expect(unbumpOrderMock).toHaveBeenCalledWith('o-undo')
    expect(unmarkHandledMock).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
  })

  it('Undo rollback: failed unbumpOrder re-marks handled and shows undo error', async () => {
    vi.useFakeTimers()
    markOrderHandledMock.mockResolvedValueOnce({ success: true, data: undefined })
    unbumpOrderMock.mockResolvedValueOnce({ success: false, error: "Tap to retry — undo didn't send" })

    // Start with an unhanded order so the bump click is valid. Mutate the store
    // entry on markHandled so the post-bump `beforeRestore.is_handled === true`
    // check inside handleUndo triggers the markHandled rollback path.
    const order = makeOrder({ id: 'o-undo-fail', table_id: 'tid-uf', is_handled: false })
    storeOrders.push(order)
    markHandledMock.mockImplementation((id: string) => {
      const o = storeOrders.find((x) => x.id === id)
      if (o) o.is_handled = true
    })
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-uf': 7 }} />)

    fireEvent.click(screen.getByRole('button', { name: /bump/i }))
    await act(async () => { await Promise.resolve() })

    const undoBtn = screen.getByRole('button', { name: /undo bump for table 7/i })
    fireEvent.click(undoBtn)
    await act(async () => { await Promise.resolve() })

    // Undo failed, so markHandled fires a second time (rollback re-mark).
    expect(markHandledMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    const errorEl = document.querySelector('[role="status"]')
    expect(errorEl?.textContent?.includes("undo didn't send")).toBe(true)
  })

  it('Undo affordance disappears after 5 seconds', async () => {
    vi.useFakeTimers()
    markOrderHandledMock.mockResolvedValueOnce({ success: true, data: undefined })

    const order = makeOrder({ id: 'o-timer', table_id: 'tid-timer', is_handled: false })
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
    markOrderHandledMock.mockResolvedValue({ success: true, data: undefined })
    unbumpOrderMock.mockResolvedValueOnce({ success: true, data: undefined })

    const orderA = makeOrder({ id: 'o-A', table_id: 'tid-A', is_handled: false })
    const orderB = makeOrder({ id: 'o-B', table_id: 'tid-B', is_handled: false })
    storeOrders.push(orderA, orderB)
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-A': 1, 'tid-B': 2 }} />)

    // Target specific tickets by aria-label to avoid relying on DOM order stability
    // after the mock store doesn't actually flip is_handled.
    fireEvent.click(screen.getByRole('button', { name: /bump order for table 1/i }))
    await act(async () => { await Promise.resolve() })
    await act(() => { vi.advanceTimersByTime(250) })

    // Second bump — explicitly target Table 2's bump button
    fireEvent.click(screen.getByRole('button', { name: /bump order for table 2/i }))
    await act(async () => { await Promise.resolve() })

    // Undo affordance should reference Table 2 (most recent)
    const undoAffordance = screen.getByRole('button', { name: /undo/i })
    expect(undoAffordance).toBeTruthy()

    // Click Undo → should call unbumpOrder with orderB's id
    fireEvent.click(undoAffordance)
    await act(async () => { await Promise.resolve() })
    expect(unbumpOrderMock).toHaveBeenCalledWith(orderB.id)
  })

  it('consecutive bumps reset the 5s timer (AC #7)', async () => {
    vi.useFakeTimers()
    markOrderHandledMock.mockResolvedValue({ success: true, data: undefined })

    const orderA = makeOrder({ id: 'o-timer-A', table_id: 'tid-tA', is_handled: false })
    const orderB = makeOrder({ id: 'o-timer-B', table_id: 'tid-tB', is_handled: false })
    storeOrders.push(orderA, orderB)
    useOrderStoreMock.mockImplementation((selector) => selector({ orders: storeOrders }))

    render(<KdsScreen tablesById={{ 'tid-tA': 1, 'tid-tB': 2 }} />)

    // Bump A
    const btns = screen.getAllByRole('button', { name: /bump/i })
    fireEvent.click(btns[0])
    await act(async () => { await Promise.resolve() })
    await act(() => { vi.advanceTimersByTime(250) })

    // Advance 3s
    await act(() => { vi.advanceTimersByTime(3_000) })

    // Bump B (within A's 5s window)
    const btnsAfter = screen.getAllByRole('button', { name: /bump/i })
    fireEvent.click(btnsAfter[0])
    await act(async () => { await Promise.resolve() })

    // Advance another 3s — total 6s since A, but only 3s since B
    await act(() => { vi.advanceTimersByTime(3_000) })

    // Affordance should still be visible (B's timer is fresh — 3s elapsed of 5s window)
    expect(screen.queryByRole('button', { name: /undo/i })).toBeTruthy()

    // Advance 2001ms more — now past B's 5s window
    await act(() => { vi.advanceTimersByTime(2_001) })
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
  })
})
