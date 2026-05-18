import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { OrderFeed } from '@/components/admin/OrderFeed'
import { useOrderStore } from '@/stores/orderStore'
import type { Order } from '@/types/app'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o-1',
    restaurant_id: 'r-1',
    table_id: 't-1',
    items: [{ name: 'Burger', quantity: 1, variants: [] }],
    submitted_at: '2026-05-18T12:00:00Z',
    is_handled: false,
    handled_at: null,
    ...overrides,
  }
}

beforeEach(() => {
  useOrderStore.setState({ orders: [], isRealtimeReady: false })
})

afterEach(() => cleanup())

describe('OrderFeed', () => {
  it('renders the empty state when there are no orders', () => {
    render(<OrderFeed tablesById={{}} />)
    expect(screen.getByText(/no orders yet/i)).toBeDefined()
  })

  it('renders the empty state when all orders are handled', () => {
    useOrderStore.setState({
      orders: [makeOrder({ is_handled: true })],
      isRealtimeReady: false,
    })
    render(<OrderFeed tablesById={{ 't-1': 1 }} />)
    expect(screen.getByText(/no orders yet/i)).toBeDefined()
  })

  it('renders one row per unhandled order, resolving table numbers', () => {
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

  it('hides handled orders from the Active view', () => {
    useOrderStore.setState({
      orders: [
        makeOrder({ id: 'a', table_id: 't-1', is_handled: false }),
        makeOrder({ id: 'b', table_id: 't-2', is_handled: true }),
      ],
      isRealtimeReady: true,
    })
    render(<OrderFeed tablesById={{ 't-1': 1, 't-2': 2 }} />)
    expect(screen.getByText('Table 1')).toBeDefined()
    expect(screen.queryByText('Table 2')).toBeNull()
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
})
