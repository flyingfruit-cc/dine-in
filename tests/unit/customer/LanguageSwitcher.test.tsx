import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LanguageSwitcher } from '@/components/customer/LanguageSwitcher'
import { makeChrome } from './_fixtures/chromeFixture'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/test-slug/5',
  useSearchParams: () => new URLSearchParams(''),
}))

beforeEach(() => {
  mockPush.mockReset()
})

afterEach(() => cleanup())

describe('LanguageSwitcher', () => {
  it('returns null when only one language is supported', () => {
    const { container } = render(
      <LanguageSwitcher
        lang="en"
        supportedLanguages={['en']}
        defaultLanguage="en"
        chrome={makeChrome()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when supported list is empty', () => {
    const { container } = render(
      <LanguageSwitcher
        lang="en"
        supportedLanguages={[]}
        defaultLanguage="en"
        chrome={makeChrome()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a button with the chrome aria-label', () => {
    render(
      <LanguageSwitcher
        lang="en"
        supportedLanguages={['en', 'es']}
        defaultLanguage="en"
        chrome={makeChrome()}
      />,
    )
    const btn = screen.getByRole('button', { name: 'Change language' })
    expect(btn).toBeDefined()
  })

  it('opens the menu on click and lists each supported language', () => {
    render(
      <LanguageSwitcher
        lang="en"
        supportedLanguages={['en', 'es', 'fr']}
        defaultLanguage="en"
        chrome={makeChrome()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }))
    expect(screen.getByRole('menu')).toBeDefined()
    expect(screen.getByRole('menuitemradio', { name: /English/i })).toBeDefined()
    expect(screen.getByRole('menuitemradio', { name: /Spanish/i })).toBeDefined()
    expect(screen.getByRole('menuitemradio', { name: /French/i })).toBeDefined()
  })

  it('marks the current selection with aria-checked', () => {
    render(
      <LanguageSwitcher
        lang="es"
        supportedLanguages={['en', 'es']}
        defaultLanguage="en"
        chrome={makeChrome()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }))
    const spanish = screen.getByRole('menuitemradio', { name: /Spanish/i })
    expect(spanish.getAttribute('aria-checked')).toBe('true')
    const english = screen.getByRole('menuitemradio', { name: /English/i })
    expect(english.getAttribute('aria-checked')).toBe('false')
  })

  it('clicking a non-default language navigates with ?lang=', () => {
    render(
      <LanguageSwitcher
        lang="en"
        supportedLanguages={['en', 'es']}
        defaultLanguage="en"
        chrome={makeChrome()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Spanish/i }))
    expect(mockPush).toHaveBeenCalledWith('/test-slug/5?lang=es')
  })

  it('clicking the default language navigates without ?lang=', () => {
    render(
      <LanguageSwitcher
        lang="es"
        supportedLanguages={['en', 'es']}
        defaultLanguage="en"
        chrome={makeChrome()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /English/i }))
    expect(mockPush).toHaveBeenCalledWith('/test-slug/5')
  })

  it('pressing Escape closes the open menu', () => {
    render(
      <LanguageSwitcher
        lang="en"
        supportedLanguages={['en', 'es']}
        defaultLanguage="en"
        chrome={makeChrome()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }))
    expect(screen.queryByRole('menu')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('clicking outside closes the menu', () => {
    render(
      <div>
        <LanguageSwitcher
          lang="en"
          supportedLanguages={['en', 'es']}
          defaultLanguage="en"
          chrome={makeChrome()}
        />
        <button data-testid="outside">outside</button>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }))
    expect(screen.queryByRole('menu')).not.toBeNull()
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
