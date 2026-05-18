import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from '@/stores/cartStore'
import type { CartItem } from '@/types/app'

const makeItem = (cartItemId: string, price_cents = 1000): CartItem => ({
  cartItemId,
  menuItemId: 'menu-item-1',
  name: 'Test Item',
  price_cents,
  selectedVariants: [],
})

beforeEach(() => {
  useCartStore.setState({ items: [] })
})

describe('cartStore', () => {
  it('starts with empty items array', () => {
    expect(useCartStore.getState().items).toEqual([])
  })

  it('addItem appends to items array', () => {
    useCartStore.getState().addItem(makeItem('a'))
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].cartItemId).toBe('a')
  })

  it('multiple addItem calls with same item create separate line entries', () => {
    const item = makeItem('a')
    useCartStore.getState().addItem(item)
    useCartStore.getState().addItem(item)
    expect(useCartStore.getState().items).toHaveLength(2)
  })

  it('addItem preserves existing items', () => {
    useCartStore.getState().addItem(makeItem('a'))
    useCartStore.getState().addItem(makeItem('b'))
    const ids = useCartStore.getState().items.map((i) => i.cartItemId)
    expect(ids).toEqual(['a', 'b'])
  })

  it('removeItem removes only the item with matching cartItemId', () => {
    useCartStore.getState().addItem(makeItem('a'))
    useCartStore.getState().addItem(makeItem('b'))
    useCartStore.getState().removeItem('a')
    const ids = useCartStore.getState().items.map((i) => i.cartItemId)
    expect(ids).toEqual(['b'])
  })

  it('removeItem with unknown id leaves items unchanged', () => {
    useCartStore.getState().addItem(makeItem('a'))
    useCartStore.getState().removeItem('nonexistent')
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('clearCart resets items to empty array', () => {
    useCartStore.getState().addItem(makeItem('a'))
    useCartStore.getState().addItem(makeItem('b'))
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().items).toEqual([])
  })
})
