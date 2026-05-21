import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

vi.mock('@/utils/isAvailable', () => ({
  isItemAvailable: vi.fn().mockReturnValue(true),
}))

import { MenuPreview } from '@/components/admin/MenuPreview'
import { isItemAvailable } from '@/utils/isAvailable'

const mockIsAvailable = vi.mocked(isItemAvailable)

const categories = [
  { id: 'cat-1', restaurant_id: 'rest-1', name: 'Starters', display_order: 0 },
  { id: 'cat-2', restaurant_id: 'rest-1', name: 'Mains', display_order: 1 },
]

const items = [
  {
    id: 'item-1',
    restaurant_id: 'rest-1',
    category_id: 'cat-1',
    name: 'Soup',
    description: 'Tomato soup',
    price_cents: 800,
    image_url: null,
    display_order: 0,
    variants: [],
    availability_schedule: null,
    created_at: '2026-05-10',
    translations: {},
  },
  {
    id: 'item-2',
    restaurant_id: 'rest-1',
    category_id: 'cat-2',
    name: 'Steak',
    description: null,
    price_cents: 2500,
    image_url: null,
    display_order: 0,
    variants: [{ id: 'v-1', name: 'Size', options: [] }],
    availability_schedule: null,
    created_at: '2026-05-10',
    translations: {},
  },
]

let intersectionCallback: IntersectionObserverCallback | null = null
const observeMock = vi.fn()
const disconnectMock = vi.fn()

describe('MenuPreview', () => {
  beforeEach(() => {
    mockIsAvailable.mockReturnValue(true)
    intersectionCallback = null
    observeMock.mockClear()
    disconnectMock.mockClear()
    class MockIO {
      constructor(cb: IntersectionObserverCallback) { intersectionCallback = cb }
      observe = observeMock
      disconnect = disconnectMock
      unobserve = vi.fn()
    }
    vi.stubGlobal('IntersectionObserver', MockIO)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('renders category names', () => {
    render(<MenuPreview categories={categories} items={items} />)
    expect(screen.getAllByText('Starters').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mains').length).toBeGreaterThan(0)
  })

  it('renders item names', () => {
    render(<MenuPreview categories={categories} items={items} />)
    expect(screen.getByText('Soup')).toBeDefined()
    expect(screen.getByText('Steak')).toBeDefined()
  })

  it('renders formatted price for each item', () => {
    render(<MenuPreview categories={categories} items={items} />)
    expect(screen.getByText('$8.00')).toBeDefined()
    expect(screen.getByText('$25.00')).toBeDefined()
  })

  it('renders item description when present', () => {
    render(<MenuPreview categories={categories} items={items} />)
    expect(screen.getByText('Tomato soup')).toBeDefined()
  })

  it('renders variant group names when present', () => {
    render(<MenuPreview categories={categories} items={items} />)
    expect(screen.getByText('Size')).toBeDefined()
  })

  it('shows "Not available right now" for unavailable items', () => {
    mockIsAvailable.mockReturnValue(false)
    render(<MenuPreview categories={categories} items={items} />)
    const badges = screen.getAllByText('Not available right now')
    expect(badges.length).toBe(items.length)
  })

  it('does not show unavailability badge for available items', () => {
    mockIsAvailable.mockReturnValue(true)
    render(<MenuPreview categories={categories} items={items} />)
    expect(screen.queryByText('Not available right now')).toBeNull()
  })

  it('shows "No items yet" for an empty category', () => {
    render(<MenuPreview categories={categories} items={[]} />)
    const emptyMessages = screen.getAllByText('No items yet')
    expect(emptyMessages.length).toBe(2)
  })

  it('shows Uncategorized section when items have no category', () => {
    const uncatItem = { ...items[0], id: 'item-x', category_id: null, name: 'Mystery Dish' }
    render(<MenuPreview categories={[]} items={[uncatItem]} />)
    expect(screen.getAllByText('Uncategorized').length).toBeGreaterThan(0)
    expect(screen.getByText('Mystery Dish')).toBeDefined()
  })

  it('has no Edit link anywhere in output', () => {
    render(<MenuPreview categories={categories} items={items} />)
    expect(screen.queryByRole('link', { name: /edit/i })).toBeNull()
    expect(screen.queryByText('Edit')).toBeNull()
  })

  it('has no Delete button anywhere in output', () => {
    render(<MenuPreview categories={categories} items={items} />)
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
    expect(screen.queryByText('Delete')).toBeNull()
  })

  it('has no drag-to-reorder controls', () => {
    render(<MenuPreview categories={categories} items={items} />)
    expect(screen.queryByLabelText(/drag to reorder/i)).toBeNull()
  })

  it('updates active tab when a section scrolls into view', () => {
    render(<MenuPreview categories={categories} items={items} />)

    // Initially Starters tab is active (first category)
    expect(screen.getByRole('button', { name: 'Starters' }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('button', { name: 'Mains' }).getAttribute('aria-current')).toBeNull()

    // Simulate Mains section scrolling into view while Starters scrolls out
    const mainsSection = document.getElementById('cat-2')!
    act(() => {
      intersectionCallback!(
        [{ isIntersecting: true, target: mainsSection } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    expect(screen.getByRole('button', { name: 'Mains' }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('button', { name: 'Starters' }).getAttribute('aria-current')).toBeNull()
  })

  it('registers IntersectionObserver on mount and disconnects on unmount', () => {
    const { unmount } = render(<MenuPreview categories={categories} items={items} />)
    expect(observeMock).toHaveBeenCalledTimes(categories.length)
    unmount()
    expect(disconnectMock).toHaveBeenCalledTimes(1)
  })
})
