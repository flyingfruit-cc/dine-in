import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ItemConfigSheet } from '@/components/customer/ItemConfigSheet'
import { useCartStore } from '@/stores/cartStore'
import type { MenuItem } from '@/types/app'

// jsdom doesn't implement showModal/close on <dialog> — mock them so content is accessible
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  useCartStore.setState({ items: [] })
})

afterEach(() => cleanup())

const baseItem: MenuItem = {
  id: 'item-1',
  restaurant_id: 'rest-1',
  category_id: 'cat-1',
  name: 'Grilled Salmon',
  description: 'Fresh Atlantic salmon with herbs',
  price_cents: 2200,
  image_url: null,
  display_order: 0,
  variants: [],
  availability_schedule: null,
  created_at: '2026-05-18',
  translations: {},
}

const itemWithVariants: MenuItem = {
  ...baseItem,
  id: 'item-2',
  name: 'Burger',
  price_cents: 1200,
  variants: [
    {
      id: 'grp-size',
      name: 'Size',
      options: [
        { id: 'opt-sm', name: 'Small', price_cents: 1200 },
        { id: 'opt-lg', name: 'Large', price_cents: 1500 },
      ],
    },
  ],
}

describe('ItemConfigSheet', () => {
  it('renders item name and description when item is provided', () => {
    render(<ItemConfigSheet item={baseItem} onClose={vi.fn()} />)
    expect(screen.getByText('Grilled Salmon')).toBeDefined()
    expect(screen.getByText('Fresh Atlantic salmon with herbs')).toBeDefined()
  })

  it('renders item price when item is provided', () => {
    render(<ItemConfigSheet item={baseItem} onClose={vi.fn()} />)
    expect(screen.getByText('$22.00')).toBeDefined()
  })

  it('calls showModal when item is provided', () => {
    render(<ItemConfigSheet item={baseItem} onClose={vi.fn()} />)
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
  })

  it('does not render item content when item is null', () => {
    render(<ItemConfigSheet item={null} onClose={vi.fn()} />)
    expect(screen.queryByText('Grilled Salmon')).toBeNull()
  })

  it('shows no variant section when item has no variants', () => {
    render(<ItemConfigSheet item={baseItem} onClose={vi.fn()} />)
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('renders variant group name and options when item has variants', () => {
    render(<ItemConfigSheet item={itemWithVariants} onClose={vi.fn()} />)
    expect(screen.getByText('Size')).toBeDefined()
    expect(screen.getByText('Small')).toBeDefined()
    expect(screen.getByText('Large')).toBeDefined()
  })

  it('auto-selects first option of each variant group on render', () => {
    render(<ItemConfigSheet item={itemWithVariants} onClose={vi.fn()} />)
    const smallBtn = screen.getByText('Small').closest('button')
    expect(smallBtn?.getAttribute('aria-pressed')).toBe('true')
    const largeBtn = screen.getByText('Large').closest('button')
    expect(largeBtn?.getAttribute('aria-pressed')).toBe('false')
  })

  it('selecting a variant option updates aria-pressed state', () => {
    render(<ItemConfigSheet item={itemWithVariants} onClose={vi.fn()} />)
    const largeBtn = screen.getByText('Large').closest('button')!
    fireEvent.click(largeBtn)
    expect(largeBtn.getAttribute('aria-pressed')).toBe('true')
    const smallBtn = screen.getByText('Small').closest('button')!
    expect(smallBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('selecting Large option updates displayed price to Large price', () => {
    render(<ItemConfigSheet item={itemWithVariants} onClose={vi.fn()} />)
    // Initially shows Small price ($12.00)
    expect(screen.getByText('$12.00')).toBeDefined()
    fireEvent.click(screen.getByText('Large').closest('button')!)
    expect(screen.getByText('$15.00')).toBeDefined()
  })

  it('clicking Add to Order calls useCartStore addItem with correct shape', () => {
    render(<ItemConfigSheet item={baseItem} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add to Order' }))
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].menuItemId).toBe('item-1')
    expect(items[0].name).toBe('Grilled Salmon')
    expect(items[0].price_cents).toBe(2200)
    expect(items[0].selectedVariants).toEqual([])
    expect(typeof items[0].cartItemId).toBe('string')
  })

  it('clicking Add to Order with variant includes selected variant in CartItem', () => {
    render(<ItemConfigSheet item={itemWithVariants} onClose={vi.fn()} />)
    // Select Large
    fireEvent.click(screen.getByText('Large').closest('button')!)
    fireEvent.click(screen.getByRole('button', { name: 'Add to Order' }))
    const items = useCartStore.getState().items
    expect(items[0].price_cents).toBe(1500)
    expect(items[0].selectedVariants).toHaveLength(1)
    expect(items[0].selectedVariants[0].optionName).toBe('Large')
    expect(items[0].selectedVariants[0].price_cents).toBe(1500)
  })

  it('clicking Add to Order calls onClose', () => {
    const onClose = vi.fn()
    render(<ItemConfigSheet item={baseItem} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add to Order' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking backdrop (dialog element itself) calls onClose without adding to cart', () => {
    const onClose = vi.fn()
    const { container } = render(<ItemConfigSheet item={baseItem} onClose={onClose} />)
    const dialog = container.querySelector('dialog')!
    // Simulate backdrop click: target is the dialog element itself
    fireEvent.click(dialog, { target: dialog })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(useCartStore.getState().items).toHaveLength(0)
  })
})
