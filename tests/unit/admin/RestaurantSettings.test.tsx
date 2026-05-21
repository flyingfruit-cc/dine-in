import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

const mockUpdateName = vi.fn()
const mockUpdateLanguages = vi.fn()

vi.mock('@/actions/restaurantActions', () => ({
  updateRestaurantName: (...args: unknown[]) => mockUpdateName(...args),
  updateRestaurantLanguages: (...args: unknown[]) => mockUpdateLanguages(...args),
  publishMenu: vi.fn(),
  takeMenuOffline: vi.fn(),
  recordMenuPreview: vi.fn(),
  recordQrPrint: vi.fn(),
}))

import { RestaurantSettings } from '@/components/admin/RestaurantSettings'

afterEach(() => cleanup())

beforeEach(() => {
  mockUpdateName.mockReset()
  mockUpdateLanguages.mockReset()
})

const defaultProps = {
  name: 'Test Restaurant',
  slug: 'test-restaurant',
  supportedLanguages: ['en'],
  defaultLanguage: 'en',
}

describe('RestaurantSettings — Languages section', () => {
  it('renders 5 language checkboxes', () => {
    render(<RestaurantSettings {...defaultProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBe(5)
  })

  it('en checkbox is checked and disabled', () => {
    render(<RestaurantSettings {...defaultProps} />)
    const enCheckbox = screen.getByRole('checkbox', { name: 'English' }) as HTMLInputElement
    expect(enCheckbox.checked).toBe(true)
    expect(enCheckbox.disabled).toBe(true)
  })

  it('non-english checkboxes are unchecked and enabled by default', () => {
    render(<RestaurantSettings {...defaultProps} />)
    const esCheckbox = screen.getByRole('checkbox', { name: 'Spanish' }) as HTMLInputElement
    expect(esCheckbox.checked).toBe(false)
    expect(esCheckbox.disabled).toBe(false)
  })

  it('default-language radio only lists currently-checked languages', () => {
    render(<RestaurantSettings {...defaultProps} />)
    const radios = screen.getAllByRole('radio')
    // only 'en' is selected so only one radio should be visible
    expect(radios.length).toBe(1)
  })

  it('default-language radio lists newly checked language after toggling', () => {
    render(<RestaurantSettings {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Spanish'))
    const radios = screen.getAllByRole('radio')
    expect(radios.length).toBe(2)
  })

  it('seeded from props: pre-selects es and shows two radios', () => {
    render(<RestaurantSettings {...defaultProps} supportedLanguages={['en', 'es']} defaultLanguage="en" />)
    const esCheckbox = screen.getByRole('checkbox', { name: 'Spanish' }) as HTMLInputElement
    expect(esCheckbox.checked).toBe(true)
    const radios = screen.getAllByRole('radio')
    expect(radios.length).toBe(2)
  })

  it('Save button calls updateRestaurantLanguages with selected values', async () => {
    mockUpdateLanguages.mockResolvedValue({ success: true, data: undefined })

    render(<RestaurantSettings {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Spanish'))

    // Click the Save button for the languages form (the second Save button in the page)
    const saveButtons = screen.getAllByRole('button', { name: /save/i })
    // The languages form's Save is after the restaurant-name form's Save
    await act(async () => {
      fireEvent.click(saveButtons[saveButtons.length - 1])
    })

    expect(mockUpdateLanguages).toHaveBeenCalledWith(
      expect.arrayContaining(['en', 'es']),
      'en'
    )
  })

  it('shows success message after languages saved', async () => {
    mockUpdateLanguages.mockResolvedValue({ success: true, data: undefined })

    render(<RestaurantSettings {...defaultProps} />)
    const saveButtons = screen.getAllByRole('button', { name: /save/i })
    await act(async () => {
      fireEvent.click(saveButtons[saveButtons.length - 1])
    })

    expect(screen.getByText('Languages updated.')).toBeDefined()
  })

  it('shows error message when updateRestaurantLanguages fails', async () => {
    mockUpdateLanguages.mockResolvedValue({ success: false, error: 'English is required', code: 'INVALID_LANGUAGE' })

    render(<RestaurantSettings {...defaultProps} />)
    const saveButtons = screen.getAllByRole('button', { name: /save/i })
    await act(async () => {
      fireEvent.click(saveButtons[saveButtons.length - 1])
    })

    expect(screen.getByRole('alert').textContent).toContain('English is required')
  })
})
