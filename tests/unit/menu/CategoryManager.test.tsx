import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/actions/menuActions', () => ({
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

import { CategoryManager } from '@/components/admin/CategoryManager'
import { createCategory, renameCategory, deleteCategory } from '@/actions/menuActions'

const mockCreate = vi.mocked(createCategory)
const mockRename = vi.mocked(renameCategory)
const mockDelete = vi.mocked(deleteCategory)

const sampleCategories = [
  { id: 'cat-1', restaurant_id: 'rest-1', name: 'Starters', display_order: 0 },
  { id: 'cat-2', restaurant_id: 'rest-1', name: 'Mains', display_order: 1 },
]

describe('CategoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows empty state when no categories', () => {
    render(<CategoryManager initialCategories={[]} />)
    expect(screen.getByText(/add your first category/i)).toBeDefined()
  })

  it('renders existing categories', () => {
    render(<CategoryManager initialCategories={sampleCategories} />)
    expect(screen.getByText('Starters')).toBeDefined()
    expect(screen.getByText('Mains')).toBeDefined()
  })

  it('creates a category on form submit', async () => {
    const newCat = { id: 'cat-3', restaurant_id: 'rest-1', name: 'Desserts', display_order: 2 }
    mockCreate.mockResolvedValue({ success: true, data: { category: newCat } })

    render(<CategoryManager initialCategories={[]} />)
    fireEvent.change(screen.getByPlaceholderText(/category name/i), {
      target: { value: 'Desserts' },
    })
    fireEvent.submit(screen.getByRole('form'))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('Desserts')
      expect(screen.getByText('Desserts')).toBeDefined()
    })
  })

  it('shows inline error when createCategory fails', async () => {
    mockCreate.mockResolvedValue({ success: false, error: 'Unable to save — tap to try again' })

    render(<CategoryManager initialCategories={[]} />)
    fireEvent.change(screen.getByPlaceholderText(/category name/i), {
      target: { value: 'Bad' },
    })
    fireEvent.submit(screen.getByRole('form'))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Unable to save')
    })
  })

  it('shows rename input on category name click', async () => {
    render(<CategoryManager initialCategories={sampleCategories} />)
    fireEvent.click(screen.getByText('Starters'))
    expect(screen.getByDisplayValue('Starters')).toBeDefined()
  })

  it('saves rename on blur', async () => {
    const updated = { ...sampleCategories[0], name: 'Appetisers' }
    mockRename.mockResolvedValue({ success: true, data: { category: updated } })

    render(<CategoryManager initialCategories={sampleCategories} />)
    fireEvent.click(screen.getByText('Starters'))
    const input = screen.getByDisplayValue('Starters')
    fireEvent.change(input, { target: { value: 'Appetisers' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(mockRename).toHaveBeenCalledWith('cat-1', 'Appetisers')
    })
  })

  it('shows delete confirmation dialog before deleting', async () => {
    render(<CategoryManager initialCategories={sampleCategories} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('calls deleteCategory after confirmation', async () => {
    mockDelete.mockResolvedValue({ success: true, data: undefined })

    render(<CategoryManager initialCategories={sampleCategories} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    fireEvent.click(screen.getByRole('button', { name: /delete category/i }))

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('cat-1')
    })
  })

  it('closes dialog on cancel without deleting', () => {
    render(<CategoryManager initialCategories={sampleCategories} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('shows inline error in dialog when deleteCategory fails', async () => {
    mockDelete.mockResolvedValue({ success: false, error: 'Unable to delete — tap to try again' })

    render(<CategoryManager initialCategories={sampleCategories} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    fireEvent.click(screen.getByRole('button', { name: /delete category/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Unable to delete')
    })
    // Dialog stays open so user can retry
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('disables confirm button while delete is in flight', async () => {
    let resolveFn!: (v: unknown) => void
    mockDelete.mockReturnValue(new Promise((r) => { resolveFn = r }))

    render(<CategoryManager initialCategories={sampleCategories} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    const confirmBtn = screen.getByRole('button', { name: /delete category/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deleting/i })).toBeDefined()
    })

    resolveFn({ success: true, data: undefined })
  })

  it('shows inline error when rename fails', async () => {
    mockRename.mockResolvedValue({ success: false, error: 'Unable to save — tap to try again' })

    render(<CategoryManager initialCategories={sampleCategories} />)
    fireEvent.click(screen.getByText('Starters'))
    const input = screen.getByDisplayValue('Starters')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Unable to save')
    })
  })
})
