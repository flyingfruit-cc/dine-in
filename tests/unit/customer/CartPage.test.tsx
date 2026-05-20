import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import CartPage from '@/app/[restaurant_slug]/[table_number]/cart/page'
import { useCartStore } from '@/stores/cartStore'
import type { CartItem, SelectedVariant } from '@/types/app'

const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockBack = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ restaurant_slug: 'my-restaurant', table_number: '3' }),
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
): CartItem => ({ cartItemId, menuItemId, name, price_cents, selectedVariants })

beforeEach(() => {
  useCartStore.setState({ items: [] })
  mockPush.mockReset()
  mockReplace.mockReset()
  mockBack.mockReset()
  mockSubmitOrder.mockReset()
})

afterEach(() => cleanup())

describe('CartPage', () => {
  it('redirects to menu when cart is empty', () => {
    useCartStore.setState({ items: [] })
    render(<CartPage />)
    expect(mockReplace).toHaveBeenCalledWith('/my-restaurant/3')
  })

  it('renders item names from cart', () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    render(<CartPage />)
    expect(screen.getByText('Burger')).toBeDefined()
  })

  it('shows quantity when same item added twice', () => {
    useCartStore.setState({
      items: [
        makeCartItem('a', 'm1', 'Burger', 1500),
        makeCartItem('b', 'm1', 'Burger', 1500),
      ],
    })
    render(<CartPage />)
    expect(screen.getByText('×2')).toBeDefined()
  })

  it('shows quantity 1 for a single unique item', () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    render(<CartPage />)
    expect(screen.getByText('×1')).toBeDefined()
  })

  it('shows grand total', () => {
    useCartStore.setState({
      items: [
        makeCartItem('a', 'm1', 'Burger', 1500),
        makeCartItem('b', 'm2', 'Fries', 500),
      ],
    })
    render(<CartPage />)
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
    render(<CartPage />)
    // Burger line: 2 × $12.00 = $24.00 (line total)
    // Fries line: 1 × $5.00 = $5.00
    // Grand total: $29.00
    expect(screen.getByText('$24.00')).toBeDefined()
    expect(screen.getByText('$5.00')).toBeDefined()
    expect(screen.getByText('$29.00')).toBeDefined()
  })

  it('renders selected variants below item name', () => {
    const variants: SelectedVariant[] = [
      { groupId: 'g1', groupName: 'Size', optionId: 'o1', optionName: 'Large', price_cents: 1500 },
    ]
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500, variants)],
    })
    render(<CartPage />)
    expect(screen.getByText('Large')).toBeDefined()
  })

  it('remove button calls removeItem on cartStore', () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    render(<CartPage />)
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
    render(<CartPage />)
    const removeBtn = screen.getByRole('button', { name: /remove one burger/i })
    fireEvent.click(removeBtn)
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('redirects to menu when last item is removed', () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    const { rerender } = render(<CartPage />)
    fireEvent.click(screen.getByRole('button', { name: /remove one burger/i }))
    // Trigger re-render with empty cart
    useCartStore.setState({ items: [] })
    rerender(<CartPage />)
    expect(mockReplace).toHaveBeenCalledWith('/my-restaurant/3')
  })

  it('shows "Place Order" button', () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    render(<CartPage />)
    expect(screen.getByRole('button', { name: /place order/i })).toBeDefined()
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
    render(<CartPage />)
    // Should be 2 separate lines, each with quantity ×1
    const quantityBadges = screen.getAllByText('×1')
    expect(quantityBadges).toHaveLength(2)
  })

  it('shows "Add more items" button in header', () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    render(<CartPage />)
    expect(screen.getByRole('button', { name: /add more items/i })).toBeDefined()
  })

  it('"Add more items" calls router.back()', () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    render(<CartPage />)
    fireEvent.click(screen.getByRole('button', { name: /add more items/i }))
    expect(mockBack).toHaveBeenCalled()
  })

  it('Place Order button is disabled and shows loading text during submission', async () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    // submitOrder never resolves during this test
    mockSubmitOrder.mockReturnValue(new Promise(() => {}))
    render(<CartPage />)
    const placeOrderBtn = screen.getByRole('button', { name: /place order/i })
    await act(async () => {
      fireEvent.click(placeOrderBtn)
    })
    expect(screen.getByRole('button', { name: /placing order/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /placing order/i }).hasAttribute('disabled')).toBe(true)
  })

  it('navigates to order tracking route after successful submitOrder', async () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    mockSubmitOrder.mockResolvedValue({
      success: true,
      data: { id: 'test-order-id', restaurantName: 'Test Restaurant', tableNumber: 3 },
    })
    render(<CartPage />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /place order/i }))
    })
    expect(mockReplace).toHaveBeenCalledWith('/my-restaurant/3/order/test-order-id')
  })

  it('submitError message renders on failed submitOrder', async () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    mockSubmitOrder.mockResolvedValue({
      success: false,
      error: "Tap to try again — your order hasn't been sent",
    })
    render(<CartPage />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /place order/i }))
    })
    expect(screen.getByText(/tap to try again/i)).toBeDefined()
  })

  it('button re-enabled after failed submitOrder', async () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    mockSubmitOrder.mockResolvedValue({
      success: false,
      error: "Tap to try again — your order hasn't been sent",
    })
    render(<CartPage />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /place order/i }))
    })
    const btn = screen.getByRole('button', { name: /place order/i })
    expect(btn.hasAttribute('disabled')).toBe(false)
  })

  it('cart is cleared after successful submitOrder', async () => {
    useCartStore.setState({
      items: [makeCartItem('a', 'm1', 'Burger', 1500)],
    })
    mockSubmitOrder.mockResolvedValue({
      success: true,
      data: { id: 'test-order-id', restaurantName: 'Test Restaurant', tableNumber: 3 },
    })
    render(<CartPage />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /place order/i }))
    })
    expect(useCartStore.getState().items).toHaveLength(0)
  })
})
