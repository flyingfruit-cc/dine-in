import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

const mockUpdateTranslation = vi.fn()

vi.mock('@/actions/menuActions', () => ({
  updateMenuItemTranslation: (...args: unknown[]) => mockUpdateTranslation(...args),
}))

import { TranslationCard } from '@/components/admin/TranslationCard'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  mockUpdateTranslation.mockReset()
})

const defaultProps = {
  itemId: 'item-1',
  langCode: 'es' as const,
  initialName: '',
  initialDescription: '',
}

describe('TranslationCard', () => {
  it('renders the language label header', () => {
    render(<TranslationCard {...defaultProps} />)
    expect(screen.getByText('Spanish')).toBeDefined()
  })

  it('pre-populates inputs from initial props', () => {
    render(<TranslationCard {...defaultProps} initialName="Hamburguesa" initialDescription="Muy rica" />)
    expect(screen.getByDisplayValue('Hamburguesa')).toBeDefined()
    expect(screen.getByDisplayValue('Muy rica')).toBeDefined()
  })

  it('triggers updateMenuItemTranslation after 2s debounce when name is non-empty', async () => {
    vi.useFakeTimers()
    mockUpdateTranslation.mockResolvedValue({ success: true, data: { item: { id: 'item-1' } } })

    render(<TranslationCard {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Spanish name'), { target: { value: 'Hamburguesa' } })

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    expect(mockUpdateTranslation).toHaveBeenCalledWith(
      'item-1',
      'es',
      expect.objectContaining({ name: 'Hamburguesa' })
    )
  })

  it('does NOT trigger the action when name is empty', async () => {
    vi.useFakeTimers()

    render(<TranslationCard {...defaultProps} />)
    // name stays empty — just change description
    fireEvent.change(screen.getByLabelText('Spanish description'), { target: { value: 'Muy rica' } })

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    expect(mockUpdateTranslation).not.toHaveBeenCalled()
  })

  it('shows Saving… while action is in-flight', async () => {
    vi.useFakeTimers()
    let resolveAction!: (v: unknown) => void
    mockUpdateTranslation.mockReturnValue(new Promise((res) => { resolveAction = res }))

    render(<TranslationCard {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Spanish name'), { target: { value: 'Hamburguesa' } })

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    expect(screen.getByRole('status').textContent).toContain('Saving')
    resolveAction({ success: true, data: { item: {} } })
  })

  it('shows Saved ✓ after success then resets to idle', async () => {
    vi.useFakeTimers()
    mockUpdateTranslation.mockResolvedValue({ success: true, data: { item: { id: 'item-1' } } })

    render(<TranslationCard {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Spanish name'), { target: { value: 'Hamburguesa' } })

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    expect(screen.getByRole('status').textContent).toContain('Saved')

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('shows error status and persists it on failure', async () => {
    vi.useFakeTimers()
    mockUpdateTranslation.mockResolvedValue({ success: false, error: 'Save failed — tap to retry', code: 'UPDATE_FAILED' })

    render(<TranslationCard {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Spanish name'), { target: { value: 'Hamburguesa' } })

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    expect(screen.getByRole('status').textContent).toContain('Saving failed')

    // Advance further — error persists (no auto-reset on error)
    await act(async () => {
      vi.advanceTimersByTime(5000)
      await Promise.resolve()
    })

    expect(screen.getByRole('status').textContent).toContain('Saving failed')
  })

  it('two cards have independent status — saving on es does not affect fr', async () => {
    vi.useFakeTimers()
    let resolveEs!: (v: unknown) => void
    mockUpdateTranslation.mockReturnValue(new Promise((res) => { resolveEs = res }))

    render(
      <div>
        <TranslationCard itemId="item-1" langCode="es" initialName="" initialDescription="" />
        <TranslationCard itemId="item-1" langCode="fr" initialName="" initialDescription="" />
      </div>
    )

    // Trigger es save
    fireEvent.change(screen.getByLabelText('Spanish name'), { target: { value: 'Hamburguesa' } })

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    const [esStatus, frStatus] = screen.getAllByRole('status')
    expect(esStatus.textContent).toContain('Saving')
    expect(frStatus.textContent).toBe('')

    resolveEs({ success: true, data: { item: {} } })
  })
})
