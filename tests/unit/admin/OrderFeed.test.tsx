import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { OrderFeed } from '@/components/admin/OrderFeed'
import { useOrderStore } from '@/stores/orderStore'
import type { Order } from '@/types/app'

vi.mock('@/actions/orderActions', () => ({
  advanceOrderStatus: vi.fn().mockResolvedValue({ success: true, data: undefined }),
}))

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o-1',
    restaurant_id: 'r-1',
    table_id: 't-1',
    items: [{ name: 'Burger', quantity: 1, variants: [], unit_price_cents: 0 }],
    total_cents: 0,
    submitted_at: '2026-05-18T12:00:00Z',
    status: 'received',
    is_handled: false,
    handled_at: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useOrderStore.setState({ orders: [], isRealtimeReady: false })
})

afterEach(() => cleanup())

describe('OrderFeed', () => {
  it('renders the empty state when there are no orders', () => {
    render(<OrderFeed tablesById={{}} />)
    expect(screen.getByText(/no orders yet/i)).toBeDefined()
  })

  it('renders the empty state when all orders are completed', () => {
    useOrderStore.setState({
      orders: [makeOrder({ status: 'completed', is_handled: true, handled_at: new Date().toISOString() })],
      isRealtimeReady: false,
    })
    render(<OrderFeed tablesById={{ 't-1': 1 }} />)
    expect(screen.getByText(/no orders yet/i)).toBeDefined()
  })

  it('renders one row per non-completed order, resolving table numbers', () => {
    useOrderStore.setState({
      orders: [
        makeOrder({ id: 'a', table_id: 't-1', submitted_at: '2026-05-18T12:00:00Z' }),
        makeOrder({ id: 'b', table_id: 't-2', submitted_at: '2026-05-18T11:00:00Z' }),
      ],
      isRealtimeReady: true,
    })
    render(<OrderFeed tablesById={{ 't-1': 1, 't-2': 2 }} />)
    expect(screen.getByText('Table 1')).toBeDefined()
    expect(screen.getByText('Table 2')).toBeDefined()
  })

  it('renders "Table —" for orders whose table_id is missing from tablesById', () => {
    useOrderStore.setState({
      orders: [makeOrder({ id: 'a', table_id: 't-missing' })],
      isRealtimeReady: true,
    })
    render(<OrderFeed tablesById={{}} />)
    expect(screen.getByText('Table —')).toBeDefined()
  })

  it('Active tab hides completed orders (status-based filter)', () => {
    useOrderStore.setState({
      orders: [
        makeOrder({ id: 'a', table_id: 't-1', status: 'received' }),
        makeOrder({ id: 'b', table_id: 't-2', status: 'completed', is_handled: true, handled_at: new Date().toISOString() }),
      ],
      isRealtimeReady: true,
    })
    render(<OrderFeed tablesById={{ 't-1': 1, 't-2': 2 }} />)
    expect(screen.getByText('Table 1')).toBeDefined()
    expect(screen.queryByText('Table 2')).toBeNull()
  })

  it('Active tab shows preparing and ready orders', () => {
    useOrderStore.setState({
      orders: [
        makeOrder({ id: 'a', table_id: 't-1', status: 'preparing' }),
        makeOrder({ id: 'b', table_id: 't-2', status: 'ready' }),
      ],
      isRealtimeReady: true,
    })
    render(<OrderFeed tablesById={{ 't-1': 1, 't-2': 2 }} />)
    expect(screen.getByText('Table 1')).toBeDefined()
    expect(screen.getByText('Table 2')).toBeDefined()
  })

  it('reactively re-renders when addOrder fires', () => {
    render(<OrderFeed tablesById={{ 't-1': 1, 't-2': 2 }} />)
    expect(screen.getByText(/no orders yet/i)).toBeDefined()

    act(() => {
      useOrderStore.getState().addOrder(makeOrder({ id: 'new', table_id: 't-2' }))
    })

    expect(screen.getByText('Table 2')).toBeDefined()
  })

  it('renders orders in store order (DESC submitted_at)', () => {
    useOrderStore.setState({
      orders: [
        makeOrder({ id: 'a', table_id: 't-1', submitted_at: '2026-05-18T12:00:00Z' }),
        makeOrder({ id: 'b', table_id: 't-2', submitted_at: '2026-05-18T11:00:00Z' }),
      ],
      isRealtimeReady: true,
    })
    render(<OrderFeed tablesById={{ 't-1': 1, 't-2': 2 }} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows[0].textContent).toContain('Table 1')
    expect(rows[1].textContent).toContain('Table 2')
  })

  it('exposes data-realtime-ready="true" on the list when subscribed', () => {
    useOrderStore.setState({
      orders: [makeOrder({ id: 'a', table_id: 't-1' })],
      isRealtimeReady: true,
    })
    const { container } = render(<OrderFeed tablesById={{ 't-1': 1 }} />)
    const list = container.querySelector('ul')
    expect(list?.getAttribute('data-realtime-ready')).toBe('true')
  })

  it('exposes data-realtime-ready="false" before subscription is established', () => {
    const { container } = render(<OrderFeed tablesById={{}} />)
    const wrapper = container.querySelector('[data-realtime-ready]')
    expect(wrapper?.getAttribute('data-realtime-ready')).toBe('false')
  })

  it('renders Active, Handled, and All tab buttons', () => {
    render(<OrderFeed tablesById={{}} />)
    expect(screen.getByRole('tab', { name: 'Active' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Handled' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'All' })).toBeDefined()
  })

  it('Handled tab shows only completed orders', () => {
    useOrderStore.setState({
      orders: [
        makeOrder({ id: 'a', table_id: 't-1', status: 'received' }),
        makeOrder({ id: 'b', table_id: 't-2', status: 'completed', is_handled: true, handled_at: new Date().toISOString() }),
      ],
      isRealtimeReady: true,
    })
    render(<OrderFeed tablesById={{ 't-1': 1, 't-2': 2 }} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Handled' }))
    expect(screen.queryByText('Table 1')).toBeNull()
    expect(screen.getByText('Table 2')).toBeDefined()
  })

  it('All tab shows all orders regardless of status', () => {
    useOrderStore.setState({
      orders: [
        makeOrder({ id: 'a', table_id: 't-1', status: 'received' }),
        makeOrder({ id: 'b', table_id: 't-2', status: 'completed', is_handled: true, handled_at: new Date().toISOString() }),
      ],
      isRealtimeReady: true,
    })
    render(<OrderFeed tablesById={{ 't-1': 1, 't-2': 2 }} />)
    fireEvent.click(screen.getByRole('tab', { name: 'All' }))
    expect(screen.getByText('Table 1')).toBeDefined()
    expect(screen.getByText('Table 2')).toBeDefined()
  })

  it('Handled tab shows empty state when no completed orders', () => {
    useOrderStore.setState({
      orders: [makeOrder({ id: 'a', table_id: 't-1', status: 'received' })],
      isRealtimeReady: true,
    })
    render(<OrderFeed tablesById={{ 't-1': 1 }} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Handled' }))
    expect(screen.getByText(/no handled orders yet/i)).toBeDefined()
  })

  describe('handleAdvance', () => {
    it('optimistically updates the store then calls advanceOrderStatus', async () => {
      const { advanceOrderStatus } = await import('@/actions/orderActions')
      useOrderStore.setState({
        orders: [makeOrder({ id: 'target', table_id: 't-1', status: 'received' })],
        isRealtimeReady: true,
      })
      render(<OrderFeed tablesById={{ 't-1': 1 }} />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /mark preparing/i }))
      })

      expect(useOrderStore.getState().orders.find((o) => o.id === 'target')?.status).toBe('preparing')
      expect(advanceOrderStatus).toHaveBeenCalledWith('target', 'preparing')
    })

    it('INVALID_TRANSITION: keeps optimistic state (trusts Realtime to reconcile); shows error', async () => {
      // State-desync codes: server has a truth Realtime will deliver. Rolling
      // back would stomp a possible Realtime echo, so we leave the optimistic
      // write in place and surface the error inline.
      const { advanceOrderStatus } = await import('@/actions/orderActions')
      vi.mocked(advanceOrderStatus).mockResolvedValueOnce({
        success: false,
        error: 'Order state changed — please refresh',
        code: 'INVALID_TRANSITION',
      })

      useOrderStore.setState({
        orders: [makeOrder({ id: 'target', table_id: 't-1', status: 'received' })],
        isRealtimeReady: true,
      })
      render(<OrderFeed tablesById={{ 't-1': 1 }} />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /mark preparing/i }))
      })

      // Optimistic write remains in store (no rollback)
      expect(useOrderStore.getState().orders.find((o) => o.id === 'target')?.status).toBe('preparing')
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('Order state changed — please refresh')
    })

    it('CONCURRENT_UPDATE: keeps optimistic state (trusts Realtime to reconcile); shows error', async () => {
      const { advanceOrderStatus } = await import('@/actions/orderActions')
      vi.mocked(advanceOrderStatus).mockResolvedValueOnce({
        success: false,
        error: 'Order changed — please refresh',
        code: 'CONCURRENT_UPDATE',
      })

      useOrderStore.setState({
        orders: [makeOrder({ id: 'target', table_id: 't-1', status: 'received' })],
        isRealtimeReady: true,
      })
      render(<OrderFeed tablesById={{ 't-1': 1 }} />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /mark preparing/i }))
      })

      expect(useOrderStore.getState().orders.find((o) => o.id === 'target')?.status).toBe('preparing')
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('Order changed — please refresh')
    })

    it('rolls back on UPDATE_FAILED and shows retry message', async () => {
      const { advanceOrderStatus } = await import('@/actions/orderActions')
      vi.mocked(advanceOrderStatus).mockResolvedValueOnce({
        success: false,
        error: "Tap to retry — update didn't send",
        code: 'UPDATE_FAILED',
      })

      useOrderStore.setState({
        orders: [makeOrder({ id: 'target', table_id: 't-1', status: 'received' })],
        isRealtimeReady: true,
      })
      render(<OrderFeed tablesById={{ 't-1': 1 }} />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /mark preparing/i }))
      })

      expect(useOrderStore.getState().orders.find((o) => o.id === 'target')?.status).toBe('received')
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain("update didn't send")
    })

    it('double-tap guard prevents two concurrent calls for the same orderId', async () => {
      const { advanceOrderStatus } = await import('@/actions/orderActions')
      let resolveFirst!: () => void
      vi.mocked(advanceOrderStatus).mockImplementationOnce(
        () => new Promise((res) => { resolveFirst = () => res({ success: true, data: undefined }) }),
      )

      useOrderStore.setState({
        orders: [makeOrder({ id: 'target', table_id: 't-1', status: 'received' })],
        isRealtimeReady: true,
      })
      render(<OrderFeed tablesById={{ 't-1': 1 }} />)

      const btn = screen.getByRole('button', { name: /mark preparing/i })
      fireEvent.click(btn)
      fireEvent.click(btn)

      await act(async () => { resolveFirst() })

      expect(vi.mocked(advanceOrderStatus)).toHaveBeenCalledTimes(1)
    })

    it('error message clears on re-tap of the action button', async () => {
      const { advanceOrderStatus } = await import('@/actions/orderActions')
      vi.mocked(advanceOrderStatus)
        .mockResolvedValueOnce({ success: false, error: 'err', code: 'UPDATE_FAILED' })
        .mockResolvedValueOnce({ success: true, data: undefined })

      useOrderStore.setState({
        orders: [makeOrder({ id: 'target', table_id: 't-1', status: 'received' })],
        isRealtimeReady: true,
      })
      render(<OrderFeed tablesById={{ 't-1': 1 }} />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /mark preparing/i }))
      })
      expect(screen.getByRole('alert')).toBeDefined()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /mark preparing/i }))
      })
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })
})
