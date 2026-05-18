import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { RealtimeProvider } from '@/components/shared/RealtimeProvider'
import { useOrderStore } from '@/stores/orderStore'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types/app'

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

const mockCreateClient = vi.mocked(createClient)

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

type StatusCallback = (status: string) => void | Promise<void>
type PayloadCallback = (payload: { new: Order }) => void
type AuthChangeCallback = (
  event: 'TOKEN_REFRESHED' | 'SIGNED_OUT' | string,
  session: { access_token: string } | null,
) => void

function makeSupabaseFake(initialOrders: Order[] = []) {
  let statusCallback: StatusCallback | null = null
  let payloadCallback: PayloadCallback | null = null
  let authChangeCallback: AuthChangeCallback | null = null
  const removeChannel = vi.fn()
  const limit = vi.fn().mockResolvedValue({ data: initialOrders, error: null })
  const orderFn = vi.fn().mockReturnValue({ limit })
  const eq2 = vi.fn().mockReturnValue({ order: orderFn })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
  const select = vi.fn().mockReturnValue({ eq: eq1 })
  const from = vi.fn().mockReturnValue({ select })

  const channel = {
    on: vi.fn(function (this: unknown, _evt: string, _filter: unknown, cb: PayloadCallback) {
      payloadCallback = cb
      return channel
    }),
    subscribe: vi.fn(function (this: unknown, cb: StatusCallback) {
      statusCallback = cb
      return channel
    }),
  }

  const authUnsubscribe = vi.fn()
  const onAuthStateChange = vi.fn((cb: AuthChangeCallback) => {
    authChangeCallback = cb
    return { data: { subscription: { unsubscribe: authUnsubscribe } } }
  })

  const realtimeSetAuth = vi.fn().mockResolvedValue(undefined)
  const getSession = vi
    .fn()
    .mockResolvedValue({ data: { session: { access_token: 'fake-jwt' } } })

  const supabase = {
    from,
    channel: vi.fn().mockReturnValue(channel),
    removeChannel,
    auth: {
      getSession,
      onAuthStateChange,
    },
    realtime: {
      setAuth: realtimeSetAuth,
    },
  }

  return {
    supabase,
    triggerStatus: async (status: string) => {
      if (statusCallback) await statusCallback(status)
    },
    triggerInsert: (order: Order) => payloadCallback?.({ new: order }),
    triggerAuthChange: (
      event: 'TOKEN_REFRESHED' | 'SIGNED_OUT' | string,
      session: { access_token: string } | null,
    ) => authChangeCallback?.(event, session),
    removeChannel,
    authUnsubscribe,
    realtimeSetAuth,
    getSession,
    select,
    eq1,
    eq2,
    onAuthStateChange,
    channel,
  }
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  useOrderStore.setState({ orders: [], isRealtimeReady: false })
  mockCreateClient.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('RealtimeProvider', () => {
  it('hydrates the store from initial fetch on mount, filtered to unhandled orders', async () => {
    const initial = [makeOrder({ id: 'a' }), makeOrder({ id: 'b' })]
    const { supabase, eq2 } = makeSupabaseFake(initial)
    mockCreateClient.mockReturnValue(supabase as never)

    render(<RealtimeProvider restaurantId="r-1">child</RealtimeProvider>)
    await flushMicrotasks()

    expect(useOrderStore.getState().orders).toHaveLength(2)
    // Confirms `.eq('is_handled', false)` is part of the query
    expect(eq2).toHaveBeenCalledWith('is_handled', false)
  })

  it('propagates session token via realtime.setAuth before subscribing', async () => {
    const { supabase, realtimeSetAuth, channel } = makeSupabaseFake([])
    mockCreateClient.mockReturnValue(supabase as never)

    render(<RealtimeProvider restaurantId="r-1">child</RealtimeProvider>)
    await flushMicrotasks()

    // setAuth must have been called before subscribe was invoked
    expect(realtimeSetAuth).toHaveBeenCalled()
    expect(channel.subscribe).toHaveBeenCalled()
    const setAuthOrder = realtimeSetAuth.mock.invocationCallOrder[0]
    const subscribeOrder = channel.subscribe.mock.invocationCallOrder[0]
    expect(setAuthOrder).toBeLessThan(subscribeOrder)
  })

  it('addOrder is called when an INSERT payload arrives', async () => {
    const { supabase, triggerInsert } = makeSupabaseFake([])
    mockCreateClient.mockReturnValue(supabase as never)

    render(<RealtimeProvider restaurantId="r-1">child</RealtimeProvider>)
    await flushMicrotasks()

    act(() => {
      triggerInsert(makeOrder({ id: 'new' }))
    })

    expect(useOrderStore.getState().orders.map((o) => o.id)).toEqual(['new'])
  })

  it('sets isRealtimeReady=true on SUBSCRIBED and re-propagates auth', async () => {
    const { supabase, triggerStatus, realtimeSetAuth } = makeSupabaseFake([])
    mockCreateClient.mockReturnValue(supabase as never)

    render(<RealtimeProvider restaurantId="r-1">child</RealtimeProvider>)
    await flushMicrotasks()
    const setAuthCallsBefore = realtimeSetAuth.mock.calls.length

    await act(async () => {
      await triggerStatus('SUBSCRIBED')
    })

    expect(useOrderStore.getState().isRealtimeReady).toBe(true)
    // setAuth is called again on reconnect to keep Realtime auth fresh
    expect(realtimeSetAuth.mock.calls.length).toBeGreaterThan(setAuthCallsBefore)
  })

  it('starts polling on CHANNEL_ERROR and stops on SUBSCRIBED', async () => {
    const { supabase, triggerStatus, select } = makeSupabaseFake([makeOrder({ id: 'a' })])
    mockCreateClient.mockReturnValue(supabase as never)

    render(<RealtimeProvider restaurantId="r-1">child</RealtimeProvider>)
    await flushMicrotasks()
    expect(select).toHaveBeenCalledTimes(1)

    vi.useFakeTimers()

    await act(async () => { await triggerStatus('CHANNEL_ERROR') })
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(select).toHaveBeenCalledTimes(2)

    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(select).toHaveBeenCalledTimes(3)

    await act(async () => { await triggerStatus('SUBSCRIBED') })
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(select).toHaveBeenCalledTimes(3)
  })

  it('re-setAuth happens on TOKEN_REFRESHED via auth state change', async () => {
    const { supabase, realtimeSetAuth, triggerAuthChange } = makeSupabaseFake([])
    mockCreateClient.mockReturnValue(supabase as never)

    render(<RealtimeProvider restaurantId="r-1">child</RealtimeProvider>)
    await flushMicrotasks()
    const callsBefore = realtimeSetAuth.mock.calls.length

    act(() => triggerAuthChange('TOKEN_REFRESHED', { access_token: 'fresh-jwt' }))

    expect(realtimeSetAuth).toHaveBeenLastCalledWith('fresh-jwt')
    expect(realtimeSetAuth.mock.calls.length).toBe(callsBefore + 1)
  })

  it('resets the store on SIGNED_OUT', async () => {
    const { supabase, triggerAuthChange } = makeSupabaseFake([makeOrder({ id: 'a' })])
    mockCreateClient.mockReturnValue(supabase as never)

    render(<RealtimeProvider restaurantId="r-1">child</RealtimeProvider>)
    await flushMicrotasks()
    expect(useOrderStore.getState().orders).toHaveLength(1)

    act(() => triggerAuthChange('SIGNED_OUT', null))

    expect(useOrderStore.getState().orders).toEqual([])
    expect(useOrderStore.getState().isRealtimeReady).toBe(false)
  })

  it('cleanup unsubscribes auth listener, removes the channel, clears polling, and resets the store', async () => {
    const { supabase, removeChannel, authUnsubscribe, triggerStatus, select } = makeSupabaseFake([
      makeOrder({ id: 'a' }),
    ])
    mockCreateClient.mockReturnValue(supabase as never)

    const { unmount } = render(<RealtimeProvider restaurantId="r-1">child</RealtimeProvider>)
    await flushMicrotasks()
    expect(useOrderStore.getState().orders).toHaveLength(1)

    vi.useFakeTimers()
    await act(async () => { await triggerStatus('CHANNEL_ERROR') })
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(select).toHaveBeenCalledTimes(2)

    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(8000) })

    expect(removeChannel).toHaveBeenCalled()
    expect(authUnsubscribe).toHaveBeenCalled()
    expect(useOrderStore.getState().orders).toEqual([])
    expect(useOrderStore.getState().isRealtimeReady).toBe(false)
    // No further polls fired after unmount
    expect(select).toHaveBeenCalledTimes(2)
  })

  it('status callback does not start polling if effect already cancelled', async () => {
    const { supabase, triggerStatus, select } = makeSupabaseFake([])
    mockCreateClient.mockReturnValue(supabase as never)

    const { unmount } = render(<RealtimeProvider restaurantId="r-1">child</RealtimeProvider>)
    await flushMicrotasks()
    expect(select).toHaveBeenCalledTimes(1)

    unmount()
    vi.useFakeTimers()
    await act(async () => { await triggerStatus('CLOSED') })
    await act(async () => { await vi.advanceTimersByTimeAsync(8000) })

    // No new polling fetches should have fired because cleanup already ran.
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('renders children', async () => {
    const { supabase } = makeSupabaseFake([])
    mockCreateClient.mockReturnValue(supabase as never)

    const { getByText } = render(
      <RealtimeProvider restaurantId="r-1">
        <span>visible</span>
      </RealtimeProvider>,
    )
    await flushMicrotasks()
    expect(getByText('visible')).toBeDefined()
  })
})
