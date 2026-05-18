import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { TenantList, type TenantRow } from '@/components/platform/TenantList'

function makeTenant(overrides: Partial<TenantRow> = {}): TenantRow {
  return {
    id: 't-1',
    name: 'Burger Palace',
    slug: 'burger-palace',
    created_at: '2026-01-15T10:00:00Z',
    is_published: true,
    ...overrides,
  }
}

afterEach(() => cleanup())

describe('TenantList', () => {
  it('renders all restaurants when search is empty', () => {
    render(
      <TenantList
        restaurants={[
          makeTenant({ id: 'a', name: 'Alpha Grill' }),
          makeTenant({ id: 'b', name: 'Beta Bistro' }),
        ]}
      />,
    )
    expect(screen.getByText('Alpha Grill')).toBeDefined()
    expect(screen.getByText('Beta Bistro')).toBeDefined()
  })

  it('filters by name (case-insensitive)', () => {
    render(
      <TenantList
        restaurants={[
          makeTenant({ id: 'a', name: 'Alpha Grill' }),
          makeTenant({ id: 'b', name: 'Beta Bistro' }),
        ]}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText(/search by name/i), {
      target: { value: 'alpha' },
    })
    expect(screen.getByText('Alpha Grill')).toBeDefined()
    expect(screen.queryByText('Beta Bistro')).toBeNull()
  })

  it('filters case-insensitively (uppercase query)', () => {
    render(
      <TenantList
        restaurants={[makeTenant({ id: 'a', name: 'Fancy Noodles' })]}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText(/search by name/i), {
      target: { value: 'FANCY' },
    })
    expect(screen.getByText('Fancy Noodles')).toBeDefined()
  })

  it('shows "No restaurants match" when search has no results', () => {
    render(
      <TenantList restaurants={[makeTenant({ id: 'a', name: 'Alpha Grill' })]} />,
    )
    fireEvent.change(screen.getByPlaceholderText(/search by name/i), {
      target: { value: 'zzz' },
    })
    expect(screen.getByText(/no restaurants match/i)).toBeDefined()
    expect(screen.queryByText('Alpha Grill')).toBeNull()
  })

  it('shows "No restaurants registered yet" when list is empty', () => {
    render(<TenantList restaurants={[]} />)
    expect(screen.getByText(/no restaurants registered yet/i)).toBeDefined()
  })

  it('shows Published badge for is_published: true', () => {
    render(<TenantList restaurants={[makeTenant({ is_published: true })]} />)
    expect(screen.getByText('Published')).toBeDefined()
  })

  it('shows Offline badge for is_published: false', () => {
    render(<TenantList restaurants={[makeTenant({ is_published: false })]} />)
    expect(screen.getByText('Offline')).toBeDefined()
  })

  it('shows slug below restaurant name', () => {
    render(<TenantList restaurants={[makeTenant({ slug: 'burger-palace' })]} />)
    expect(screen.getByText('burger-palace')).toBeDefined()
  })

  it('shows signup date formatted', () => {
    render(
      <TenantList
        restaurants={[makeTenant({ created_at: '2026-01-15T10:00:00Z' })]}
      />,
    )
    const dateText = screen.getByText(/joined/i)
    expect(dateText.textContent).toMatch(/joined/i)
    // Date formatted via toLocaleDateString — just assert it contains a year
    expect(dateText.textContent).toContain('2026')
  })

  it('whitespace-only query shows all restaurants (no filter applied)', () => {
    render(
      <TenantList
        restaurants={[
          makeTenant({ id: 'a', name: 'Alpha Grill' }),
          makeTenant({ id: 'b', name: 'Beta Bistro' }),
        ]}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText(/search by name/i), {
      target: { value: '   ' },
    })
    expect(screen.getByText('Alpha Grill')).toBeDefined()
    expect(screen.getByText('Beta Bistro')).toBeDefined()
    expect(screen.queryByText(/no restaurants match/i)).toBeNull()
  })

  it('search input has accessible aria-label', () => {
    render(<TenantList restaurants={[makeTenant()]} />)
    expect(screen.getByLabelText(/search restaurants by name/i)).toBeDefined()
  })

  it('clears filter when search is emptied', () => {
    render(
      <TenantList
        restaurants={[
          makeTenant({ id: 'a', name: 'Alpha Grill' }),
          makeTenant({ id: 'b', name: 'Beta Bistro' }),
        ]}
      />,
    )
    const input = screen.getByPlaceholderText(/search by name/i)
    fireEvent.change(input, { target: { value: 'alpha' } })
    expect(screen.queryByText('Beta Bistro')).toBeNull()
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByText('Alpha Grill')).toBeDefined()
    expect(screen.getByText('Beta Bistro')).toBeDefined()
  })

  it('each restaurant row links to the tenant detail page', () => {
    render(
      <TenantList
        restaurants={[makeTenant({ id: 'abc-123', name: 'Alpha Grill' })]}
      />,
    )
    const link = screen.getByRole('link', { name: /alpha grill/i })
    expect(link.getAttribute('href')).toContain('abc-123')
  })
})
