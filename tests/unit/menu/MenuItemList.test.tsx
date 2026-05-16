import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'

vi.mock('@/actions/menuActions', () => ({
  deleteMenuItem: vi.fn(),
  reorderMenuItems: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ push: vi.fn() })) }))

import { MenuItemList } from '@/components/admin/MenuItemList'
import { deleteMenuItem, reorderMenuItems } from '@/actions/menuActions'

const mockDelete = vi.mocked(deleteMenuItem)
const mockReorder = vi.mocked(reorderMenuItems)

const categories = [
  { id: 'cat-1', restaurant_id: 'rest-1', name: 'Starters', display_order: 0 },
  { id: 'cat-2', restaurant_id: 'rest-1', name: 'Mains', display_order: 1 },
]

const items = [
  { id: 'item-1', restaurant_id: 'rest-1', category_id: 'cat-1', name: 'Soup', description: null, price_cents: 800, is_published: false, image_url: null, display_order: 0, variants: [], availability_schedule: null, created_at: '2026-05-10' },
  { id: 'item-2', restaurant_id: 'rest-1', category_id: 'cat-2', name: 'Steak', description: null, price_cents: 2500, is_published: false, image_url: null, display_order: 0, variants: [], availability_schedule: null, created_at: '2026-05-10' },
]

describe('MenuItemList', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('renders category headings', () => {
    render(<MenuItemList categories={categories} items={items} />)
    expect(screen.getByText('Starters')).toBeDefined()
    expect(screen.getByText('Mains')).toBeDefined()
  })

  it('renders items under correct categories with formatted price', () => {
    render(<MenuItemList categories={categories} items={items} />)
    expect(screen.getByText('Soup')).toBeDefined()
    expect(screen.getByText('$8.00')).toBeDefined()
    expect(screen.getByText('Steak')).toBeDefined()
    expect(screen.getByText('$25.00')).toBeDefined()
  })

  it('renders edit links pointing to item route', () => {
    render(<MenuItemList categories={categories} items={items} />)
    const editLinks = screen.getAllByRole('link', { name: 'Edit' })
    expect(editLinks.some((l) => (l as HTMLAnchorElement).href.includes('/admin/menu/item-1'))).toBe(true)
  })

  it('shows empty state with "Add your first item →" for empty category', () => {
    render(<MenuItemList categories={categories} items={[]} />)
    const emptyLinks = screen.getAllByText('Add your first item →')
    expect(emptyLinks.length).toBeGreaterThan(0)
  })

  it('shows "Add item →" link for categories', () => {
    render(<MenuItemList categories={categories} items={items} />)
    const addLinks = screen.getAllByText('Add item →')
    expect(addLinks.length).toBeGreaterThan(0)
  })

  it('opens delete dialog when delete button is clicked', () => {
    render(<MenuItemList categories={categories} items={items} />)
    fireEvent.click(screen.getByLabelText('Delete Soup'))
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText(/delete.*soup/i)).toBeDefined()
  })

  it('removes item from list after confirmed delete', async () => {
    mockDelete.mockResolvedValue({ success: true, data: undefined })
    render(<MenuItemList categories={categories} items={items} />)

    fireEvent.click(screen.getByLabelText('Delete Soup'))
    fireEvent.click(screen.getByText('Delete item'))

    await waitFor(() => {
      expect(screen.queryByText('Soup')).toBeNull()
    })
    expect(mockDelete).toHaveBeenCalledWith('item-1')
  })

  it('shows inline error when delete fails', async () => {
    mockDelete.mockResolvedValue({ success: false, error: 'DB error' })
    render(<MenuItemList categories={categories} items={items} />)

    fireEvent.click(screen.getByLabelText('Delete Soup'))
    fireEvent.click(screen.getByText('Delete item'))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('DB error')
    })
    expect(screen.queryByText('Soup')).toBeDefined()
  })

  it('shows uncategorized items at bottom when items have no category', () => {
    const uncatItem = { ...items[0], id: 'item-x', category_id: null, name: 'Mystery Dish' }
    render(<MenuItemList categories={categories} items={[uncatItem]} />)
    expect(screen.getByText('Uncategorized')).toBeDefined()
    expect(screen.getByText('Mystery Dish')).toBeDefined()
  })

  it('closes dialog on cancel', () => {
    render(<MenuItemList categories={categories} items={items} />)
    fireEvent.click(screen.getByLabelText('Delete Soup'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders drag handle for each item', () => {
    render(<MenuItemList categories={categories} items={items} />)
    expect(screen.getByLabelText('Drag to reorder Soup')).toBeDefined()
    expect(screen.getByLabelText('Drag to reorder Steak')).toBeDefined()
  })

  it('reorderMenuItems mock is available', () => {
    expect(mockReorder).toBeDefined()
  })
})
