import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { AnalyticsPopularItemRow } from '@/components/admin/AnalyticsPopularItemRow'
import type { TopItem } from '@/types/app'

afterEach(() => cleanup())

function makeItem(variants: Record<string, number>, overrides: Partial<TopItem> = {}): TopItem {
  const quantity = Object.values(variants).reduce((a, b) => a + b, 0)
  return {
    name: 'Carbonara',
    quantity,
    revenueCents: 1500,
    variants,
    ...overrides,
  }
}

describe('AnalyticsPopularItemRow — display', () => {
  it('renders item name, quantity, and formatted revenue', () => {
    render(<AnalyticsPopularItemRow rank={1} item={makeItem({ standard: 5 })} />)
    expect(screen.getByText('Carbonara')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('$15.00')).toBeTruthy()
  })

  it('renders the rank number', () => {
    render(<AnalyticsPopularItemRow rank={7} item={makeItem({ standard: 5 })} />)
    expect(screen.getByText('7')).toBeTruthy()
  })
})

describe('AnalyticsPopularItemRow — standard-only (non-interactive)', () => {
  it('renders a div (not a button) when only variant key is "standard"', () => {
    const { container } = render(
      <AnalyticsPopularItemRow rank={1} item={makeItem({ standard: 5 })} />,
    )
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('div')).toBeTruthy()
  })

  it('has no aria-expanded attribute when non-interactive', () => {
    const { container } = render(
      <AnalyticsPopularItemRow rank={1} item={makeItem({ standard: 5 })} />,
    )
    const el = container.querySelector('[aria-expanded]')
    expect(el).toBeNull()
  })

  it('renders no chevron icon when non-interactive', () => {
    const { container } = render(
      <AnalyticsPopularItemRow rank={1} item={makeItem({ standard: 5 })} />,
    )
    // ChevronDown renders as an SVG; confirm no svg is present
    expect(container.querySelector('svg')).toBeNull()
  })
})

describe('AnalyticsPopularItemRow — with variants (interactive)', () => {
  const variantItem = makeItem({ standard: 31, 'without bacon': 12 })

  it('renders a button when multiple variant keys exist', () => {
    const { container } = render(<AnalyticsPopularItemRow rank={1} item={variantItem} />)
    expect(container.querySelector('button')).toBeTruthy()
  })

  it('starts with aria-expanded="false"', () => {
    const { container } = render(<AnalyticsPopularItemRow rank={1} item={variantItem} />)
    const btn = container.querySelector('button')
    expect(btn?.getAttribute('aria-expanded')).toBe('false')
  })

  it('clicking the row toggles aria-expanded to "true" and reveals breakdown', () => {
    const { container } = render(<AnalyticsPopularItemRow rank={1} item={variantItem} />)
    const btn = container.querySelector('button')!
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    // Breakdown string: count desc — "standard: 31 / without bacon: 12"
    expect(screen.getByText('standard: 31 / without bacon: 12')).toBeTruthy()
  })

  it('clicking again collapses the row', () => {
    const { container } = render(<AnalyticsPopularItemRow rank={1} item={variantItem} />)
    const btn = container.querySelector('button')!
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('standard: 31 / without bacon: 12')).toBeNull()
  })

  it('variant breakdown uses count-desc order: higher count first', () => {
    // standard(31) > without bacon(12) → standard comes first
    const { container } = render(<AnalyticsPopularItemRow rank={1} item={variantItem} />)
    fireEvent.click(container.querySelector('button')!)
    const breakdown = screen.getByText('standard: 31 / without bacon: 12')
    expect(breakdown).toBeTruthy()
  })

  it('variant breakdown uses alphabetical tiebreaker when counts are equal', () => {
    const tieItem = makeItem({ b: 5, a: 5 })
    const { container } = render(<AnalyticsPopularItemRow rank={1} item={tieItem} />)
    fireEvent.click(container.querySelector('button')!)
    // a < b alphabetically, so "a: 5" comes first on a tie
    expect(screen.getByText('a: 5 / b: 5')).toBeTruthy()
  })
})

describe('AnalyticsPopularItemRow — single non-standard key', () => {
  it('renders as interactive when the single key is not "standard"', () => {
    const item = makeItem({ 'gluten-free': 8 })
    const { container } = render(<AnalyticsPopularItemRow rank={1} item={item} />)
    expect(container.querySelector('button')).toBeTruthy()
  })

  it('shows the non-standard key in expansion', () => {
    const item = makeItem({ 'gluten-free': 8 })
    const { container } = render(<AnalyticsPopularItemRow rank={1} item={item} />)
    fireEvent.click(container.querySelector('button')!)
    expect(screen.getByText('gluten-free: 8')).toBeTruthy()
  })
})

describe('AnalyticsPopularItemRow — aria-controls links to panel', () => {
  it('aria-controls points to the expansion panel id', () => {
    const { container } = render(
      <AnalyticsPopularItemRow rank={1} item={makeItem({ standard: 31, 'no bacon': 12 })} />,
    )
    const btn = container.querySelector('button')!
    const panelId = btn.getAttribute('aria-controls')!
    expect(panelId).toBeTruthy()
    fireEvent.click(btn)
    const panel = container.querySelector(`[id="${panelId}"]`)
    expect(panel).toBeTruthy()
  })
})
