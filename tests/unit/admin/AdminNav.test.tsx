import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AdminNav } from '@/components/admin/AdminNav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signOut: vi.fn().mockResolvedValue({}) },
  }),
}))

describe('AdminNav', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders Analytics entry in BOTH mobile and desktop nav surfaces', () => {
    render(<AdminNav />)
    const analyticsLinks = screen.getAllByRole('link', { name: /Analytics/i })
    // Both `<nav>` blocks render simultaneously in JSDOM (no CSS media query enforcement);
    // expect exactly 2: one mobile bottom-bar entry, one desktop sidebar entry.
    expect(analyticsLinks).toHaveLength(2)
  })

  it('Analytics entry links to /admin/analytics on both surfaces', () => {
    render(<AdminNav />)
    const analyticsLinks = screen.getAllByRole('link', { name: /Analytics/i })
    analyticsLinks.forEach((link) => {
      expect(link.getAttribute('href')).toBe('/admin/analytics')
    })
  })

  it('navigation order in mobile bar: Dashboard, Orders, Menu, Tables, Analytics, Settings (no Kitchen)', () => {
    render(<AdminNav />)
    // Mobile nav is `<nav aria-label="Admin navigation" class="...lg:hidden">`
    const mobileNav = screen.getAllByRole('navigation', { name: 'Admin navigation' })[0]
    const labels = Array.from(mobileNav.querySelectorAll('a'))
      .map((l) => l.textContent?.trim())
      .filter(Boolean)
    expect(labels).toEqual(['Dashboard', 'Orders', 'Menu', 'Tables', 'Analytics', 'Settings'])
  })

  it('navigation order in desktop sidebar: Dashboard, Orders, Menu, Tables, Analytics, Settings, Kitchen', () => {
    render(<AdminNav />)
    // Desktop nav is the second `<nav aria-label="Admin navigation">`
    const desktopNav = screen.getAllByRole('navigation', { name: 'Admin navigation' })[1]
    const labels = Array.from(desktopNav.querySelectorAll('a'))
      .map((l) => l.textContent?.trim())
      .filter(Boolean)
    // Desktop sidebar has the extra "dine-in" branding link first; tabs follow
    expect(labels).toEqual(['dine-in', 'Dashboard', 'Orders', 'Menu', 'Tables', 'Analytics', 'Settings', 'Kitchen'])
  })

  it('Kitchen entry is present only on desktop sidebar, not mobile bottom bar', () => {
    render(<AdminNav />)
    const mobileNav = screen.getAllByRole('navigation', { name: 'Admin navigation' })[0]
    const desktopNav = screen.getAllByRole('navigation', { name: 'Admin navigation' })[1]
    expect(mobileNav.querySelector('a[href="/admin/kds"]')).toBeNull()
    expect(desktopNav.querySelector('a[href="/admin/kds"]')).toBeTruthy()
  })
})
