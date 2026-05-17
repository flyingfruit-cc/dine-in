import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('@/actions/restaurantActions', () => ({
  publishMenu: vi.fn(),
  takeMenuOffline: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}))

import { MenuPublishToggle } from '@/components/admin/MenuPublishToggle'
import { publishMenu, takeMenuOffline } from '@/actions/restaurantActions'
import { useRouter } from 'next/navigation'

const mockPublishMenu = vi.mocked(publishMenu)
const mockTakeMenuOffline = vi.mocked(takeMenuOffline)
const mockUseRouter = vi.mocked(useRouter)

describe('MenuPublishToggle', () => {
  beforeEach(() => {
    mockPublishMenu.mockReset()
    mockTakeMenuOffline.mockReset()
    const mockRefresh = vi.fn()
    mockUseRouter.mockReturnValue({ refresh: mockRefresh } as any)
  })
  afterEach(() => cleanup())

  it('renders Publish menu button when isPublished is false', () => {
    render(<MenuPublishToggle isPublished={false} />)
    expect(screen.getByRole('button', { name: 'Publish menu' })).toBeDefined()
    expect(screen.queryByText('Your menu is live.')).toBeNull()
  })

  it('renders live banner and Take offline button when isPublished is true', () => {
    render(<MenuPublishToggle isPublished={true} />)
    expect(screen.getByText(/Your menu is live/)).toBeDefined()
    expect(screen.getByRole('link', { name: /Go to Tables/ })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Take offline' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Publish menu' })).toBeNull()
  })

  it('calls publishMenu and refreshes on successful publish', async () => {
    const mockRefresh = vi.fn()
    mockUseRouter.mockReturnValue({ refresh: mockRefresh } as any)
    mockPublishMenu.mockResolvedValue({ success: true, data: undefined })

    render(<MenuPublishToggle isPublished={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }))

    await waitFor(() => expect(mockPublishMenu).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1))
  })

  it('shows inline error when publishMenu returns error', async () => {
    mockPublishMenu.mockResolvedValue({ success: false, error: 'Publish failed' })

    render(<MenuPublishToggle isPublished={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined())
    expect(screen.getByText('Publish failed')).toBeDefined()
  })

  it('clicking Take offline opens confirmation dialog', () => {
    render(<MenuPublishToggle isPublished={true} />)
    fireEvent.click(screen.getByRole('button', { name: 'Take offline' }))
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText('Take menu offline?')).toBeDefined()
  })

  it('Cancel button closes confirmation dialog without calling action', () => {
    render(<MenuPublishToggle isPublished={true} />)
    fireEvent.click(screen.getByRole('button', { name: 'Take offline' }))
    expect(screen.getByRole('dialog')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockTakeMenuOffline).not.toHaveBeenCalled()
  })

  it('confirming take offline calls takeMenuOffline and refreshes', async () => {
    const mockRefresh = vi.fn()
    mockUseRouter.mockReturnValue({ refresh: mockRefresh } as any)
    mockTakeMenuOffline.mockResolvedValue({ success: true, data: undefined })

    render(<MenuPublishToggle isPublished={true} />)
    fireEvent.click(screen.getByRole('button', { name: 'Take offline' }))

    const confirmButtons = screen.getAllByRole('button', { name: 'Take offline' })
    const confirmButton = confirmButtons[confirmButtons.length - 1]
    fireEvent.click(confirmButton)

    await waitFor(() => expect(mockTakeMenuOffline).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1))
  })

  it('shows inline error in dialog when takeMenuOffline returns error', async () => {
    mockTakeMenuOffline.mockResolvedValue({ success: false, error: 'Offline failed' })

    render(<MenuPublishToggle isPublished={true} />)
    fireEvent.click(screen.getByRole('button', { name: 'Take offline' }))

    const confirmButtons = screen.getAllByRole('button', { name: 'Take offline' })
    const confirmButton = confirmButtons[confirmButtons.length - 1]
    fireEvent.click(confirmButton)

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined())
    expect(screen.getByText('Offline failed')).toBeDefined()
  })

  it('shows Publishing… loading state while publish is in flight', async () => {
    let resolvePublish!: (v: any) => void
    mockPublishMenu.mockReturnValue(new Promise((res) => { resolvePublish = res }))

    render(<MenuPublishToggle isPublished={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Publish menu' }))

    expect(screen.getByRole('button', { name: 'Publishing…' })).toBeDefined()

    resolvePublish({ success: true, data: undefined })
  })
})
