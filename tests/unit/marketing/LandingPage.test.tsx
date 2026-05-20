import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Home from '@/app/page'

describe('Home (landing page)', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders all landing sections', () => {
    render(<Home />)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /QR-code dine-in ordering/i,
    )
    expect(screen.getByText(/Drag-and-drop menu builder/i)).toBeTruthy()
    expect(screen.getByText(/From signup to live orders/i)).toBeTruthy()
    expect(screen.getByText(/Simple, flat monthly pricing/i)).toBeTruthy()
    expect(screen.getByText(/Are you a diner\? Scan the QR code/i)).toBeTruthy()
  })

  it('exposes primary CTAs linking to /auth/sign-up', () => {
    render(<Home />)

    const ctas = screen.getAllByRole('link', { name: /get started|start free/i })
    expect(ctas.length).toBeGreaterThan(0)
    for (const cta of ctas) {
      expect(cta.getAttribute('href')).toBe('/auth/sign-up')
    }
  })

  it('exposes sign-in links to /auth/login', () => {
    render(<Home />)

    const signInLinks = screen.getAllByRole('link', { name: /sign in/i })
    expect(signInLinks.length).toBeGreaterThan(0)
    for (const link of signInLinks) {
      expect(link.getAttribute('href')).toBe('/auth/login')
    }
  })
})
