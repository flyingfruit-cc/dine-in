import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ItemConfigSheet } from '@/components/customer/ItemConfigSheet'
import { useCartStore } from '@/stores/cartStore'
import type { MenuItem } from '@/types/app'
import { makeChrome } from './_fixtures/chromeFixture'

const chrome = makeChrome()

function renderSheet(item: MenuItem | null, onClose = vi.fn(), lang = 'en') {
  return render(<ItemConfigSheet item={item} lang={lang} chrome={chrome} onClose={onClose} />)
}

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
    renderSheet(baseItem)
    expect(screen.getByText('Grilled Salmon')).toBeDefined()
    expect(screen.getByText('Fresh Atlantic salmon with herbs')).toBeDefined()
  })

  it('renders item price when item is provided', () => {
    renderSheet(baseItem)
    expect(screen.getByText('$22.00')).toBeDefined()
  })

  it('calls showModal when item is provided', () => {
    renderSheet(baseItem)
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
  })

  it('does not render item content when item is null', () => {
    renderSheet(null)
    expect(screen.queryByText('Grilled Salmon')).toBeNull()
  })

  it('shows no variant section when item has no variants', () => {
    renderSheet(baseItem)
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('renders variant group name and options when item has variants', () => {
    renderSheet(itemWithVariants)
    expect(screen.getByText('Size')).toBeDefined()
    expect(screen.getByText('Small')).toBeDefined()
    expect(screen.getByText('Large')).toBeDefined()
  })

  it('auto-selects first option of each variant group on render', () => {
    renderSheet(itemWithVariants)
    const smallBtn = screen.getByText('Small').closest('button')
    expect(smallBtn?.getAttribute('aria-pressed')).toBe('true')
    const largeBtn = screen.getByText('Large').closest('button')
    expect(largeBtn?.getAttribute('aria-pressed')).toBe('false')
  })

  it('selecting a variant option updates aria-pressed state', () => {
    renderSheet(itemWithVariants)
    const largeBtn = screen.getByText('Large').closest('button')!
    fireEvent.click(largeBtn)
    expect(largeBtn.getAttribute('aria-pressed')).toBe('true')
    const smallBtn = screen.getByText('Small').closest('button')!
    expect(smallBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('selecting Large option updates displayed price to Large price', () => {
    renderSheet(itemWithVariants)
    // Initially shows Small price ($12.00)
    expect(screen.getByText('$12.00')).toBeDefined()
    fireEvent.click(screen.getByText('Large').closest('button')!)
    expect(screen.getByText('$15.00')).toBeDefined()
  })

  it('clicking Add to Order calls useCartStore addItem with correct shape', () => {
    renderSheet(baseItem)
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
    renderSheet(itemWithVariants)
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
    renderSheet(baseItem, onClose)
    fireEvent.click(screen.getByRole('button', { name: 'Add to Order' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking backdrop (dialog element itself) calls onClose without adding to cart', () => {
    const onClose = vi.fn()
    const { container } = renderSheet(baseItem, onClose)
    const dialog = container.querySelector('dialog')!
    // Simulate backdrop click: target is the dialog element itself
    fireEvent.click(dialog, { target: dialog })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('renders the translated name + description when lang has a translation', () => {
    const translated = {
      ...baseItem,
      translations: { es: { name: 'Salmón a la Plancha', description: 'Salmón con hierbas' } },
    }
    renderSheet(translated, vi.fn(), 'es')
    expect(screen.getByText('Salmón a la Plancha')).toBeDefined()
    expect(screen.getByText('Salmón con hierbas')).toBeDefined()
  })

  it('falls back to default columns when the active-language translation is missing', () => {
    renderSheet(baseItem, vi.fn(), 'es')
    expect(screen.getByText('Grilled Salmon')).toBeDefined()
    expect(screen.getByText('Fresh Atlantic salmon with herbs')).toBeDefined()
  })

  it('add-to-cart payload includes the full translations snapshot', () => {
    const translated = {
      ...baseItem,
      translations: { es: { name: 'Salmón', description: 'Salmón con hierbas' } },
    }
    renderSheet(translated, vi.fn(), 'en')
    fireEvent.click(screen.getByRole('button', { name: 'Add to Order' }))
    const items = useCartStore.getState().items
    expect(items[0].translations).toEqual({ es: { name: 'Salmón', description: 'Salmón con hierbas' } })
  })
})
