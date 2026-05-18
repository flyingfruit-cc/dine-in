import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OrderConfirmationScreen } from '@/components/customer/OrderConfirmationScreen'

afterEach(() => cleanup())

const defaultItems = [
  { name: 'Burger', quantity: 2, variantNames: ['Large'] },
  { name: 'Fries', quantity: 1, variantNames: [] },
]

describe('OrderConfirmationScreen', () => {
  it('renders headline "Your order is with the kitchen"', () => {
    render(<OrderConfirmationScreen restaurantName="Test Restaurant" tableNumber={3} items={defaultItems} />)
    expect(screen.getByText('Your order is with the kitchen')).toBeDefined()
  })

  it('renders each item name with quantity prefix', () => {
    render(<OrderConfirmationScreen restaurantName="Test Restaurant" tableNumber={3} items={defaultItems} />)
    expect(screen.getByText('2× Burger')).toBeDefined()
    expect(screen.getByText('1× Fries')).toBeDefined()
  })

  it('renders variant names below item name', () => {
    render(<OrderConfirmationScreen restaurantName="Test Restaurant" tableNumber={3} items={defaultItems} />)
    expect(screen.getByText('Large')).toBeDefined()
  })

  it('renders restaurant name and table number', () => {
    render(<OrderConfirmationScreen restaurantName="Test Restaurant" tableNumber={3} items={defaultItems} />)
    expect(screen.getByText('Test Restaurant · Table 3')).toBeDefined()
  })

  it('does NOT render any price', () => {
    render(<OrderConfirmationScreen restaurantName="Test Restaurant" tableNumber={3} items={defaultItems} />)
    expect(screen.queryByText(/\$/)).toBeNull()
  })

  it('renders no interactive buttons or links (closed loop)', () => {
    render(<OrderConfirmationScreen restaurantName="Test Restaurant" tableNumber={3} items={defaultItems} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('headline has aria-live="assertive"', () => {
    render(<OrderConfirmationScreen restaurantName="Test Restaurant" tableNumber={3} items={defaultItems} />)
    const headline = screen.getByText('Your order is with the kitchen')
    expect(headline.getAttribute('aria-live')).toBe('assertive')
  })

  it('headline has tabIndex={-1}', () => {
    render(<OrderConfirmationScreen restaurantName="Test Restaurant" tableNumber={3} items={defaultItems} />)
    const headline = screen.getByText('Your order is with the kitchen')
    expect(headline.getAttribute('tabindex')).toBe('-1')
  })
})
