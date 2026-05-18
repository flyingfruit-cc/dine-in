import { create } from 'zustand'
import type { Order } from '@/types/app'

interface OrderStore {
  orders: Order[]
  isRealtimeReady: boolean
  setOrders: (orders: Order[]) => void
  addOrder: (order: Order) => void
  updateOrder: (order: Order) => void
  markHandled: (orderId: string) => void
  setRealtimeReady: (ready: boolean) => void
  reset: () => void
}

function sortDesc(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1))
}

export const useOrderStore = create<OrderStore>((set) => ({
  orders: [],
  isRealtimeReady: false,
  setOrders: (orders) => set({ orders: sortDesc(orders) }),
  addOrder: (order) =>
    set((state) => {
      if (state.orders.some((o) => o.id === order.id)) return state
      return { orders: sortDesc([order, ...state.orders]) }
    }),
  updateOrder: (order) =>
    set((state) => {
      const exists = state.orders.some((o) => o.id === order.id)
      if (!exists) {
        // Defensive fallback: INSERT event may have been missed before UPDATE arrived
        return { orders: sortDesc([order, ...state.orders]) }
      }
      return { orders: state.orders.map((o) => (o.id === order.id ? order : o)) }
    }),
  markHandled: (orderId) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === orderId ? { ...o, is_handled: true, handled_at: new Date().toISOString() } : o,
      ),
    })),
  setRealtimeReady: (ready) => set({ isRealtimeReady: ready }),
  reset: () => set({ orders: [], isRealtimeReady: false }),
}))
