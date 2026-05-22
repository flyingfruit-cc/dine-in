import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CartBar } from '@/components/customer/CartBar'
import { useCartStore } from '@/stores/cartStore'
import type { CartItem } from '@/types/app'
import { makeChrome } from './_fixtures/chromeFixture'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ restaurant_slug: 'test-restaurant', table_number: '5' }),
  useRouter: () => ({ push: mockPush }),
}))

const makeCartItem = (cartItemId: string, price_cents: number): CartItem => ({
  cartItemId,
  menuItemId: 'menu-1',
  name: 'Test Item',
  price_cents,
  selectedVariants: [],
})

const chrome = makeChrome()

function renderBar(lang = 'en', defaultLanguage = 'en') {
  return render(<CartBar lang={lang} chrome={chrome} defaultLanguage={defaultLanguage} />)
}

beforeEach(() => {
  useCartStore.setState({ items: [] })
  mockPush.mockReset()
})

afterEach(() => cleanup())

describe('CartBar', () => {
  it('renders nothing when cart is empty', () => {
    const { container } = renderBar()
    expect(container.firstChild).toBeNull()
  })

  it('renders complementary landmark when cart has items', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500)] })
    renderBar()
    expect(screen.getByRole('complementary')).toBeDefined()
  })

  it('contains a keyboard-activatable button', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500)] })
    renderBar()
    expect(screen.getByRole('button')).toBeDefined()
  })

  it('shows item count', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500), makeCartItem('b', 1000)] })
    renderBar()
    expect(screen.getByText('2')).toBeDefined()
  })

  it('shows "Review Order" label from chrome bundle', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500)] })
    renderBar()
    expect(screen.getByText('Review Order')).toBeDefined()
  })

  it('shows formatted total price', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500), makeCartItem('b', 1000)] })
    renderBar()
    expect(screen.getByText('$25.00')).toBeDefined()
  })

  it('button aria-label reflects count and total', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500), makeCartItem('b', 1000)] })
    renderBar()
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toContain('Cart: 2 items, $25.00')
  })

  it('button aria-label uses singular "item" for count of 1', () => {
    useCartStore.setState({ items: [makeCartItem('a', 2200)] })
    renderBar()
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toContain('Cart: 1 item, $22.00')
  })

  it('clicking the button navigates to the cart page without ?lang= when lang is default', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500)] })
    renderBar('en', 'en')
    fireEvent.click(screen.getByRole('button'))
    expect(mockPush).toHaveBeenCalledWith('/test-restaurant/5/cart')
  })

  it('clicking the button navigates with ?lang= when lang is non-default', () => {
    useCartStore.setState({ items: [makeCartItem('a', 1500)] })
    renderBar('es', 'en')
    fireEvent.click(screen.getByRole('button'))
    expect(mockPush).toHaveBeenCalledWith('/test-restaurant/5/cart?lang=es')
  })
})
