import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AdminShell } from '@/components/admin/AdminShell'

const usePathnameMock = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signOut: vi.fn().mockResolvedValue({}) },
  }),
}))

describe('AdminShell', () => {
  beforeEach(() => {
    usePathnameMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders AdminNav and padding wrapper on non-KDS routes', () => {
    usePathnameMock.mockReturnValue('/admin/orders')
    render(
      <AdminShell>
        <div data-testid="page-content">Orders page</div>
      </AdminShell>,
    )
    // Two <nav> elements render (mobile + desktop) — chrome present
    const navs = screen.getAllByRole('navigation', { name: 'Admin navigation' })
    expect(navs.length).toBe(2)
    expect(screen.getByTestId('page-content')).toBeTruthy()
  })

  it('skips AdminNav and padding on /admin/kds', () => {
    usePathnameMock.mockReturnValue('/admin/kds')
    const { container } = render(
      <AdminShell>
        <div data-testid="page-content">KDS page</div>
      </AdminShell>,
    )
    expect(container.querySelector('[aria-label="Admin navigation"]')).toBeNull()
    expect(screen.getByTestId('page-content')).toBeTruthy()
  })

  it('skips chrome on nested KDS routes (startsWith match)', () => {
    usePathnameMock.mockReturnValue('/admin/kds/some-future-subroute')
    const { container } = render(
      <AdminShell>
        <div data-testid="page-content">Nested KDS</div>
      </AdminShell>,
    )
    expect(container.querySelector('[aria-label="Admin navigation"]')).toBeNull()
  })

  it('does NOT match similarly-named non-KDS routes', () => {
    usePathnameMock.mockReturnValue('/admin/kds-summary-not-real')
    render(
      <AdminShell>
        <div data-testid="page-content">Should still have chrome</div>
      </AdminShell>,
    )
    // The chrome should still render — only exact /admin/kds or /admin/kds/* skip it
    // Note: with startsWith('/admin/kds/'), '/admin/kds-summary-not-real' is NOT matched (good).
    // This test guards against accidentally using startsWith('/admin/kds') (no slash) which would over-match.
    const navs = screen.getAllByRole('navigation', { name: 'Admin navigation' })
    expect(navs.length).toBe(2)
  })
})
