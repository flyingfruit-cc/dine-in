import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AnalyticsPopularItems } from '@/components/admin/AnalyticsPopularItems'
import type { TopItem } from '@/types/app'

afterEach(() => cleanup())

function makeItem(name: string, quantity = 10, revenueCents = 1000): TopItem {
  return { name, quantity, revenueCents, variants: { standard: quantity } }
}

function makeItems(count: number): TopItem[] {
  return Array.from({ length: count }, (_, i) => makeItem(`Item ${i + 1}`, 100 - i))
}

describe('AnalyticsPopularItems', () => {
  it('renders defensive empty-state when items array is empty', () => {
    render(<AnalyticsPopularItems items={[]} />)
    expect(screen.getByText('No items sold yet in this period')).toBeTruthy()
  })

  it('renders the "Popular Items" heading', () => {
    render(<AnalyticsPopularItems items={[makeItem('Burger')]} />)
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Popular Items')
  })

  it('renders at most 10 rows when given 50 items', () => {
    render(<AnalyticsPopularItems items={makeItems(50)} />)
    const listItems = screen.getAllByRole('listitem')
    expect(listItems.length).toBe(10)
  })

  it('renders exactly the count of items when given fewer than 10', () => {
    render(<AnalyticsPopularItems items={makeItems(3)} />)
    const listItems = screen.getAllByRole('listitem')
    expect(listItems.length).toBe(3)
  })

  it('assigns ranks starting at 1 for each row', () => {
    render(<AnalyticsPopularItems items={makeItems(3)} />)
    // Each row shows its rank number; ranks 1, 2, 3 should all be present
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('region is labelled by the visible "Popular Items" heading', () => {
    render(<AnalyticsPopularItems items={[makeItem('Pizza')]} />)
    const region = screen.getByRole('region', { name: 'Popular Items' })
    expect(region).toBeTruthy()
  })

  it('list has role="list"', () => {
    render(<AnalyticsPopularItems items={[makeItem('Pizza')]} />)
    expect(screen.getByRole('list')).toBeTruthy()
  })
})
