import { create } from 'zustand'
import type { CartItem } from '@/types/app'

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (cartItemId: string) => void
  clearCart: () => void
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (cartItemId) =>
    set((state) => ({ items: state.items.filter((i) => i.cartItemId !== cartItemId) })),
  clearCart: () => set({ items: [] }),
}))
