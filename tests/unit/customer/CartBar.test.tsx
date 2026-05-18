import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CartBar } from '@/components/customer/CartBar'
import { useCartStore } from '@/stores/cartStore'
import type { CartItem } from '@/types/app'

const makeCartItem = (cartItemId: string, price_cents: number): CartItem => ({
  cartItemId,
  menuItemId: 'menu-1',
  name: 'Test Item',
  price_cents,
  selectedVariants: [],
})

beforeEach(() => {
  useCartStore.setState({ items: [] })
})

afterEach(() => cleanup())

describe('CartBar', () => {
  it('renders nothing when cart is empty', () => {
    const { container } = render(<CartBar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders when cart has one item', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500)] })
    render(<CartBar />)
    expect(screen.getByRole('complementary')).toBeDefined()
  })

  it('shows item count', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500), makeCartItem('b', 1000)] })
    render(<CartBar />)
    expect(screen.getByText('2')).toBeDefined()
  })

  it('shows "Review Order" label', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500)] })
    render(<CartBar />)
    expect(screen.getByText('Review Order')).toBeDefined()
  })

  it('shows formatted total price', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500), makeCartItem('b', 1000)] })
    render(<CartBar />)
    expect(screen.getByText('$25.00')).toBeDefined()
  })

  it('aria-label reflects count and total', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500), makeCartItem('b', 1000)] })
    render(<CartBar />)
    const bar = screen.getByRole('complementary')
    expect(bar.getAttribute('aria-label')).toBe('Cart: 2 items, $25.00')
  })

  it('single item: aria-label has count 1', () => {
    useCartStore.setState({ items: [makeCartItem('a', 2200)] })
    render(<CartBar />)
    const bar = screen.getByRole('complementary')
    expect(bar.getAttribute('aria-label')).toBe('Cart: 1 item, $22.00')
  })
})
