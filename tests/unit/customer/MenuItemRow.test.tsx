import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { MenuItemRow } from '@/components/customer/MenuItemRow'
import type { MenuItem } from '@/types/app'
import { makeChrome } from './_fixtures/chromeFixture'

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
  translations: {},
}

const chrome = makeChrome()

function renderRow(overrides: Partial<{ item: MenuItem; isAvailable: boolean; lang: string; onTap: () => void }> = {}) {
  const {
    item = baseItem,
    isAvailable = true,
    lang = 'en',
    onTap,
  } = overrides
  return render(
    <MenuItemRow item={item} isAvailable={isAvailable} lang={lang} chrome={chrome} onTap={onTap} />,
  )
}

afterEach(() => cleanup())

describe('MenuItemRow', () => {
  it('renders item name, price, and description for an available item', () => {
    renderRow()
    expect(screen.getByText('Grilled Salmon')).toBeDefined()
    expect(screen.getByText('$22.00')).toBeDefined()
    expect(screen.getByText('Fresh Atlantic salmon')).toBeDefined()
  })

  it('shows "Not available right now" label and aria-disabled for unavailable item', () => {
    renderRow({ isAvailable: false })
    expect(screen.getByText('Not available right now')).toBeDefined()
    const row = screen.getByRole('button')
    expect(row.getAttribute('aria-disabled')).toBe('true')
  })

  it('does not show unavailability label when item is available', () => {
    renderRow()
    expect(screen.queryByText('Not available right now')).toBeNull()
    const row = screen.getByRole('button')
    expect(row.getAttribute('aria-disabled')).toBeNull()
  })

  it('renders placeholder (no img element) when item has no image', () => {
    renderRow({ item: { ...baseItem, image_url: null } })
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders img element when item has an image', () => {
    renderRow({ item: { ...baseItem, image_url: 'https://example.com/food.jpg' } })
    const img = screen.getByRole('img')
    expect(img).toBeDefined()
    expect((img as HTMLImageElement).src).toContain('food.jpg')
  })

  it('calls onTap when row is clicked', () => {
    const onTap = vi.fn()
    renderRow({ onTap })
    fireEvent.click(screen.getByRole('button'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('calls onTap when Enter key is pressed', () => {
    const onTap = vi.fn()
    renderRow({ onTap })
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('calls onTap when Space key is pressed', () => {
    const onTap = vi.fn()
    renderRow({ onTap })
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('does not throw when onTap is undefined and row is clicked', () => {
    renderRow()
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
  })

  it('has correct aria-label with name and formatted price', () => {
    renderRow()
    const row = screen.getByRole('button')
    expect(row.getAttribute('aria-label')).toBe('Grilled Salmon, $22.00')
  })

  it('unavailable item does not call onTap when clicked', () => {
    const onTap = vi.fn()
    renderRow({ isAvailable: false, onTap })
    fireEvent.click(screen.getByRole('button'))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('unavailable item does not call onTap on Enter key', () => {
    const onTap = vi.fn()
    renderRow({ isAvailable: false, onTap })
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(onTap).not.toHaveBeenCalled()
  })

  it('unavailable item does not call onTap on Space key', () => {
    const onTap = vi.fn()
    renderRow({ isAvailable: false, onTap })
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    expect(onTap).not.toHaveBeenCalled()
  })

  it('item with null availability_schedule renders as available', () => {
    renderRow({ item: { ...baseItem, availability_schedule: null } })
    expect(screen.queryByText('Not available right now')).toBeNull()
    const row = screen.getByRole('button')
    expect(row.getAttribute('aria-disabled')).toBeNull()
  })

  it('renders the translated name when translations exist for active lang', () => {
    renderRow({
      item: {
        ...baseItem,
        translations: { es: { name: 'Salmón a la Plancha', description: 'Salmón atlántico fresco' } },
      },
      lang: 'es',
    })
    expect(screen.getByText('Salmón a la Plancha')).toBeDefined()
    expect(screen.getByText('Salmón atlántico fresco')).toBeDefined()
  })

  it('falls back to default columns when translation absent', () => {
    renderRow({
      item: { ...baseItem, translations: {} },
      lang: 'es',
    })
    expect(screen.getByText('Grilled Salmon')).toBeDefined()
    expect(screen.getByText('Fresh Atlantic salmon')).toBeDefined()
  })

  it('"Not available right now" label uses chrome bundle', () => {
    renderRow({ isAvailable: false })
    expect(screen.getByText('Not available right now')).toBeDefined()
  })
})
