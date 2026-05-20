import { describe, it, expect, beforeEach } from 'vitest'
import { useOrderStore } from '@/stores/orderStore'
import type { Order } from '@/types/app'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o-1',
    restaurant_id: 'r-1',
    table_id: 't-1',
    items: [{ name: 'Burger', quantity: 1, variants: [], unit_price_cents: 0 }],
    total_cents: 0,
    submitted_at: '2026-05-18T12:00:00Z',
    is_handled: false,
    handled_at: null,
    ...overrides,
  }
}

beforeEach(() => {
  useOrderStore.setState({ orders: [], isRealtimeReady: false })
})

describe('useOrderStore', () => {
  it('starts with an empty order list', () => {
    expect(useOrderStore.getState().orders).toEqual([])
  })

  it('starts with isRealtimeReady = false', () => {
    expect(useOrderStore.getState().isRealtimeReady).toBe(false)
  })

  it('setOrders replaces the list', () => {
    useOrderStore.setState({ orders: [makeOrder({ id: 'old' })], isRealtimeReady: false })
    useOrderStore.getState().setOrders([makeOrder({ id: 'new' })])
    const ids = useOrderStore.getState().orders.map((o) => o.id)
    expect(ids).toEqual(['new'])
  })

  it('setOrders sorts by submitted_at DESC', () => {
    useOrderStore.getState().setOrders([
      makeOrder({ id: 'a', submitted_at: '2026-05-18T10:00:00Z' }),
      makeOrder({ id: 'b', submitted_at: '2026-05-18T12:00:00Z' }),
      makeOrder({ id: 'c', submitted_at: '2026-05-18T11:00:00Z' }),
    ])
    const ids = useOrderStore.getState().orders.map((o) => o.id)
    expect(ids).toEqual(['b', 'c', 'a'])
  })

  it('addOrder prepends a new order', () => {
    useOrderStore.getState().setOrders([
      makeOrder({ id: 'existing', submitted_at: '2026-05-18T10:00:00Z' }),
    ])
    useOrderStore.getState().addOrder(
      makeOrder({ id: 'fresh', submitted_at: '2026-05-18T12:00:00Z' }),
    )
    const ids = useOrderStore.getState().orders.map((o) => o.id)
    expect(ids).toEqual(['fresh', 'existing'])
  })

  it('addOrder is idempotent on id (no duplicate)', () => {
    const order = makeOrder({ id: 'same' })
    useOrderStore.getState().addOrder(order)
    useOrderStore.getState().addOrder(order)
    expect(useOrderStore.getState().orders).toHaveLength(1)
  })

  it('addOrder maintains DESC order even when inserting an older order', () => {
    useOrderStore.getState().setOrders([
      makeOrder({ id: 'newer', submitted_at: '2026-05-18T12:00:00Z' }),
    ])
    useOrderStore.getState().addOrder(
      makeOrder({ id: 'older', submitted_at: '2026-05-18T10:00:00Z' }),
    )
    const ids = useOrderStore.getState().orders.map((o) => o.id)
    expect(ids).toEqual(['newer', 'older'])
  })

  it('markHandled sets is_handled true and stamps handled_at on matching order only', () => {
    useOrderStore.getState().setOrders([
      makeOrder({ id: 'a' }),
      makeOrder({ id: 'b' }),
    ])
    useOrderStore.getState().markHandled('a')
    const state = useOrderStore.getState()
    expect(state.orders.find((o) => o.id === 'a')?.is_handled).toBe(true)
    expect(state.orders.find((o) => o.id === 'a')?.handled_at).not.toBeNull()
    expect(state.orders.find((o) => o.id === 'b')?.is_handled).toBe(false)
  })

  it('setRealtimeReady toggles the flag', () => {
    useOrderStore.getState().setRealtimeReady(true)
    expect(useOrderStore.getState().isRealtimeReady).toBe(true)
    useOrderStore.getState().setRealtimeReady(false)
    expect(useOrderStore.getState().isRealtimeReady).toBe(false)
  })

  it('reset empties orders and clears isRealtimeReady', () => {
    useOrderStore.setState({ orders: [makeOrder()], isRealtimeReady: true })
    useOrderStore.getState().reset()
    const s = useOrderStore.getState()
    expect(s.orders).toEqual([])
    expect(s.isRealtimeReady).toBe(false)
  })

  it('updateOrder merges fields into an existing order by id', () => {
    useOrderStore.getState().setOrders([makeOrder({ id: 'a' }), makeOrder({ id: 'b' })])
    useOrderStore.getState().updateOrder(
      makeOrder({ id: 'a', is_handled: true, handled_at: '2026-05-18T13:00:00Z' }),
    )
    const updated = useOrderStore.getState().orders.find((o) => o.id === 'a')
    expect(updated?.is_handled).toBe(true)
    expect(updated?.handled_at).toBe('2026-05-18T13:00:00Z')
    expect(useOrderStore.getState().orders.find((o) => o.id === 'b')?.is_handled).toBe(false)
  })

  it('updateOrder preserves DESC sort order', () => {
    useOrderStore.getState().setOrders([
      makeOrder({ id: 'newer', submitted_at: '2026-05-18T12:00:00Z' }),
      makeOrder({ id: 'older', submitted_at: '2026-05-18T10:00:00Z' }),
    ])
    useOrderStore.getState().updateOrder(
      makeOrder({ id: 'older', is_handled: true, handled_at: '2026-05-18T13:00:00Z' }),
    )
    const ids = useOrderStore.getState().orders.map((o) => o.id)
    expect(ids).toEqual(['newer', 'older'])
  })

  it('updateOrder falls back to addOrder when id is not found', () => {
    useOrderStore.getState().setOrders([makeOrder({ id: 'existing' })])
    useOrderStore.getState().updateOrder(
      makeOrder({ id: 'unknown', is_handled: true, submitted_at: '2026-05-18T11:00:00Z' }),
    )
    expect(useOrderStore.getState().orders).toHaveLength(2)
    expect(useOrderStore.getState().orders.find((o) => o.id === 'unknown')).toBeDefined()
  })
})
