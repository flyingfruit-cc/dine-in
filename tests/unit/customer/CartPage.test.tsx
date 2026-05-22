import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { CartPageClient } from '@/components/customer/CartPageClient'
import { useCartStore } from '@/stores/cartStore'
import type { CartItem, SelectedVariant } from '@/types/app'
import { makeChrome } from './_fixtures/chromeFixture'

const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockBack = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}))

const mockSubmitOrder = vi.fn()
vi.mock('@/actions/orderActions', () => ({
  submitOrder: (...args: unknown[]) => mockSubmitOrder(...args),
}))

const makeCartItem = (
  cartItemId: string,
  menuItemId: string,
  name: string,
  price_cents: number,
  selectedVariants: SelectedVariant[] = [],
  translations?: Record<string, { name: string; description?: string }>,
): CartItem => ({ cartItemId, menuItemId, name, price_cents, selectedVariants, translations })

const chrome = makeChrome()

function renderClient(lang = 'en', defaultLanguage = 'en') {
  return render(
    <CartPageClient
      restaurantSlug="my-restaurant"
      tableNumber="3"
      lang={lang}
      chrome={chrome}
      defaultLanguage={defaultLanguage}
    />,
  )
}

beforeEach(() => {
  useCartStore.setState({ items: [] })
  mockPush.mockReset()
  mockReplace.mockReset()
  mockBack.mockReset()
  mockSubmitOrder.mockReset()
})

afterEach(() => cleanup())

describe('CartPageClient', () => {
  it('redirects to menu when cart is empty', () => {
    useCartStore.setState({ items: [] })
    renderClient()
    expect(mockReplace).toHaveBeenCalledWith('/my-restaurant/3')
  })

  it('preserves ?lang= on empty-cart redirect when non-default', () => {
    useCartStore.setState({ items: [] })
    renderClient('es', 'en')
    expect(mockReplace).toHaveBeenCalledWith('/my-restaurant/3?lang=es')
  })

  it('renders item names from cart', () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    renderClient()
    expect(screen.getByText('Burger')).toBeDefined()
  })

  it('renders translated names when lang has a translation snapshot', () => {
    useCartStore.setState({
      items: [
        makeCartItem('a', 'm1', 'Burger', 1500, [], { es: { name: 'Hamburguesa' } }),
      ],
    })
    renderClient('es', 'en')
    expect(screen.getByText('Hamburguesa')).toBeDefined()
  })

  it('falls back to stored name when translation absent', () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    renderClient('es', 'en')
    expect(screen.getByText('Burger')).toBeDefined()
  })

  it('shows quantity when same item added twice', () => {
    useCartStore.setState({
      items: [
        makeCartItem('a', 'm1', 'Burger', 1500),
        makeCartItem('b', 'm1', 'Burger', 1500),
      ],
    })
    renderClient()
    expect(screen.getByText('×2')).toBeDefined()
  })

  it('shows quantity 1 for a single unique item', () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    renderClient()
    expect(screen.getByText('×1')).toBeDefined()
  })

  it('shows grand total', () => {
    useCartStore.setState({
      items: [
        makeCartItem('a', 'm1', 'Burger', 1500),
        makeCartItem('b', 'm2', 'Fries', 500),
      ],
    })
    renderClient()
    expect(screen.getByText('$20.00')).toBeDefined()
  })

  it('shows line total per unique line item', () => {
    useCartStore.setState({
      items: [
        makeCartItem('a', 'm1', 'Burger', 1200),
        makeCartItem('b', 'm1', 'Burger', 1200),
        makeCartItem('c', 'm2', 'Fries', 500),
      ],
    })
    renderClient()
    expect(screen.getByText('$24.00')).toBeDefined()
    expect(screen.getByText('$5.00')).toBeDefined()
    expect(screen.getByText('$29.00')).toBeDefined()
  })

  it('renders selected variants below item name', () => {
    const variants: SelectedVariant[] = [
      { groupId: 'g1', groupName: 'Size', optionId: 'o1', optionName: 'Large', price_cents: 1500 },
    ]
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500, variants)] })
    renderClient()
    expect(screen.getByText('Large')).toBeDefined()
  })

  it('remove button calls removeItem on cartStore', () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    renderClient()
    const removeBtn = screen.getByRole('button', { name: /remove one burger/i })
    fireEvent.click(removeBtn)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('removing one of two identical items decrements quantity to 1', () => {
    useCartStore.setState({
      items: [
        makeCartItem('a', 'm1', 'Burger', 1500),
        makeCartItem('b', 'm1', 'Burger', 1500),
      ],
    })
    renderClient()
    const removeBtn = screen.getByRole('button', { name: /remove one burger/i })
    fireEvent.click(removeBtn)
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('redirects to menu when last item is removed', () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    const { rerender } = renderClient()
    fireEvent.click(screen.getByRole('button', { name: /remove one burger/i }))
    useCartStore.setState({ items: [] })
    rerender(
      <CartPageClient
        restaurantSlug="my-restaurant"
        tableNumber="3"
        lang="en"
        chrome={chrome}
        defaultLanguage="en"
      />,
    )
    expect(mockReplace).toHaveBeenCalledWith('/my-restaurant/3')
  })

  it('shows "Place Order" button from chrome bundle', () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    renderClient()
    expect(screen.getByRole('button', { name: 'Place Order' })).toBeDefined()
  })

  it('shows the "Total" label from chrome bundle', () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    renderClient()
    expect(screen.getByText('Total')).toBeDefined()
  })

  it('separates identical items from different variant selections into distinct lines', () => {
    const variantsSmall: SelectedVariant[] = [
      { groupId: 'g1', groupName: 'Size', optionId: 'o1', optionName: 'Small', price_cents: 1000 },
    ]
    const variantsLarge: SelectedVariant[] = [
      { groupId: 'g1', groupName: 'Size', optionId: 'o2', optionName: 'Large', price_cents: 1500 },
    ]
    useCartStore.setState({
      items: [
        makeCartItem('a', 'm1', 'Burger', 1000, variantsSmall),
        makeCartItem('b', 'm1', 'Burger', 1500, variantsLarge),
      ],
    })
    renderClient()
    const quantityBadges = screen.getAllByText('×1')
    expect(quantityBadges).toHaveLength(2)
  })

  it('shows "Add more items" button from chrome bundle', () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    renderClient()
    expect(screen.getByRole('button', { name: /add more items/i })).toBeDefined()
  })

  it('"Add more items" calls router.back()', () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    renderClient()
    fireEvent.click(screen.getByRole('button', { name: /add more items/i }))
    expect(mockBack).toHaveBeenCalled()
  })

  it('Place Order button is disabled and shows loading text during submission', async () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    mockSubmitOrder.mockReturnValue(new Promise(() => {}))
    renderClient()
    const placeOrderBtn = screen.getByRole('button', { name: 'Place Order' })
    await act(async () => {
      fireEvent.click(placeOrderBtn)
    })
    expect(screen.getByRole('button', { name: /placing order/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /placing order/i }).hasAttribute('disabled')).toBe(true)
  })

  it('navigates to order tracking route after successful submitOrder', async () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    mockSubmitOrder.mockResolvedValue({
      success: true,
      data: { id: 'test-order-id', restaurantName: 'Test Restaurant', tableNumber: 3 },
    })
    renderClient()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Place Order' }))
    })
    expect(mockReplace).toHaveBeenCalledWith('/my-restaurant/3/order/test-order-id')
  })

  it('navigates with ?lang= to order tracking when lang is non-default', async () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    mockSubmitOrder.mockResolvedValue({
      success: true,
      data: { id: 'test-order-id', restaurantName: 'Test Restaurant', tableNumber: 3 },
    })
    renderClient('es', 'en')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Place Order' }))
    })
    expect(mockReplace).toHaveBeenCalledWith('/my-restaurant/3/order/test-order-id?lang=es')
  })

  it('submitError message renders on failed submitOrder', async () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    mockSubmitOrder.mockResolvedValue({
      success: false,
      error: "Tap to try again — your order hasn't been sent",
    })
    renderClient()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Place Order' }))
    })
    expect(screen.getByText(/tap to try again/i)).toBeDefined()
  })

  it('button re-enabled after failed submitOrder', async () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    mockSubmitOrder.mockResolvedValue({
      success: false,
      error: "Tap to try again — your order hasn't been sent",
    })
    renderClient()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Place Order' }))
    })
    const btn = screen.getByRole('button', { name: 'Place Order' })
    expect(btn.hasAttribute('disabled')).toBe(false)
  })

  it('cart is cleared after successful submitOrder', async () => {
    useCartStore.setState({ items: [makeCartItem('a', 'm1', 'Burger', 1500)] })
    mockSubmitOrder.mockResolvedValue({
      success: true,
      data: { id: 'test-order-id', restaurantName: 'Test Restaurant', tableNumber: 3 },
    })
    renderClient()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Place Order' }))
    })
    expect(useCartStore.getState().items).toHaveLength(0)
  })
})
