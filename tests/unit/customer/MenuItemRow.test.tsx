import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { MenuItemRow } from '@/components/customer/MenuItemRow'
import type { MenuItem } from '@/types/app'

const baseItem: MenuItem = {
  id: 'item-1',
  restaurant_id: 'rest-1',
  category_id: 'cat-1',
  name: 'Grilled Salmon',
  description: 'Fresh Atlantic salmon',
  price_cents: 2200,
  image_url: null,
  display_order: 0,
  variants: [],
  availability_schedule: null,
  created_at: '2026-05-17',
}

afterEach(() => cleanup())

describe('MenuItemRow', () => {
  it('renders item name, price, and description for an available item', () => {
    render(<MenuItemRow item={baseItem} isAvailable={true} />)
    expect(screen.getByText('Grilled Salmon')).toBeDefined()
    expect(screen.getByText('$22.00')).toBeDefined()
    expect(screen.getByText('Fresh Atlantic salmon')).toBeDefined()
  })

  it('shows "Not available right now" label and aria-disabled for unavailable item', () => {
    render(<MenuItemRow item={baseItem} isAvailable={false} />)
    expect(screen.getByText('Not available right now')).toBeDefined()
    const row = screen.getByRole('button')
    expect(row.getAttribute('aria-disabled')).toBe('true')
  })

  it('does not show unavailability label when item is available', () => {
    render(<MenuItemRow item={baseItem} isAvailable={true} />)
    expect(screen.queryByText('Not available right now')).toBeNull()
    const row = screen.getByRole('button')
    expect(row.getAttribute('aria-disabled')).toBeNull()
  })

  it('renders placeholder (no img element) when item has no image', () => {
    render(<MenuItemRow item={{ ...baseItem, image_url: null }} isAvailable={true} />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders img element when item has an image', () => {
    render(<MenuItemRow item={{ ...baseItem, image_url: 'https://example.com/food.jpg' }} isAvailable={true} />)
    const img = screen.getByRole('img')
    expect(img).toBeDefined()
    expect((img as HTMLImageElement).src).toContain('food.jpg')
  })

  it('calls onTap when row is clicked', () => {
    const onTap = vi.fn()
    render(<MenuItemRow item={baseItem} isAvailable={true} onTap={onTap} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('calls onTap when Enter key is pressed', () => {
    const onTap = vi.fn()
    render(<MenuItemRow item={baseItem} isAvailable={true} onTap={onTap} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('calls onTap when Space key is pressed', () => {
    const onTap = vi.fn()
    render(<MenuItemRow item={baseItem} isAvailable={true} onTap={onTap} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('does not throw when onTap is undefined and row is clicked', () => {
    render(<MenuItemRow item={baseItem} isAvailable={true} />)
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
  })

  it('has correct aria-label with name and formatted price', () => {
    render(<MenuItemRow item={baseItem} isAvailable={true} />)
    const row = screen.getByRole('button')
    expect(row.getAttribute('aria-label')).toBe('Grilled Salmon, $22.00')
  })

  // Availability interaction guard tests (story 4-2)
  it('unavailable item does not call onTap when clicked', () => {
    const onTap = vi.fn()
    render(<MenuItemRow item={baseItem} isAvailable={false} onTap={onTap} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('unavailable item does not call onTap on Enter key', () => {
    const onTap = vi.fn()
    render(<MenuItemRow item={baseItem} isAvailable={false} onTap={onTap} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(onTap).not.toHaveBeenCalled()
  })

  it('unavailable item does not call onTap on Space key', () => {
    const onTap = vi.fn()
    render(<MenuItemRow item={baseItem} isAvailable={false} onTap={onTap} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    expect(onTap).not.toHaveBeenCalled()
  })

  it('item with null availability_schedule renders as available', () => {
    render(<MenuItemRow item={{ ...baseItem, availability_schedule: null }} isAvailable={true} />)
    expect(screen.queryByText('Not available right now')).toBeNull()
    const row = screen.getByRole('button')
    expect(row.getAttribute('aria-disabled')).toBeNull()
  })
})
