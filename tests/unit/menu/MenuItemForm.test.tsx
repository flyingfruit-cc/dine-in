import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import type { VariantGroup, AvailabilitySchedule } from '@/types/app'

const mockPush = vi.fn()

vi.mock('@/actions/menuActions', () => ({
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  uploadMenuItemImage: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ push: mockPush })) }))

vi.mock('@/components/admin/VariantEditor', () => ({
  VariantEditor: ({ onChange }: { onChange: (v: VariantGroup[]) => void }) => (
    <button
      type="button"
      onClick={() => onChange([{ id: 'v1', name: 'Size', options: [{ id: 'o1', name: 'Small', price_cents: 800 }] }])}
    >
      mock-variant-change
    </button>
  ),
}))

vi.mock('@/components/admin/AvailabilitySchedule', () => ({
  AvailabilitySchedule: ({ onChange }: { onChange: (s: AvailabilitySchedule) => void }) => (
    <button
      type="button"
      onClick={() => onChange({ days: ['mon', 'fri'], start_time: '11:00', end_time: '14:00' })}
    >
      mock-availability-change
    </button>
  ),
}))

import { MenuItemForm } from '@/components/admin/MenuItemForm'
import { createMenuItem, updateMenuItem, uploadMenuItemImage } from '@/actions/menuActions'

// jsdom does not implement URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')

const mockCreate = vi.mocked(createMenuItem)
const mockUpdate = vi.mocked(updateMenuItem)
const mockUpload = vi.mocked(uploadMenuItemImage)

const sampleCategories = [
  { id: 'cat-1', restaurant_id: 'rest-1', name: 'Starters', display_order: 0 },
  { id: 'cat-2', restaurant_id: 'rest-1', name: 'Mains', display_order: 1 },
]

const sampleItem = {
  id: 'item-1',
  restaurant_id: 'rest-1',
  category_id: 'cat-1',
  name: 'Soup',
  description: 'Hot soup',
  price_cents: 800,
  image_url: null,
  variants: [],
  availability_schedule: null,
  created_at: '2026-05-10',
}

describe('MenuItemForm', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('renders all fields for create mode', () => {
    render(<MenuItemForm categories={sampleCategories} />)
    expect(screen.getByPlaceholderText(/item name/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/description/i)).toBeDefined()
    expect(screen.getByLabelText(/price/i)).toBeDefined()
    expect(screen.getByRole('combobox')).toBeDefined() // category selector
  })

  it('pre-populates fields in edit mode', () => {
    render(<MenuItemForm categories={sampleCategories} item={sampleItem} />)
    expect(screen.getByDisplayValue('Soup')).toBeDefined()
    expect(screen.getByDisplayValue('Hot soup')).toBeDefined()
    expect(screen.getByDisplayValue('8.00')).toBeDefined()
  })

  it('shows currency prefix', () => {
    render(<MenuItemForm categories={sampleCategories} />)
    expect(screen.getByText('$')).toBeDefined()
  })

  it('auto-saves after 2 seconds when name is provided (create mode)', async () => {
    vi.useFakeTimers()
    const newItem = { ...sampleItem, id: 'new-item-1', name: 'Pizza' }
    mockCreate.mockResolvedValue({ success: true, data: { item: newItem } })

    render(<MenuItemForm categories={sampleCategories} />)
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Pizza' } })

    await act(async () => { await vi.runAllTimersAsync() })

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pizza' }))

    vi.useRealTimers()
  })

  it('redirects to edit URL after first create', async () => {
    vi.useFakeTimers()
    const newItem = { ...sampleItem, id: 'new-item-1', name: 'Pizza' }
    mockCreate.mockResolvedValue({ success: true, data: { item: newItem } })

    render(<MenuItemForm categories={sampleCategories} />)
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Pizza' } })

    await act(async () => { await vi.runAllTimersAsync() })

    expect(mockPush).toHaveBeenCalledWith('/admin/menu/new-item-1')

    vi.useRealTimers()
  })

  it('shows saved confirmation after successful save in edit mode', async () => {
    vi.useFakeTimers()
    const updated = { ...sampleItem, name: 'Updated Soup' }
    mockUpdate.mockResolvedValue({ success: true, data: { item: updated } })

    render(<MenuItemForm categories={sampleCategories} item={sampleItem} />)
    fireEvent.change(screen.getByDisplayValue('Soup'), { target: { value: 'Updated Soup' } })

    // advanceTimersByTime(2000) fires debounce; act drains microtasks so mock resolves
    // and status becomes 'saved'. The 2-second reset timer is scheduled but not yet fired.
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(screen.getByText(/saved/i)).toBeDefined()

    vi.useRealTimers()
  })

  it('shows inline error when save fails', async () => {
    vi.useFakeTimers()
    mockCreate.mockResolvedValue({ success: false, error: 'Unable to save — tap to try again' })

    render(<MenuItemForm categories={sampleCategories} />)
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Bad item' } })

    await act(async () => { await vi.runAllTimersAsync() })

    expect(screen.getByRole('alert').textContent).toContain('Unable to save')

    vi.useRealTimers()
  })

  it('shows error when image upload fails', async () => {
    vi.useFakeTimers()
    mockUpdate.mockResolvedValue({ success: true, data: { item: sampleItem } })
    mockUpload.mockResolvedValue({ success: false, error: 'Upload failed' })

    render(<MenuItemForm categories={sampleCategories} item={sampleItem} />)

    const fileInput = screen.getByLabelText(/image/i)
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    fireEvent.change(screen.getByDisplayValue('Soup'), { target: { value: 'Updated Soup' } })
    await act(async () => { await vi.runAllTimersAsync() })

    expect(screen.getByRole('alert').textContent).toContain('Unable to save')

    vi.useRealTimers()
  })

  it('does not auto-save when name is empty', async () => {
    vi.useFakeTimers()
    render(<MenuItemForm categories={sampleCategories} />)
    // don't type a name, just change description
    fireEvent.change(screen.getByPlaceholderText(/description/i), { target: { value: 'Some desc' } })
    await act(async () => { await vi.runAllTimersAsync() })
    expect(mockCreate).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('calls updateMenuItem (not create) in edit mode', async () => {
    vi.useFakeTimers()
    const updated = { ...sampleItem, name: 'Updated Soup' }
    mockUpdate.mockResolvedValue({ success: true, data: { item: updated } })

    render(<MenuItemForm categories={sampleCategories} item={sampleItem} />)
    fireEvent.change(screen.getByDisplayValue('Soup'), { target: { value: 'Updated Soup' } })

    await act(async () => { await vi.runAllTimersAsync() })

    expect(mockUpdate).toHaveBeenCalledWith('item-1', expect.objectContaining({ name: 'Updated Soup' }))
    expect(mockCreate).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('shows image preview when file is selected', async () => {
    render(<MenuItemForm categories={sampleCategories} />)
    const fileInput = screen.getByLabelText(/image/i)
    const file = new File(['image data'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => {
      const preview = screen.queryByRole('img')
      expect(preview).not.toBeNull()
    })
  })

  it('shows navigation CTAs in edit mode', () => {
    render(<MenuItemForm categories={sampleCategories} item={sampleItem} />)
    const addLink = screen.getByRole('link', { name: /add another item/i })
    const backLink = screen.getByRole('link', { name: /back to menu/i })
    expect((addLink as HTMLAnchorElement).href).toContain('/admin/menu/new')
    expect((backLink as HTMLAnchorElement).href).toContain('/admin/menu')
  })

  it('does not show navigation CTAs in create mode', () => {
    render(<MenuItemForm categories={sampleCategories} />)
    expect(screen.queryByRole('link', { name: /add another item/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /back to menu/i })).toBeNull()
  })

  it('shows remove image button when preview is present', () => {
    const itemWithImage = { ...sampleItem, image_url: 'https://cdn.example.com/img.jpg' }
    render(<MenuItemForm categories={sampleCategories} item={itemWithImage} />)
    expect(screen.getByRole('button', { name: /remove image/i })).toBeDefined()
  })

  it('clears image preview when remove image is clicked', () => {
    const itemWithImage = { ...sampleItem, image_url: 'https://cdn.example.com/img.jpg' }
    render(<MenuItemForm categories={sampleCategories} item={itemWithImage} />)
    fireEvent.click(screen.getByRole('button', { name: /remove image/i }))
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('button', { name: /remove image/i })).toBeNull()
  })

  it('renders VariantEditor section', () => {
    render(<MenuItemForm categories={sampleCategories} />)
    expect(screen.getByRole('button', { name: /mock-variant-change/i })).toBeDefined()
  })

  it('includes variants in save payload when variants change', async () => {
    vi.useFakeTimers()
    const newItem = { ...sampleItem, id: 'new-item-1', name: 'Pizza' }
    mockCreate.mockResolvedValue({ success: true, data: { item: newItem } })

    render(<MenuItemForm categories={sampleCategories} />)
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Pizza' } })
    fireEvent.click(screen.getByRole('button', { name: /mock-variant-change/i }))

    await act(async () => { await vi.runAllTimersAsync() })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Pizza',
        variants: [{ id: 'v1', name: 'Size', options: [{ id: 'o1', name: 'Small', price_cents: 800 }] }],
      })
    )

    vi.useRealTimers()
  })

  it('includes variants in updateMenuItem payload in edit mode', async () => {
    vi.useFakeTimers()
    const updated = { ...sampleItem, name: 'Updated Soup' }
    mockUpdate.mockResolvedValue({ success: true, data: { item: updated } })

    render(<MenuItemForm categories={sampleCategories} item={sampleItem} />)
    fireEvent.click(screen.getByRole('button', { name: /mock-variant-change/i }))

    await act(async () => { await vi.runAllTimersAsync() })

    expect(mockUpdate).toHaveBeenCalledWith('item-1', expect.objectContaining({
      variants: [{ id: 'v1', name: 'Size', options: [{ id: 'o1', name: 'Small', price_cents: 800 }] }],
    }))

    vi.useRealTimers()
  })

  it('renders AvailabilitySchedule section', () => {
    render(<MenuItemForm categories={sampleCategories} />)
    expect(screen.getByRole('button', { name: /mock-availability-change/i })).toBeDefined()
  })

  it('includes availability_schedule in save payload when schedule changes', async () => {
    vi.useFakeTimers()
    const newItem = { ...sampleItem, id: 'new-item-1', name: 'Pizza' }
    mockCreate.mockResolvedValue({ success: true, data: { item: newItem } })

    render(<MenuItemForm categories={sampleCategories} />)
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Pizza' } })
    fireEvent.click(screen.getByRole('button', { name: /mock-availability-change/i }))

    await act(async () => { await vi.runAllTimersAsync() })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Pizza',
        availability_schedule: { days: ['mon', 'fri'], start_time: '11:00', end_time: '14:00' },
      })
    )

    vi.useRealTimers()
  })

  it('includes availability_schedule in updateMenuItem payload in edit mode', async () => {
    vi.useFakeTimers()
    const updated = { ...sampleItem, name: 'Updated Soup' }
    mockUpdate.mockResolvedValue({ success: true, data: { item: updated } })

    render(<MenuItemForm categories={sampleCategories} item={sampleItem} />)
    fireEvent.click(screen.getByRole('button', { name: /mock-availability-change/i }))

    await act(async () => { await vi.runAllTimersAsync() })

    expect(mockUpdate).toHaveBeenCalledWith('item-1', expect.objectContaining({
      availability_schedule: { days: ['mon', 'fri'], start_time: '11:00', end_time: '14:00' },
    }))

    vi.useRealTimers()
  })

  it('passes image_url null to updateMenuItem after image removal', async () => {
    vi.useFakeTimers()
    const itemWithImage = { ...sampleItem, image_url: 'https://cdn.example.com/img.jpg' }
    mockUpdate.mockResolvedValue({ success: true, data: { item: itemWithImage } })

    render(<MenuItemForm categories={sampleCategories} item={itemWithImage} />)
    fireEvent.click(screen.getByRole('button', { name: /remove image/i }))

    await act(async () => { vi.advanceTimersByTime(2000) })

    expect(mockUpdate).toHaveBeenCalledWith('item-1', expect.objectContaining({ image_url: null }))

    vi.useRealTimers()
  })
})
